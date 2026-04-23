import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { google } from "googleapis"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { getSenderScore, isKnownAdSender } from "@/lib/sender-registry"
import { resolveFinalStatus, STATUS_KEYWORDS } from "@/lib/status-resolver"
import { ThreadContext, MessageContent, extractBody, cleanBody, truncateBody } from "@/lib/email-pipeline"

export interface Application {
  id: string
  company: string
  role: string
  status: "applied" | "interview" | "rejected" | "offer"
  source: string
  date: string
  subject: string
}

import { OpenAI } from "openai"

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!)

// Groq client (OpenAI compatible)
const groq = process.env.GROQ_API_KEY 
  ? new OpenAI({ 
      apiKey: process.env.GROQ_API_KEY, 
      baseURL: "https://api.groq.com/openai/v1" 
    }) 
  : null

async function processPipelineBatch(threads: ThreadContext[]) {
  if (threads.length === 0) return []

  const modelNames = [
    "models/gemini-2.0-flash",
    "models/gemini-1.5-flash",
    "models/gemini-1.5-pro",
  ]

  const prompt = `
    You are an expert job application tracker. Analyze the following ${threads.length} email threads and extract details for each.
    
    CRITICAL: First determine if the thread is "junk". 
    "junk" includes: mass marketing emails, weekly job alerts, "people are hiring" notifications, ads, newsletters, or generic platform updates.
    
    If NOT junk, extract the following:
    - "status": MUST be one of: "applied", "interview", "rejected", "offer", "junk".
    - "company": Name of the hiring company.
    - "role": Job title (e.g., "Software Engineer").
    
    STATUS LOGIC:
    - "offer": Official job offer, congratulations, or onboarding steps.
    - "rejected": Explicitly stating they are not moving forward or you weren't selected.
    - "interview": Any mention of scheduling, video calls, Zoom, Calendly, or "next steps" that involve a meeting.
    - "applied": Application confirmations or acknowledgement of receipt.
    
    IMPORTANT: Base the "status" on the LATEST message in the thread.
    
    Return a JSON array of objects with keys: "id", "status", "company", "role".
    
    Threads to analyze:
    ${threads.map((t) => `
    ID: ${t.id}
    Subject: ${t.subject}
    Sender: ${t.sender}
    Messages (Oldest to Newest):
    ${t.messages.map((m, j) => `  ${j + 1}. [${m.date}] ${m.body}`).join("\n")}
    `).join("\n---")}
  `

  // 1. Try Groq first (it's much faster)
  if (groq) {
    try {
      console.log("[Pipeline] Attempting with Groq (Llama 3)...")
      const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      })
      
      const content = response.choices[0].message.content
      if (content) {
        const parsed = JSON.parse(content)
        const results = Array.isArray(parsed) ? parsed : (parsed.threads || Object.values(parsed)[0])
        if (Array.isArray(results)) return results
      }
    } catch (error) {
      console.warn("[Pipeline] Groq failed, falling back to Gemini:", error)
    }
  }

  // 2. Try Gemini Models as secondary
  for (const modelName of modelNames) {
    try {
      console.log(`[Pipeline] Attempting with Gemini ${modelName}...`)
      const currentModel = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: "application/json" }
      })

      const result = await currentModel.generateContent(prompt)
      const response = await result.response
      const text = response.text()
      const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim()
      const parsed = JSON.parse(cleaned)
      if (Array.isArray(parsed)) return parsed
    } catch (error: any) {
      console.warn(`[Pipeline] Gemini ${modelName} failed:`, error.message || error)
      if (error.status === 429 || error.status === 404) continue 
    }
  }

  // 3. Final Local Fallback
  console.warn("[Pipeline] All AI models failed. Using local fallback extraction...")
  return threads.map(t => {
    const fallback = localFallback(t)
    return {
      id: t.id,
      status: fallback.status,
      company: fallback.company,
      role: fallback.role
    }
  })
}

function localFallback(thread: ThreadContext): { company: string; role: string; status: Application["status"] | "junk" } {
  const subject = thread.subject.toLowerCase()
  const latestMessage = thread.messages[thread.messages.length - 1]?.body.toLowerCase() || ""
  const combined = `${subject} ${latestMessage}`

  let status: Application["status"] | "junk" = "applied"
  
  if (STATUS_KEYWORDS.offer.some(k => combined.includes(k))) status = "offer"
  else if (STATUS_KEYWORDS.rejected.some(k => combined.includes(k))) status = "rejected"
  else if (STATUS_KEYWORDS.interview.some(k => combined.includes(k))) status = "interview"
  
  // Improved company extraction
  let company = "Unknown"
  const atMatch = thread.subject.match(/at ([\w\s&.-]+)/i)
  if (atMatch) company = atMatch[1].trim()
  
  if (company === "Unknown") {
    const dashMatch = thread.subject.match(/^([\w\s&.-]+) -/i)
    if (dashMatch) company = dashMatch[1].trim()
  }

  if (company === "Unknown") {
    if (thread.sender.includes("greenhouse")) company = "ATS (Greenhouse)"
    if (thread.sender.includes("workday")) company = "ATS (Workday)"
  }

  // Improved role extraction
  let role = "Software Engineer"
  const forMatch = thread.subject.match(/for ([\w\s&.-]+) at/i) || thread.subject.match(/for ([\w\s&.-]+) application/i)
  if (forMatch) role = forMatch[1].trim()
  else {
    const commonRoles = ["frontend", "backend", "fullstack", "full stack", "developer", "engineer", "designer", "manager"]
    for (const r of commonRoles) {
      if (subject.includes(r)) {
        role = r.charAt(0).toUpperCase() + r.slice(1) + " Engineer"
        break
      }
    }
  }

  // Final cleanup
  company = company.replace(/application|update|status|role|position/gi, "").trim()
  role = role.replace(/application|update|status/gi, "").trim()

  return { company, role, status }
}

function detectSource(sender: string): string {
  const s = sender.toLowerCase()
  if (s.includes("linkedin")) return "LinkedIn"
  if (s.includes("indeed")) return "Indeed"
  if (s.includes("jobstreet")) return "Jobstreet"
  if (s.includes("workday")) return "Workday"
  if (s.includes("greenhouse")) return "Greenhouse"
  if (s.includes("lever.co")) return "Lever"
  if (s.includes("smartrecruiters")) return "SmartRecruiters"
  if (s.includes("recruitee")) return "Recruitee"
  if (s.includes("ashby")) return "Ashby"
  return "Direct"
}

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const after = searchParams.get("after") || "2026/01/01"

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    )
    oauth2Client.setCredentials({ access_token: session.accessToken })

    const gmail = google.gmail({ version: "v1", auth: oauth2Client })

    // Targeted queries to reduce noise
    const queries = [
      `from:(greenhouse.io OR workday.com OR smartrecruiters.com OR lever.co OR ashbyhq.com OR breezy.hr) application after:${after}`,
      `("interview" OR "schedule" OR "video call" OR "zoom" OR "google meet" OR "calendly" OR "availability") ("application" OR "role" OR "position" OR "opportunity") -category:promotions after:${after}`,
      `("unfortunately" OR "not selected" OR "not moving forward" OR "thank you for your interest") ("application" OR "position") after:${after}`,
      `("offer letter" OR "congratulations" OR "pleased to offer" OR "onboarding") after:${after}`,
      `("thank you for applying" OR "received your application") after:${after}`
    ]

    const allThreadIds = new Set<string>()
    for (const q of queries) {
      const res = await gmail.users.threads.list({ userId: "me", q, maxResults: 100 })
      res.data.threads?.forEach(t => t.id && allThreadIds.add(t.id))
    }

    const threadDetails: ThreadContext[] = []

    for (const threadId of Array.from(allThreadIds)) {
      try {
        const threadData = await gmail.users.threads.get({
          userId: "me",
          id: threadId,
          format: "full",
        })

        const messages = threadData.data.messages || []
        if (messages.length === 0) continue

        const firstMsg = messages[0]
        const subject = firstMsg.payload?.headers?.find(h => h.name === "Subject")?.value || "No Subject"
        const sender = firstMsg.payload?.headers?.find(h => h.name === "From")?.value || ""
        const date = firstMsg.payload?.headers?.find(h => h.name === "Date")?.value || ""

        const processedMessages: MessageContent[] = messages.map(m => ({
          id: m.id!,
          date: new Date(m.payload?.headers?.find(h => h.name === "Date")?.value || "").toISOString(),
          sender: m.payload?.headers?.find(h => h.name === "From")?.value || "",
          body: truncateBody(cleanBody(extractBody(m.payload))),
          snippet: m.snippet || ""
        }))

        const score = getSenderScore(sender)

        threadDetails.push({
          id: threadId,
          subject,
          sender,
          date: new Date(date).toISOString(),
          messages: processedMessages,
          score
        })
      } catch (err) {
        console.warn(`[Sync] Failed to fetch thread ${threadId}:`, err)
      }
    }

    const filteredThreads = threadDetails.filter(t => {
      if (t.score >= 2) return true
      if (t.score < -2) return false
      const s = t.subject.toLowerCase()
      const hasJobKeyword = /application|interview|offer|rejected|opportunity|role|position/.test(s)
      const hasAdKeyword = /job alert|recommended|weekly digest|hiring now/.test(s)
      return hasJobKeyword && !hasAdKeyword
    })

    // Batch classify with Gemini or Groq
    const BATCH_SIZE = 10 // Reduced to 10 for better token management on Groq
    const results: { id: string; status: Application["status"] | "junk"; company: string; role: string }[] = []
    
    for (let i = 0; i < filteredThreads.length; i += BATCH_SIZE) {
      const batch = filteredThreads.slice(i, i + BATCH_SIZE)
      const classifications = await processPipelineBatch(batch)
      results.push(...classifications)
    }

    const applications: Application[] = filteredThreads.map(t => {
      const classification = results.find(r => r.id === t.id)
      if (!classification || classification.status === "junk") return null

      return {
        id: t.id,
        company: classification.company,
        role: classification.role,
        status: classification.status as Application["status"],
        source: detectSource(t.sender),
        date: t.date,
        subject: t.subject
      }
    }).filter((app): app is Application => !!app && app.company !== "Unknown")

    const uniqueApps = Array.from(new Map(applications.map(a => [a.id, a])).values())
    uniqueApps.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return NextResponse.json({ applications: uniqueApps, total: uniqueApps.length })
  } catch (error: unknown) {
    console.error("Gmail sync error:", error)
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

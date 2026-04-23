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
  status: "applied" | "responded" | "interview" | "rejected" | "offer"
  source: string
  date: string
  subject: string
}

import { OpenAI } from "openai"
import { ENV_CONFIG } from "@/lib/env-config"

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || ENV_CONFIG.GOOGLE_GEMINI_API_KEY)

// Groq client (OpenAI compatible)
const groqKey = process.env.GROQ_API_KEY || ENV_CONFIG.GROQ_API_KEY
const groq = groqKey
  ? new OpenAI({ 
      apiKey: groqKey, 
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
    - "status": MUST be one of: "applied", "responded", "interview", "rejected", "offer", "junk".
    - "company": Name of the hiring company.
    - "role": Job title (e.g., "Software Engineer").
    
    STATUS LOGIC:
    - "offer": Official job offer, congratulations, or onboarding steps.
    - "rejected": Explicitly stating they are not moving forward or you weren't selected.
    - "interview": Any mention of scheduling, video calls, Zoom, Calendly, or "next steps" that involve a meeting.
    - "responded": Company has replied but it's NOT clearly an interview, offer, or rejection. Includes: recruiter saying they'll review your profile, asking clarifying questions, sending assessments or technical tests, generic "we'll get back to you" replies, or any acknowledgement beyond the initial application confirmation.
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
      console.log(`[Pipeline] Attempting ${threads.length} threads with Groq...`)
      const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0 // CRITICAL: Deterministic output
      })
      
      const content = response.choices[0].message.content
      if (content) {
        const parsed = JSON.parse(content)
        const results = Array.isArray(parsed) ? parsed : (parsed.threads || Object.values(parsed)[0])
        if (Array.isArray(results)) {
          // Map results by ID, but fallback to index if AI mangled IDs
          return threads.map((t, idx) => {
            const found = results.find(r => r.id === t.id) || results[idx]
            return {
              id: t.id,
              status: found?.status || "junk",
              company: found?.company || "Unknown",
              role: found?.role || "Software Engineer"
            }
          })
        }
      }
    } catch (error) {
      console.warn("[Pipeline] Groq failed, falling back to Gemini:", error)
    }
  }

  // 2. Try Gemini Models as secondary
  for (const modelName of modelNames) {
    try {
      console.log(`[Pipeline] Attempting ${threads.length} threads with Gemini ${modelName}...`)
      const currentModel = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { 
          responseMimeType: "application/json",
          temperature: 0 // CRITICAL: Deterministic output
        }
      })

      const result = await currentModel.generateContent(prompt)
      const response = await result.response
      const text = response.text()
      const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim()
      const parsed = JSON.parse(cleaned)
      const results = Array.isArray(parsed) ? parsed : (parsed.threads || Object.values(parsed)[0])
      
      if (Array.isArray(results)) {
        return threads.map((t, idx) => {
          const found = results.find(r => r.id === t.id) || results[idx]
          return {
            id: t.id,
            status: found?.status || "junk",
            company: found?.company || "Unknown",
            role: found?.role || "Software Engineer"
          }
        })
      }
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
  else if (STATUS_KEYWORDS.responded.some(k => combined.includes(k))) status = "responded"
  
  // Improved company extraction
  let company = "Unknown"
  const atMatch = thread.subject.match(/at ([\w\s&.-]+)/i)
  if (atMatch) company = atMatch[1].trim()
  
  if (company === "Unknown" || company === "") {
    const dashMatch = thread.subject.match(/^([\w\s&.-]+) -/i)
    if (dashMatch) company = dashMatch[1].trim()
  }

  // Domain-based fallback for company
  if (company === "Unknown" || company === "") {
    const domain = thread.sender.split("@")[1]?.split(">")[0]?.toLowerCase()
    if (domain && !["gmail.com", "outlook.com", "yahoo.com", "hotmail.com"].includes(domain)) {
      company = domain.split(".")[0].charAt(0).toUpperCase() + domain.split(".")[0].slice(1)
    }
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
  const mode = searchParams.get("mode") || "sync"
  const perQueryCap = mode === "onboard" ? 500 : 100

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: any) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      try {
        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET
        )
        oauth2Client.setCredentials({ access_token: session.accessToken })

        const gmail = google.gmail({ version: "v1", auth: oauth2Client })

        send("status", { message: "Searching Gmail for job emails...", phase: "fetch" })

        // Targeted queries
        const queries = [
          `from:(greenhouse.io OR workday.com OR smartrecruiters.com OR lever.co OR ashbyhq.com OR breezy.hr OR linkedin.com OR indeed.com) application after:${after}`,
          `("interview" OR "schedule" OR "video call" OR "zoom" OR "google meet" OR "calendly" OR "availability") ("application" OR "role" OR "position" OR "opportunity") -category:promotions after:${after}`,
          `("unfortunately" OR "not selected" OR "not moving forward" OR "thank you for your interest") ("application" OR "position") after:${after}`,
          `("offer letter" OR "congratulations" OR "pleased to offer" OR "onboarding") after:${after}`,
          `("thank you for applying" OR "received your application") after:${after}`,
          `subject:("application received" OR "application update") after:${after}`
        ]

        const allThreadIds = new Set<string>()
        for (const q of queries) {
          let pageToken: string | undefined = undefined
          let count = 0
          
          do {
            const res = await gmail.users.threads.list({ 
              userId: "me", 
              q, 
              maxResults: 100,
              pageToken
            })
            
            res.data.threads?.forEach(t => t.id && allThreadIds.add(t.id))
            pageToken = res.data.nextPageToken as string | undefined
            count += res.data.threads?.length || 0
            
            if (count >= perQueryCap) break
          } while (pageToken)
        }

        if (allThreadIds.size === 0) {
          send("done", { total: 0, message: "No job-related emails found since " + after })
          controller.close()
          return
        }

        send("status", { message: `Found ${allThreadIds.size} potential threads. Fetching details...`, phase: "fetch_details", total: allThreadIds.size })

        const threadDetails: ThreadContext[] = []
        let fetchedCount = 0

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
            
            fetchedCount++
            if (fetchedCount % 10 === 0) {
              send("status", { message: `Fetched ${fetchedCount}/${allThreadIds.size} threads...`, phase: "fetch_details" })
            }
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

        if (filteredThreads.length === 0) {
          send("done", { total: 0, message: "No job-related threads passed filtering." })
          controller.close()
          return
        }

        const BATCH_SIZE = 10 
        const totalBatches = Math.ceil(filteredThreads.length / BATCH_SIZE)
        let totalProcessed = 0

        for (let i = 0; i < filteredThreads.length; i += BATCH_SIZE) {
          const batch = filteredThreads.slice(i, i + BATCH_SIZE)
          const batchNum = Math.floor(i / BATCH_SIZE) + 1
          
          send("status", { 
            message: `Classifying batch ${batchNum} of ${totalBatches}...`, 
            phase: "classify",
            batch: batchNum,
            totalBatches
          })

          const results = await processPipelineBatch(batch)
          
          const batchApps = batch.map(t => {
            const classification = results.find(r => r.id === t.id)
            if (!classification || classification.status === "junk") return null

            return {
              id: t.id,
              company: classification.company === "Unknown" ? "Unknown Company" : classification.company,
              role: classification.role,
              status: classification.status as Application["status"],
              source: detectSource(t.sender),
              date: t.date,
              subject: t.subject
            }
          }).filter((app): app is Application => !!app)

          send("batch", { 
            applications: batchApps, 
            batchIndex: batchNum, 
            totalBatches 
          })
          
          totalProcessed += batchApps.length
        }

        send("done", { total: totalProcessed, mode })
      } catch (error: any) {
        console.error("Gmail sync error:", error)
        send("error", { message: error.message || "An unknown error occurred" })
      } finally {
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    }
  })
}

import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { google } from "googleapis"
import { GoogleGenerativeAI } from "@google/generative-ai"

export interface Application {
  id: string
  company: string
  role: string
  status: "applied" | "viewed" | "review" | "interview" | "rejected" | "offer"
  source: string
  date: string
  subject: string
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!)

async function classifyThreadsBatch(threads: { id: string; subject: string; snippets: string[] }[]) {
  if (threads.length === 0) return []

  const modelNames = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-2.5-flash-lite",
    "gemini-2.5-pro",
  ]

  const prompt = `
    You are an expert job application tracker. Analyze the following ${threads.length} email threads and extract details for each.
    
    For each thread, determine the "status". It MUST be exactly one of: "applied", "viewed", "review", "interview", "rejected", "offer", "junk".
    
    CRITERIA:
    - "junk": Use this for ads, newsletters, marketing, promotional emails, or anything NOT related to a specific job application you made. If it looks like a mass email from LinkedIn or Indeed about "jobs you might like", it is JUNK.
    - "offer": Contains "congratulations", "job offer", "offer letter", "we are pleased to offer", "onboarding".
    - "rejected": Contains "unable to offer", "not moving forward", "not selected", "unfortunately", "thank you for your interest", "will not be proceeding".
    - "interview": Invitation to interview, schedule a chat, interview confirmation, calendar invite, "next steps" involving a meeting, technical test, assessment, or specific availability request. Look for mentions of "Zoom", "Google Meet", "Teams", or "Calendly".
    - "review": Specifically says the application is "under review" or "moving to the next stage".
    - "viewed": Explicitly says "employer viewed your application".
    - "applied": Application confirmations, "received your application", "thank you for applying".
    
    Also extract:
    - "company": Name of the company.
    - "role": Job title (e.g., "Software Engineer").
    
    Return a JSON array of objects with keys: "id", "status", "company", "role".
    
    Threads to analyze:
    ${threads.map((t) => `
    ID: ${t.id}
    Subject: ${t.subject}
    Snippets:
    ${t.snippets.map((s, j) => `  ${j + 1}. ${s}`).join("\n")}
    `).join("\n---")}
  `

  for (const modelName of modelNames) {
    try {
      console.log(`[Sync] Attempting classification with ${modelName}...`)
      const currentModel = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: "application/json" }
      })

      const result = await currentModel.generateContent(prompt)
      const response = await result.response
      const text = response.text()

      try {
        const parsed = JSON.parse(text)
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.log(`[Sync] Successfully classified ${parsed.length} threads with ${modelName}`)
          return parsed
        }
      } catch (parseError) {
        console.warn(`[Sync] JSON parse error with ${modelName}. Attempting regex fallback...`)
        const jsonMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/)
        if (jsonMatch) {
          const extractedJson = JSON.parse(jsonMatch[0])
          console.log(`[Sync] Successfully extracted ${extractedJson.length} threads via regex from ${modelName}`)
          return extractedJson
        }
      }
    } catch (error: any) {
      console.warn(`[Sync] Model ${modelName} failed:`, error.message || error)
      continue
    }
  }

  console.error("[Sync] All Gemini models failed to classify batch")
  return []
}

function detectSource(sender: string): string {
  if (/linkedin/i.test(sender)) return "LinkedIn"
  if (/indeed/i.test(sender)) return "Indeed"
  if (/jobstreet/i.test(sender)) return "Jobstreet"
  if (/workday/i.test(sender)) return "Workday"
  if (/greenhouse/i.test(sender)) return "Greenhouse"
  if (/smartrecruiters/i.test(sender)) return "SmartRecruiters"
  if (/recruitee/i.test(sender)) return "Recruitee"
  if (/talentlyft/i.test(sender)) return "TalentLyft"
  return "Direct"
}

function fallbackExtraction(subject: string): { company: string; role: string; status: Application["status"] | "junk" } {
  let company = "Unknown"
  let role = "Software Engineer"
  let status: Application["status"] | "junk" = "applied"

  const s = subject.toLowerCase()
  
  // Junk detection in subject
  const junkKeywords = ["job alert", "recommended for you", "hiring now", "new jobs", "weekly digest", "top picks", "invitation to join"]
  if (junkKeywords.some(k => s.includes(k))) {
    status = "junk"
  }

  if (s.includes("interview") || s.includes("chat") || s.includes("next steps") || s.includes("booked") || s.includes("availability") || s.includes("invitation to") || s.includes("meeting")) {
    status = "interview"
  } else if (s.includes("offer") || s.includes("congratulations")) {
    status = "offer"
  } else if (s.includes("unfortunately") || s.includes("not selected") || s.includes("moving forward") || s.includes("thank you for your interest")) {
    status = "rejected"
  }

  // Role extraction first
  const rolePatterns = [
    /for ([\w\s&.+-]+) at/i,
    /for ([\w\s&.+-]+) application/i,
    /as ([\w\s&.+-]+)/i,
    /Indeed Application:\s*([\w\s&.+-]+)/i,
    /Application:\s*([\w\s&.+-]+)/i,
  ]

  for (const pattern of rolePatterns) {
    const match = subject.match(pattern)
    if (match && match[1]) {
      role = match[1].trim()
      break
    }
  }

  // Company extraction
  const companyPatterns = [
    /with ([\w\s&.]+)!/i,
    /sent to ([\w\s&.]+)/i,
    /from ([\w\s&.]+)/i,
    /at ([\w\s&.]+)/i,
    /application with ([\w\s&.]+)/i,
    /Applying to ([\w\s&.]+)/i,
    /viewed by ([\w\s&.]+)/i,
    /^([^-\n]+)\s*-\s*Application/i,
  ]

  for (const pattern of companyPatterns) {
    const match = subject.match(pattern)
    if (match && match[1]) {
      const candidate = match[1].trim()
      if (candidate.toLowerCase() !== role.toLowerCase() && candidate.length > 2) {
        company = candidate
        break
      }
    }
  }

  if (subject.includes("Indeed Application:")) {
    const parts = subject.split("Indeed Application:")[1].split("-")
    if (parts.length > 1) {
      company = parts[parts.length - 1].trim()
    } else if (company === "Unknown") {
      company = "Indeed"
    }
  }

  if (company === "Unknown" && subject.toLowerCase().includes("thank you for applying")) {
    company = "Career Opportunity"
  }

  if (company.length > 50) company = company.substring(0, 50)

  return { company, role, status }
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

    const query = `(application OR interview OR offer OR "thank you for applying" OR "received your" OR "moving forward" OR "not selected" OR "your application" OR confirmation OR received OR "next steps" OR schedule OR "video call" OR zoom OR calendly OR invitation) -category:promotions -category:social after:${after}`

    const threadsRes = await gmail.users.threads.list({
      userId: "me",
      q: query,
      maxResults: 500,
    })

    const gmailThreads = threadsRes.data.threads || []
    const threadDetails = []

    for (const thread of gmailThreads) {
      const threadData = await gmail.users.threads.get({
        userId: "me",
        id: thread.id!,
        format: "metadata",
        metadataHeaders: ["Subject", "From", "Date"],
      })

      const messages = threadData.data.messages || []
      const subject = messages[0]?.payload?.headers?.find(h => h.name === "Subject")?.value || "No Subject"
      const date = messages[0]?.payload?.headers?.find(h => h.name === "Date")?.value || ""
      const sender = messages[0]?.payload?.headers?.find(h => h.name === "From")?.value || ""
      const snippets = messages.map(m => m.snippet || "").filter(Boolean)

      threadDetails.push({
        id: thread.id!,
        subject,
        date: new Date(date).toISOString(),
        source: detectSource(sender),
        snippets
      })
    }

    // Batch classify with Gemini (max 25 per batch to be safe)
    const BATCH_SIZE = 25
    const results: { id: string; status: Application["status"]; company: string; role: string }[] = []
    for (let i = 0; i < threadDetails.length; i += BATCH_SIZE) {
      const batch = threadDetails.slice(i, i + BATCH_SIZE)
      const classifications = await classifyThreadsBatch(batch)
      results.push(...classifications)
    }

    const applications: Application[] = threadDetails.map(t => {
      const classification = results.find(r => r.id === t.id)

      if (classification?.status === "junk") return null

      let company = classification?.company || "Unknown"
      let role = classification?.role || "Software Engineer"
      let status: Application["status"] | "junk" = (classification?.status as Application["status"]) || "applied"

      // Fallback if Gemini failed or company is unknown
      if (company === "Unknown" || company === "") {
        const fallback = fallbackExtraction(t.subject)
        company = fallback.company
        role = fallback.role
        if (!classification || classification.status === "applied") {
          status = fallback.status
        }
      }

      if (status === "junk") return null

      // Final ad check on company name and subject
      const adKeywords = ["linkedin", "indeed", "job alert", "career opportunity", "hiring now", "weekly digest", "recommended for you"]
      const isAd = adKeywords.some(k => company.toLowerCase().includes(k) || t.subject.toLowerCase().includes(k))
      
      if (isAd && status === "applied") {
        return null
      }

      return {
        id: t.id,
        company,
        role,
        status: status as Application["status"],
        source: t.source,
        date: t.date,
        subject: t.subject
      }
    }).filter((app): app is Application => {
      if (!app) return false
      const isKnown = app.company !== "Unknown" && app.company !== ""
      return isKnown
    })

    // Keep unique by thread ID (to avoid duplicates from Gmail list, though list should be unique)
    const uniqueApps = Array.from(new Map(applications.map(a => [a.id, a])).values())

    uniqueApps.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return NextResponse.json({ applications: uniqueApps, total: uniqueApps.length })
  } catch (error: unknown) {
    console.error("Gmail sync error:", error)
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

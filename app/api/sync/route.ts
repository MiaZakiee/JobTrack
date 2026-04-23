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
    "gemini-1.5-flash",
    "gemini-1.5-flash-001",
    "gemini-1.5-pro",
    "gemini-pro"
  ]

  const prompt = `
    You are an expert job application tracker. Analyze the following ${threads.length} email threads and extract details for each.
    
    For each thread, determine:
    1. status: Must be exactly one of: "applied", "viewed", "review", "interview", "rejected", "offer".
       - "offer": Explicit job offer or "congratulations".
       - "rejected": "unable to offer", "not moving forward", "not selected", "unfortunately", "thank you for your interest but", etc.
       - "interview": Invitation to chat, schedule a call, interview confirmation, or "next steps".
       - "review": "under review", "reviewing your application", or "status update".
       - "viewed": "employer viewed your application".
       - "applied": Initial application receipt or confirmation.
    2. company: The name of the company. Look at the Subject, Sender, and Snippets. If you can't find it, use "Unknown".
    3. role: The job title (e.g., "Software Engineer"). If not specified, use "Software Engineer" as a default if it seems like a tech job.
    
    Return a JSON array of objects with keys: "id", "status", "company", "role".
    
    Threads:
    ${threads.map((t) => `
    ID: ${t.id}
    Subject: ${t.subject}
    Messages:
    ${t.snippets.map((s, j) => `  ${j + 1}. ${s}`).join("\n")}
    `).join("\n---")}
  `

  for (const modelName of modelNames) {
    try {
      const currentModel = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: "application/json" }
      })

      const result = await currentModel.generateContent(prompt)
      const response = await result.response
      const text = response.text()

      try {
        const parsed = JSON.parse(text)
        return parsed
      } catch (parseError) {
        console.error(`Gemini JSON parse error with ${modelName}. Raw response:`, text)
        const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/)
        if (jsonMatch) {
          return JSON.parse(jsonMatch[1])
        }
      }
    } catch (error: any) {
      console.warn(`Model ${modelName} failed:`, error.message || error)
      // If it's a 404, we continue to the next model
      if (error.status === 404 || error.message?.includes("404")) {
        continue
      }
      // If it's something else (like quota), we might want to stop, but for now we continue
      continue
    }
  }

  console.error("All Gemini models failed to classify batch")
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

function fallbackExtraction(subject: string): { company: string; role: string } {
  let company = "Unknown"
  let role = "Software Engineer"

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
    /^([^-\n]+)\s*-\s*Application/i, // "Company - Application Received"
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

  // Special case for Indeed
  if (subject.includes("Indeed Application:")) {
    const parts = subject.split("Indeed Application:")[1].split("-")
    if (parts.length > 1) {
      company = parts[parts.length - 1].trim()
    } else if (company === "Unknown") {
      company = "Indeed"
    }
  }

  // Fallback for "Thank you for applying" without company name
  if (company === "Unknown" && subject.toLowerCase().includes("thank you for applying")) {
    company = "Career Opportunity"
  }

  if (company.length > 50) company = company.substring(0, 50)

  return { company, role }
}

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const after = searchParams.get("after") || "2026/03/01"

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    )
    oauth2Client.setCredentials({ access_token: session.accessToken })

    const gmail = google.gmail({ version: "v1", auth: oauth2Client })

    const query = `(application OR interview OR offer OR "thank you for applying" OR "received your" OR "moving forward" OR "not selected" OR "your application" OR confirmation OR received) after:${after}`

    const threadsRes = await gmail.users.threads.list({
      userId: "me",
      q: query,
      maxResults: 200,
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

      let company = classification?.company || "Unknown"
      let role = classification?.role || "Software Engineer"

      // Fallback if Gemini failed or company is unknown
      if (company === "Unknown" || company === "") {
        const fallback = fallbackExtraction(t.subject)
        company = fallback.company
        role = fallback.role
      }

      return {
        id: t.id,
        company,
        role,
        status: classification?.status || "applied",
        source: t.source,
        date: t.date,
        subject: t.subject
      }
    }).filter(app => {
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

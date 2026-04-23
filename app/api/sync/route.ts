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
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  generationConfig: { responseMimeType: "application/json" }
})

async function classifyThreadsBatch(threads: { id: string; subject: string; snippets: string[] }[]) {
  if (threads.length === 0) return []

  const prompt = `
    You are an expert job application tracker. Analyze the following ${threads.length} email threads and extract details for each.
    
    For each thread, determine:
    1. status: Must be exactly one of: "applied", "viewed", "review", "interview", "rejected", "offer".
       - "offer": Explicit job offer or "congratulations".
       - "rejected": "unable to offer", "not moving forward", "not selected", "unfortunately", etc.
       - "interview": Invitation to chat, schedule a call, or interview confirmation.
       - "review": "under review", "reviewing your application".
       - "viewed": "employer viewed your application".
       - "applied": Initial application receipt.
    2. company: The name of the company.
    3. role: The job title (e.g., "Software Engineer").
    
    Return a JSON array of objects with keys: "id", "status", "company", "role".
    
    Threads:
    ${threads.map((t) => `
    ID: ${t.id}
    Subject: ${t.subject}
    Messages:
    ${t.snippets.map((s, j) => `  ${j + 1}. ${s}`).join("\n")}
    `).join("\n---")}
  `

  try {
    const result = await model.generateContent(prompt)
    const response = await result.response
    return JSON.parse(response.text())
  } catch (error) {
    console.error("Gemini classification error:", error)
    return []
  }
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

    const query = `(subject:application OR subject:applied OR subject:interview OR subject:offer OR "thank you for applying" OR "your application" OR "application was sent" OR "application was viewed") after:${after}`

    const threadsRes = await gmail.users.threads.list({
      userId: "me",
      q: query,
      maxResults: 50,
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
      return {
        id: t.id,
        company: classification?.company || "Unknown",
        role: classification?.role || "Software Engineer",
        status: classification?.status || "applied",
        source: t.source,
        date: t.date,
        subject: t.subject
      }
    }).filter(app => app.company !== "Unknown")

    // Remove duplicates (same company + role)
    const uniqueApps = Array.from(new Map(applications.map(a => [`${a.company.toLowerCase()}|${a.role.toLowerCase()}`, a])).values())

    uniqueApps.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return NextResponse.json({ applications: uniqueApps, total: uniqueApps.length })
  } catch (error: unknown) {
    console.error("Gmail sync error:", error)
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

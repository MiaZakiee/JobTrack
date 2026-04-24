import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { google } from "googleapis"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { getSenderScore } from "@/lib/sender-registry"
import { STATUS_KEYWORDS } from "@/lib/status-resolver"
import { ThreadContext, MessageContent, extractBody, cleanBody, truncateBody } from "@/lib/email-pipeline"
import { OpenAI } from "openai"

export interface Application {
  id: string
  company: string
  role: string
  status: "applied" | "responded" | "interview" | "rejected" | "offer"
  source: string
  date: string
  subject: string
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!)
const groq = process.env.GROQ_API_KEY
  ? new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: "https://api.groq.com/openai/v1" })
  : null

// ─── Phase 1: Discover thread IDs ───
async function discoverThreads(accessToken: string, after: string, mode: string) {
  const perQueryCap = mode === "onboard" ? 500 : 100
  const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET)
  oauth2Client.setCredentials({ access_token: accessToken })
  const gmail = google.gmail({ version: "v1", auth: oauth2Client })

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
      const res = await gmail.users.threads.list({ userId: "me", q, maxResults: 100, pageToken })
      res.data.threads?.forEach(t => t.id && allThreadIds.add(t.id))
      pageToken = res.data.nextPageToken as string | undefined
      count += res.data.threads?.length || 0
      if (count >= perQueryCap) break
    } while (pageToken)
  }

  return Array.from(allThreadIds)
}

// ─── Phase 2: Fetch + Classify a batch of threads ───
async function processThreadBatch(accessToken: string, threadIds: string[]): Promise<Application[]> {
  const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET)
  oauth2Client.setCredentials({ access_token: accessToken })
  const gmail = google.gmail({ version: "v1", auth: oauth2Client })

  // Fetch thread details
  const threadDetails: ThreadContext[] = []
  for (const threadId of threadIds) {
    try {
      const threadData = await gmail.users.threads.get({ userId: "me", id: threadId, format: "full" })
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

      threadDetails.push({
        id: threadId, subject, sender,
        date: new Date(date).toISOString(),
        messages: processedMessages,
        score: getSenderScore(sender)
      })
    } catch (err) {
      console.warn(`[Sync] Failed to fetch thread ${threadId}:`, err)
    }
  }

  // Filter
  const filtered = threadDetails.filter(t => {
    if (t.score >= 2) return true
    if (t.score < -2) return false
    const s = t.subject.toLowerCase()
    return /application|interview|offer|rejected|opportunity|role|position/.test(s) &&
      !/job alert|recommended|weekly digest|hiring now/.test(s)
  })

  if (filtered.length === 0) return []

  // Classify
  const results = await classifyBatch(filtered)

  return filtered.map(t => {
    const c = results.find(r => r.id === t.id)
    if (!c || c.status === "junk") return null
    return {
      id: t.id,
      company: c.company === "Unknown" ? "Unknown Company" : c.company,
      role: c.role,
      status: c.status as Application["status"],
      source: detectSource(t.sender),
      date: t.date,
      subject: t.subject
    }
  }).filter((app): app is Application => !!app)
}

// ─── AI Classification ───
async function classifyBatch(threads: ThreadContext[]) {
  if (threads.length === 0) return []

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
    - "responded": Company has replied but it's NOT clearly an interview, offer, or rejection.
    - "applied": Application confirmations or acknowledgement of receipt.
    
    IMPORTANT: Base the "status" on the LATEST message in the thread.
    
    Return a JSON array of objects with keys: "id", "status", "company", "role".
    
    Threads to analyze:
    ${threads.map(t => `
    ID: ${t.id}
    Subject: ${t.subject}
    Sender: ${t.sender}
    Messages (Oldest to Newest):
    ${t.messages.map((m, j) => `  ${j + 1}. [${m.date}] ${m.body}`).join("\n")}
    `).join("\n---")}
  `

  // Try Groq first
  if (groq) {
    try {
      const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0
      })
      const content = response.choices[0].message.content
      if (content) {
        const parsed = JSON.parse(content)
        const results = Array.isArray(parsed) ? parsed : (parsed.threads || Object.values(parsed)[0])
        if (Array.isArray(results)) {
          return threads.map((t, idx) => {
            const found = results.find((r: any) => r.id === t.id) || results[idx]
            return { id: t.id, status: found?.status || "junk", company: found?.company || "Unknown", role: found?.role || "Software Engineer" }
          })
        }
      }
    } catch (error) {
      console.warn("[Pipeline] Groq failed:", error)
    }
  }

  // Try Gemini
  for (const modelName of ["models/gemini-2.0-flash", "models/gemini-1.5-flash", "models/gemini-1.5-pro"]) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName, generationConfig: { responseMimeType: "application/json", temperature: 0 } })
      const result = await model.generateContent(prompt)
      const text = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim()
      const parsed = JSON.parse(text)
      const results = Array.isArray(parsed) ? parsed : (parsed.threads || Object.values(parsed)[0])
      if (Array.isArray(results)) {
        return threads.map((t, idx) => {
          const found = results.find((r: any) => r.id === t.id) || results[idx]
          return { id: t.id, status: found?.status || "junk", company: found?.company || "Unknown", role: found?.role || "Software Engineer" }
        })
      }
    } catch (error: any) {
      console.warn(`[Pipeline] Gemini ${modelName} failed:`, error.message || error)
      if (error.status === 429 || error.status === 404) continue
    }
  }

  // Local fallback
  return threads.map(t => {
    const fb = localFallback(t)
    return { id: t.id, status: fb.status, company: fb.company, role: fb.role }
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

  let company = "Unknown"
  const atMatch = thread.subject.match(/at ([\w\s&.-]+)/i)
  if (atMatch) company = atMatch[1].trim()
  if (company === "Unknown" || company === "") {
    const dashMatch = thread.subject.match(/^([\w\s&.-]+) -/i)
    if (dashMatch) company = dashMatch[1].trim()
  }
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

  let role = "Software Engineer"
  const forMatch = thread.subject.match(/for ([\w\s&.-]+) at/i) || thread.subject.match(/for ([\w\s&.-]+) application/i)
  if (forMatch) role = forMatch[1].trim()
  else {
    for (const r of ["frontend", "backend", "fullstack", "full stack", "developer", "engineer", "designer", "manager"]) {
      if (subject.includes(r)) { role = r.charAt(0).toUpperCase() + r.slice(1) + " Engineer"; break }
    }
  }

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

// ─── Route Handlers ───

/**
 * POST /api/sync
 * Phase 1 (discover):  { phase: "discover", after, mode }  → { threadIds: string[] }
 * Phase 2 (process):   { phase: "process", threadIds: string[] } → { applications: Application[] }
 */
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const phase = body.phase || "discover"

  if (phase === "discover") {
    const after = body.after || "2026/01/01"
    const mode = body.mode || "sync"
    try {
      const threadIds = await discoverThreads(session.accessToken as string, after, mode)
      return NextResponse.json({ threadIds, total: threadIds.length })
    } catch (error: any) {
      console.error("Discover error:", error)
      return NextResponse.json({ error: error.message || "Failed to discover threads" }, { status: 500 })
    }
  }

  if (phase === "process") {
    const threadIds = body.threadIds as string[]
    if (!threadIds?.length) {
      return NextResponse.json({ applications: [] })
    }
    try {
      const applications = await processThreadBatch(session.accessToken as string, threadIds)
      return NextResponse.json({ applications })
    } catch (error: any) {
      console.error("Process error:", error)
      return NextResponse.json({ error: error.message || "Failed to process batch" }, { status: 500 })
    }
  }

  return NextResponse.json({ error: "Invalid phase" }, { status: 400 })
}

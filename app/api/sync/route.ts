import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { google } from "googleapis"

export interface Application {
  id: string
  company: string
  role: string
  status: "applied" | "viewed" | "review" | "interview" | "rejected" | "offer"
  source: string
  date: string
  subject: string
}

function classifyEmail(subject: string, snippet: string): Application["status"] {
  const t = (subject + " " + snippet).toLowerCase()
  if (/passed|confirmed.*interview|interview.*confirm|your.*interview.*is|interview is all set/i.test(t)) return "interview"
  if (/interview|phone screen|screening call|schedule.*call|zoom invite/i.test(t)) return "interview"
  if (/not.*select|unfortunately|regret|moved.*forward|other candidate|not.*progress|no longer considering/i.test(t)) return "rejected"
  if (/offer|pleased.*offer|congratulations.*offer/i.test(t)) return "offer"
  if (/application.*viewed|viewed.*application/i.test(t)) return "viewed"
  if (/reviewing|under review|we.*receiv|thank you.*applying|application.*receiv|we.*look forward.*review/i.test(t)) return "review"
  if (/application.*sent|sent.*application/i.test(t)) return "applied"
  return "applied"
}

function extractCompany(subject: string, snippet: string): string {
  let m: RegExpMatchArray | null

  m = subject.match(/sent to (.+?)(?:\s*$)/i)
  if (m) return m[1].trim()

  m = subject.match(/application.*?(?:to|with|at)\s+(.+?)(?:\s*[-–!,]|$)/i)
  if (m) return m[1].replace(/[!.,]+$/, "").trim()

  m = subject.match(/(?:thank you for applying to|applying to)\s+(.+?)(?:\s*[-–!.]|$)/i)
  if (m) return m[1].trim()

  m = subject.match(/application.*submitted.*to\s+(.+?)(?:\s*[-–]|$)/i)
  if (m) return m[1].trim()

  m = snippet.match(/(?:to|at|with)\s+([A-Z][^\s,]+(?:\s+[A-Z][^\s,]+){0,3})\s*(?:\.|\!|,|$)/m)
  if (m) return m[1].trim()

  return "Unknown"
}

function extractRole(subject: string): string {
  let m: RegExpMatchArray | null

  m = subject.match(/Indeed Application:\s*(.+)/i)
  if (m) return m[1].trim()

  m = subject.match(/application to (.+?) at /i)
  if (m) return m[1].trim()

  m = subject.match(/application for (?:the\s+)?(.+?)(?:\s*[-–,]|\s+position|\s+role|$)/i)
  if (m) return m[1].trim()

  m = subject.match(/applying.*?(?:for|to)\s+(?:the\s+)?(.+?)(?:\s*role|\s*position|$)/i)
  if (m) return m[1].trim()

  m = subject.match(/^(.+?)\s*[-–]\s*(?:application|confirmation)/i)
  if (m) return m[1].trim()

  return "Software Engineer"
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
      maxResults: 100,
    })

    const threads = threadsRes.data.threads || []
    const applications: Application[] = []
    const seen = new Set<string>()

    const statusPriority: Record<string, number> = {
      offer: 6, interview: 5, rejected: 4, review: 3, viewed: 2, applied: 1,
    }

    for (const thread of threads) {
      const threadData = await gmail.users.threads.get({
        userId: "me",
        id: thread.id!,
        format: "metadata",
        metadataHeaders: ["Subject", "From", "Date"],
      })

      const messages = threadData.data.messages || []
      let bestStatus: Application["status"] = "applied"
      let bestPriority = 0
      let company = ""
      let role = ""
      let date = ""
      let source = "Direct"
      let subject = ""

      for (const msg of messages) {
        const headers = msg.payload?.headers || []
        const subj = headers.find((h) => h.name === "Subject")?.value || ""
        const from = headers.find((h) => h.name === "From")?.value || ""
        const dateStr = headers.find((h) => h.name === "Date")?.value || ""
        const snippet = msg.snippet || ""

        const status = classifyEmail(subj, snippet)
        const priority = statusPriority[status] || 0
        if (priority > bestPriority) {
          bestPriority = priority
          bestStatus = status
        }

        if (!subject) subject = subj
        if (!date) date = new Date(dateStr).toISOString()
        if (!company || company === "Unknown") company = extractCompany(subj, snippet)
        if (!role || role === "Software Engineer") role = extractRole(subj)
        if (source === "Direct") source = detectSource(from)
      }

      if (!company || company === "Unknown") continue

      const key = `${company.toLowerCase()}|${role.toLowerCase()}`
      if (seen.has(key)) continue
      seen.add(key)

      applications.push({
        id: thread.id!,
        company,
        role,
        status: bestStatus,
        source,
        date,
        subject,
      })
    }

    applications.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return NextResponse.json({ applications, total: applications.length })
  } catch (error: any) {
    console.error("Gmail sync error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

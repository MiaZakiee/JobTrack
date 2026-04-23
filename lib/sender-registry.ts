/**
 * sender-registry.ts
 * Logic for identifying and scoring email senders.
 */

export interface SenderScore {
  domain: string
  score: number
  isATS: boolean
  label?: string
}

export const SENDER_REGISTRY: Record<string, SenderScore> = {
  "linkedin.com": { domain: "linkedin.com", score: 0, isATS: false, label: "LinkedIn" },
  "indeed.com": { domain: "indeed.com", score: 0, isATS: false, label: "Indeed" },
  "greenhouse.io": { domain: "greenhouse.io", score: 4, isATS: true, label: "Greenhouse" },
  "lever.co": { domain: "lever.co", score: 4, isATS: true, label: "Lever" },
  "workday.com": { domain: "workday.com", score: 3, isATS: true, label: "Workday" },
  "smartrecruiters.com": { domain: "smartrecruiters.com", score: 4, isATS: true, label: "SmartRecruiters" },
  "jobstreet.com": { domain: "jobstreet.com", score: -1, isATS: false, label: "Jobstreet" },
  "recruitee.com": { domain: "recruitee.com", score: 4, isATS: true, label: "Recruitee" },
  "talentlyft.com": { domain: "talentlyft.com", score: 4, isATS: true, label: "TalentLyft" },
  "breezy.hr": { domain: "breezy.hr", score: 4, isATS: true, label: "Breezy" },
  "ashbyhq.com": { domain: "ashbyhq.com", score: 4, isATS: true, label: "Ashby" },
}

export function getSenderScore(email: string): number {
  const domain = email.split("@")[1]?.toLowerCase()
  if (!domain) return 0

  // Check direct matches
  if (SENDER_REGISTRY[domain]) return SENDER_REGISTRY[domain].score

  // Check subdomains (e.g. mail.greenhouse.io)
  for (const registryDomain in SENDER_REGISTRY) {
    if (domain.endsWith(registryDomain)) return SENDER_REGISTRY[registryDomain].score
  }

  // Personal recruiter emails or unknown domains
  if (/hr|recruiting|hiring|talent|careers|noreply/.test(email.toLowerCase())) {
    return 2
  }

  return 1 // Default positive score for specific query results
}

export function isKnownAdSender(email: string): boolean {
  const score = getSenderScore(email)
  return score <= -3
}

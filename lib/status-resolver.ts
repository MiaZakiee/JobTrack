/**
 * status-resolver.ts
 * Logic for resolving the final status of a thread based on message sequence.
 */

import type { Application } from "@/app/api/sync/route"

type Status = Application["status"]

const STATUS_RANK: Record<Status, number> = {
  applied: 1,
  responded: 2,
  interview: 3,
  rejected: 4,
  offer: 5,
}

/**
 * Resolves the final status from a list of statuses found in a thread.
 * Usually we want the "highest" status, but "rejected" and "offer" are terminal.
 * However, sometimes a thread might have a late "interview" after an "applied" message.
 * The LLM will now provide these, but this helper ensures we don't downgrade.
 */
export function resolveFinalStatus(statuses: (Status | "junk")[]): Status | "junk" {
  if (statuses.includes("junk")) return "junk"

  const validStatuses = statuses.filter((s): s is Status => s !== "junk")
  if (validStatuses.length === 0) return "applied"

  // Pick the one with the highest rank
  return validStatuses.reduce((prev, curr) => {
    return STATUS_RANK[curr] > STATUS_RANK[prev] ? curr : prev
  })
}

/**
 * Keywords for local fallback if LLM fails
 */
export const STATUS_KEYWORDS = {
  offer: ["offer", "congratulations", "pleased to offer", "onboarding"],
  rejected: ["unfortunately", "not selected", "not moving forward", "thank you for your interest"],
  interview: ["interview", "schedule", "chat", "zoom", "google meet", "calendly", "availability"],
  responded: ["reviewing", "get back to you", "under review", "assessment", "follow up", "technical test", "next steps", "we will review", "currently reviewing", "shortlisted"],
  applied: ["thank you for applying", "received your application", "application received"],
}

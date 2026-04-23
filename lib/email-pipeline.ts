/**
 * email-pipeline.ts
 * Orchestration and types for the structured email processing pipeline.
 */

import type { Application } from "@/app/api/sync/route"

export interface ThreadContext {
  id: string
  subject: string
  sender: string
  date: string
  messages: MessageContent[]
  score: number
}

export interface MessageContent {
  id: string
  date: string
  sender: string
  body: string
  snippet: string
}

export interface PipelineResult {
  isJobRelated: boolean
  confidence: number
  application?: Application
  reason?: string
}

/**
 * Truncates body text to preserve LLM context window
 */
export function truncateBody(text: string, limit: number = 800): string {
  if (text.length <= limit) return text
  return text.substring(0, limit) + "... [truncated]"
}

/**
 * Clean HTML or complex body text (simple version)
 */
export function cleanBody(text: string): string {
  return text
    .replace(/<style([\s\S]*?)<\/style>/gi, "")
    .replace(/<script([\s\S]*?)<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

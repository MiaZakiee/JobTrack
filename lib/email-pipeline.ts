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

/**
 * Extracts plain text body from Gmail message parts
 */
export function extractBody(payload: any): string {
  if (!payload) return ""
  
  // 1. Check if the body itself has data (simple messages)
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8")
  }

  // 2. Recursive search in parts
  if (payload.parts) {
    // Prefer text/plain over text/html
    const plainTextPart = payload.parts.find((p: any) => p.mimeType === "text/plain")
    if (plainTextPart?.body?.data) {
      return Buffer.from(plainTextPart.body.data, "base64").toString("utf-8")
    }

    const htmlPart = payload.parts.find((p: any) => p.mimeType === "text/html")
    if (htmlPart?.body?.data) {
      return cleanBody(Buffer.from(htmlPart.body.data, "base64").toString("utf-8"))
    }

    // Deep search in nested parts (multipart/alternative, etc)
    for (const part of payload.parts) {
      const body = extractBody(part)
      if (body) return body
    }
  }

  return ""
}


// This file provides environment config for both local dev and production.
// In production (Amplify), this file is OVERWRITTEN by amplify.yml with
// hardcoded values so they survive into the Lambda runtime.

export const ENV_CONFIG = {
  AUTH_SECRET: process.env.AUTH_SECRET || "",
  AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST || "",
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "",
  GOOGLE_GEMINI_API_KEY: process.env.GOOGLE_GEMINI_API_KEY || "",
  GROQ_API_KEY: process.env.GROQ_API_KEY || "",
  NEXTAUTH_URL: process.env.NEXTAUTH_URL || "",
}

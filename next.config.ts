import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Inline env vars at build time so they are available in the
  // Amplify Lambda runtime (which does NOT inherit .env files).
  env: {
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_GEMINI_API_KEY: process.env.GOOGLE_GEMINI_API_KEY,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  },
};

export default nextConfig;

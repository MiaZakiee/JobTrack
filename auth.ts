import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

const authSecret = process.env.AUTH_SECRET

if (!authSecret && process.env.NODE_ENV === "production") {
  console.warn("WARNING: AUTH_SECRET is not defined. Authentication will fail.")
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: authSecret,
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/gmail.readonly",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at ? account.expires_at * 1000 : 0,
        }
      }

      // If token hasn't expired, return it
      if (Date.now() < (token.expiresAt as number)) {
        return token
      }

      // Token expired, refresh it
      try {
        const response = await fetch("https://oauth2.googleapis.com/token", {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            grant_type: "refresh_token",
            refresh_token: token.refreshToken as string,
          }),
          method: "POST",
        })

        const tokens = await response.json()
        if (!response.ok) throw tokens

        return {
          ...token,
          accessToken: tokens.access_token,
          expiresAt: Date.now() + tokens.expires_in * 1000,
          refreshToken: tokens.refresh_token ?? token.refreshToken,
        }
      } catch (error) {
        console.error("Error refreshing access token", error)
        return { ...token, error: "RefreshAccessTokenError" }
      }
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string
      session.error = token.error as string
      return session
    },
  },
})

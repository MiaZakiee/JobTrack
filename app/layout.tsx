import type { Metadata } from "next"
import { Geist } from "next/font/google"
import "./globals.css"
import { SessionProvider } from "next-auth/react"
import { auth } from "@/auth"

const geist = Geist({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "JobTracker",
  description: "Track job applications automatically from Gmail",
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  return (
    <html lang="en">
      <body className={geist.className}>
        <SessionProvider session={session}>{children}</SessionProvider>
      </body>
    </html>
  )
}

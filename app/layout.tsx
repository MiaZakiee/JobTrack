import type { Metadata } from "next"
import { Geist } from "next/font/google"
import "./globals.css"
import { SessionProvider } from "next-auth/react"
import { auth } from "@/auth"

const geist = Geist({ subsets: ["latin"] })

export const metadata: Metadata = {
  metadataBase: new URL("https://jobtracker.ninocabiltes.dev"),
  title: "JobTracker",
  description: "Track job applications automatically from Gmail",
  keywords: [
    "job tracker",
    "application tracker",
    "gmail job tracker",
    "career organizer",
    "job search tool",
    "application management",
  ],
  openGraph: {
    title: "JobTracker",
    description: "Track job applications automatically from Gmail",
    url: "https://jobtracker.ninocabiltes.dev",
    siteName: "JobTracker",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "JobTracker Banner",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "JobTracker",
    description: "Track job applications automatically from Gmail",
    images: ["/og-image.png"],
  },
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

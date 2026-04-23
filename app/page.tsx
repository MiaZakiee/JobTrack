"use client"
import { useSession, signIn } from "next-auth/react"
import Dashboard from "@/components/Dashboard"
import { Mail, Zap, BarChart3, RefreshCw } from "lucide-react"

export default function Home() {
  const { data: session, status } = useSession()

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (session) return <Dashboard />

  return (
    <main className="min-h-screen bg-white flex flex-col">
      <nav className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-gray-900">JobTracker</span>
        </div>
        <button
          onClick={() => signIn("google")}
          className="text-sm text-gray-600 hover:text-gray-900 font-medium"
        >
          Sign in
        </button>
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-xs font-medium px-3 py-1.5 rounded-full mb-8">
          <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
          No manual entry. No AI tokens. Just Gmail.
        </div>

        <h1 className="text-5xl font-semibold text-gray-900 tracking-tight max-w-2xl leading-tight mb-5">
          Your job search,<br />tracked automatically
        </h1>
        <p className="text-lg text-gray-500 max-w-md mb-10">
          Connect your Gmail and JobTracker reads your inbox to find every application, interview, and rejection — automatically.
        </p>

        <button
          onClick={() => signIn("google")}
          className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-6 py-3.5 text-sm font-medium text-gray-800 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <p className="text-xs text-gray-400 mt-4">
          We only request read-only Gmail access. Your emails never leave your browser session.
        </p>

        <div className="grid grid-cols-3 gap-6 mt-20 max-w-2xl w-full text-left">
          {[
            { icon: Mail, title: "Reads your Gmail", desc: "Scans your inbox for job application emails automatically on sign-in." },
            { icon: BarChart3, title: "Tracks every status", desc: "Applied, viewed, interview, rejected, offer — all classified from email content." },
            { icon: RefreshCw, title: "Stays up to date", desc: "Hit sync anytime to pick up new emails and update your pipeline." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex flex-col gap-2">
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                <Icon className="w-4 h-4 text-gray-600" />
              </div>
              <p className="text-sm font-medium text-gray-800">{title}</p>
              <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}

"use client"
import { useSession, signOut } from "next-auth/react"
import { useState, useEffect, useCallback } from "react"
import { RefreshCw, LogOut, Zap, Download } from "lucide-react"
import type { Application } from "@/app/api/sync/route"
import StatsBar from "./StatsBar"
import ApplicationTable from "./ApplicationTable"

const STORAGE_KEY = "jobtracker_apps"
const SYNCED_AT_KEY = "jobtracker_synced_at"

export default function Dashboard() {
  const { data: session } = useSession()
  const [apps, setApps] = useState<Application[]>([])
  const [loading, setLoading] = useState(false)
  const [syncedAt, setSyncedAt] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [filterSource, setFilterSource] = useState("")
  const [error, setError] = useState("")

  const handleSync = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/sync?after=2026/03/01")
      if (!res.ok) throw new Error("Sync failed")
      const data = await res.json()
      setApps(data.applications)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data.applications))
      const now = new Date().toISOString()
      localStorage.setItem(SYNCED_AT_KEY, now)
      setSyncedAt(now)
    } catch (e) {
      setError(e instanceof Error ? e.message : "An unknown error occurred")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    const savedAt = localStorage.getItem(SYNCED_AT_KEY)
    if (saved) {
      setTimeout(() => {
        setApps(JSON.parse(saved))
        setSyncedAt(savedAt)
      }, 0)
    } else {
      setTimeout(() => {
        handleSync()
      }, 0)
    }
  }, [handleSync])

  const handleExport = () => {
    const headers = ["Company", "Role", "Status", "Source", "Date"]
    const rows = apps.map((a) => [
      a.company, a.role, a.status, a.source,
      new Date(a.date).toLocaleDateString(),
    ])
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "job-applications.csv"
    a.click()
  }

  const filtered = apps.filter((a) => {
    if (search && !a.company.toLowerCase().includes(search.toLowerCase()) &&
        !a.role.toLowerCase().includes(search.toLowerCase())) return false
    if (filterStatus && a.status !== filterStatus) return false
    if (filterSource && a.source !== filterSource) return false
    return true
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 px-6 py-3.5 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-gray-900">JobTracker</span>
        </div>
        <div className="flex items-center gap-3">
          {syncedAt && (
            <span className="text-xs text-gray-400 hidden sm:block">
              Synced {new Date(syncedAt).toLocaleString()}
            </span>
          )}
          <button
            onClick={handleExport}
            disabled={apps.length === 0}
            className="flex items-center gap-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            onClick={handleSync}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-white bg-blue-600 rounded-lg px-3 py-1.5 hover:bg-blue-700 disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Syncing..." : "Sync"}
          </button>
          <button
            onClick={() => signOut()}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">
            Hey {session?.user?.name?.split(" ")[0]} 👋
          </h1>
          <p className="text-sm text-gray-500">
            {apps.length} applications tracked from your Gmail
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 mb-6">
            {error} — make sure your Google OAuth scopes include gmail.readonly.
          </div>
        )}

        <StatsBar apps={apps} />

        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mt-6">
          <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap gap-3 items-center">
            <input
              type="text"
              placeholder="Search company or role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-[160px] text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-gray-50 focus:outline-none focus:border-blue-400 focus:bg-white"
            />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-gray-50 focus:outline-none focus:border-blue-400"
            >
              <option value="">All statuses</option>
              <option value="applied">Applied</option>
              <option value="viewed">Viewed</option>
              <option value="review">Under review</option>
              <option value="interview">Interview</option>
              <option value="rejected">Rejected</option>
              <option value="offer">Offer</option>
            </select>
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-gray-50 focus:outline-none focus:border-blue-400"
            >
              <option value="">All sources</option>
              <option value="LinkedIn">LinkedIn</option>
              <option value="Indeed">Indeed</option>
              <option value="Direct">Direct</option>
              <option value="Workday">Workday</option>
              <option value="Greenhouse">Greenhouse</option>
            </select>
            <span className="text-xs text-gray-400 ml-auto">{filtered.length} results</span>
          </div>

          <ApplicationTable apps={filtered} loading={loading} />
        </div>
      </div>
    </div>
  )
}

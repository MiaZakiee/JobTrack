"use client"
import { useSession, signOut } from "next-auth/react"
import { useState, useEffect, useCallback } from "react"
import { RefreshCw, LogOut, Zap, Download, Loader2 } from "lucide-react"
import type { Application } from "@/app/api/sync/route"
import StatsBar from "./StatsBar"
import ApplicationTable from "./ApplicationTable"

const STORAGE_KEY = "jobtracker_apps"
const SYNCED_AT_KEY = "jobtracker_synced_at"
const ONBOARDED_KEY = "jobtracker_onboarded"

import OnboardScreen from "./OnboardScreen"
import SyncStatus from "./SyncStatus"

export default function Dashboard() {
  const { data: session } = useSession()
  const [apps, setApps] = useState<Application[]>([])
  const [loading, setLoading] = useState(false)
  const [onboarded, setOnboarded] = useState<boolean | null>(null)
  const [syncedAt, setSyncedAt] = useState<string | null>(null)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [filterSource, setFilterSource] = useState("")
  const [error, setError] = useState("")

  const handleSync = useCallback(async (isAuto = false, onboardDateOverride?: string) => {
    if (loading) return
    setLoading(true)
    setError("")
    setSyncMessage("Initializing sync...")
    
    try {
      const lastSync = localStorage.getItem(SYNCED_AT_KEY)
      const onboardDate = onboardDateOverride || localStorage.getItem("jobtracker_onboard_date") || "2026/01/01"
      
      const isOnboarding = !!onboardDateOverride
      const afterDate = lastSync && !onboardDateOverride
        ? new Date(lastSync).toISOString().split("T")[0].replace(/-/g, "/")
        : onboardDate

      const eventSource = new EventSource(`/api/sync?after=${afterDate}&mode=${isOnboarding ? "onboard" : "sync"}`)
      
      let currentApps = isOnboarding ? [] : [...JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")]
      let firstBatchReceived = false

      eventSource.addEventListener("status", (e) => {
        const data = JSON.parse(e.data)
        setSyncMessage(data.message)
      })

      eventSource.addEventListener("batch", (e) => {
        const data = JSON.parse(e.data)
        const batchApps = data.applications as Application[]
        
        // Merge strategy
        for (const newApp of batchApps) {
          const idx = currentApps.findIndex(a => a.id === newApp.id)
          if (idx >= 0) {
            currentApps[idx] = newApp
          } else {
            currentApps.push(newApp)
          }
        }
        
        const sorted = [...currentApps].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        setApps(sorted)

        // Reveal dashboard on first batch if onboarding
        if (isOnboarding && !firstBatchReceived) {
          firstBatchReceived = true
          setOnboarded(true)
          localStorage.setItem(ONBOARDED_KEY, "true")
          localStorage.setItem("jobtracker_onboard_date", onboardDate)
        }
      })

      eventSource.addEventListener("done", (e) => {
        const now = new Date().toISOString()
        localStorage.setItem(STORAGE_KEY, JSON.stringify(currentApps))
        localStorage.setItem(SYNCED_AT_KEY, now)
        setSyncedAt(now)
        setSyncMessage(null)
        setLoading(false)
        
        // Ensure modal is gone if it was a very fast sync or empty
        if (isOnboarding) setOnboarded(true)
        
        eventSource.close()
      })

      eventSource.addEventListener("error", (e) => {
        console.error("Sync stream error:", e)
        setError("Sync interrupted — partial results saved.")
        setLoading(false)
        setSyncMessage(null)
        if (isOnboarding) setOnboarded(true)
        eventSource.close()
      })

    } catch (e) {
      setError(e instanceof Error ? e.message : "An unknown error occurred")
      setLoading(false)
      setSyncMessage(null)
    }
  }, [loading])

  const handleReimport = () => {
    if (confirm("This will clear your local data and start the onboarding process again. Your Gmail emails will not be deleted. Continue?")) {
      localStorage.removeItem(ONBOARDED_KEY)
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem(SYNCED_AT_KEY)
      setOnboarded(false)
      setApps([])
    }
  }

  useEffect(() => {
    const isLocalOnboarded = localStorage.getItem(ONBOARDED_KEY) === "true"
    setOnboarded(isLocalOnboarded)
    
    if (isLocalOnboarded) {
      const saved = localStorage.getItem(STORAGE_KEY)
      const savedAt = localStorage.getItem(SYNCED_AT_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        setApps(parsed)
        setSyncedAt(savedAt)
        
        // Auto-sync logic: if last sync was > 1 hour ago
        if (savedAt) {
          const hoursSinceSync = (Date.now() - new Date(savedAt).getTime()) / (1000 * 60 * 60)
          if (hoursSinceSync > 1) {
            handleSync(true)
          }
        }
      }
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

  if (onboarded === null) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Onboarding Modal Gate */}
      {!onboarded && (
        <OnboardScreen 
          onStart={(date) => handleSync(false, date)} 
          syncStatus={syncMessage}
          syncCount={apps.length}
          loading={loading}
        />
      )}
      <nav className="bg-white border-b border-gray-100 px-6 py-3.5 flex items-center justify-between sticky top-0 z-20 shadow-sm shadow-gray-100/50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-gray-900 tracking-tight">JobTracker</span>
        </div>
        <div className="flex items-center gap-3">
          {syncedAt && (
            <span className="text-[10px] font-bold text-gray-400 hidden sm:block uppercase tracking-wider">
              Last Synced {new Date(syncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={handleReimport}
            className="text-[10px] font-bold text-gray-400 hover:text-red-500 uppercase tracking-wider transition-colors mr-2 hidden md:block"
          >
            Re-import
          </button>
          <button
            onClick={handleExport}
            disabled={apps.length === 0}
            className="flex items-center gap-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            onClick={() => handleSync(false)}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-white bg-blue-600 rounded-lg px-3 py-1.5 hover:bg-blue-700 disabled:opacity-60 transition-all shadow-md shadow-blue-100"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Syncing..." : "Sync"}
          </button>
          <button
            onClick={() => signOut()}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            Welcome back, {session?.user?.name?.split(" ")[0]} 👋
          </h1>
          <p className="text-sm text-gray-500">
            {apps.length} applications tracked from your Gmail
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-2xl px-5 py-4 text-sm text-red-700 mb-8 flex items-center gap-3">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            {error}
          </div>
        )}

        <SyncStatus message={syncMessage} count={apps.length} loading={loading} />

        <StatsBar apps={apps} />

        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/40 overflow-hidden mt-8">
          <div className="px-6 py-5 border-b border-gray-100 flex flex-wrap gap-4 items-center bg-gray-50/30">
            <div className="relative flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="Search company or role..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-sm border border-gray-200 rounded-xl px-4 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
            >
              <option value="">All statuses</option>
              <option value="applied">Applied</option>
              <option value="interview">Interview</option>
              <option value="rejected">Rejected</option>
              <option value="offer">Offer</option>
            </select>
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="text-sm border border-gray-200 rounded-xl px-4 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
            >
              <option value="">All sources</option>
              <option value="LinkedIn">LinkedIn</option>
              <option value="Indeed">Indeed</option>
              <option value="Direct">Direct</option>
              <option value="Workday">Workday</option>
              <option value="Greenhouse">Greenhouse</option>
            </select>
            <span className="text-[10px] font-bold text-gray-400 ml-auto uppercase tracking-wider">{filtered.length} results</span>
          </div>

          <ApplicationTable apps={filtered} loading={false} />
        </div>
      </div>
    </div>
  )
}


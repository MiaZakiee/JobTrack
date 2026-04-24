"use client"
import { useSession, signOut } from "next-auth/react"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
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
  const { data: session, status } = useSession()
  const router = useRouter()
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
    setSyncMessage("Searching Gmail for job emails...")
    
    try {
      const lastSync = localStorage.getItem(SYNCED_AT_KEY)
      const onboardDate = onboardDateOverride || localStorage.getItem("jobtracker_onboard_date") || "2026/01/01"
      
      const isOnboarding = !!onboardDateOverride
      const afterDate = lastSync && !onboardDateOverride
        ? new Date(lastSync).toISOString().split("T")[0].replace(/-/g, "/")
        : onboardDate

      let currentApps = isOnboarding ? [] : [...JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")]
      let firstBatchReceived = false

      // Phase 1: Discover thread IDs
      const discoverRes = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: "discover", after: afterDate, mode: isOnboarding ? "onboard" : "sync" })
      })

      if (!discoverRes.ok) {
        throw new Error(await discoverRes.text() || "Failed to discover threads")
      }

      const { threadIds, total } = await discoverRes.json()

      if (!threadIds || threadIds.length === 0) {
        setSyncMessage(null)
        setLoading(false)
        if (isOnboarding) {
          setOnboarded(true)
          localStorage.setItem(ONBOARDED_KEY, "true")
          localStorage.setItem("jobtracker_onboard_date", onboardDate)
        }
        return
      }

      setSyncMessage(`Found ${total} potential threads. Processing...`)

      // Phase 2: Process in batches of 10
      const BATCH_SIZE = 10
      const totalBatches = Math.ceil(threadIds.length / BATCH_SIZE)

      for (let i = 0; i < threadIds.length; i += BATCH_SIZE) {
        const batchNum = Math.floor(i / BATCH_SIZE) + 1
        const batchIds = threadIds.slice(i, i + BATCH_SIZE)

        setSyncMessage(`Classifying batch ${batchNum} of ${totalBatches}...`)

        const processRes = await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phase: "process", threadIds: batchIds })
        })

        if (!processRes.ok) {
          console.warn(`Batch ${batchNum} failed, skipping...`)
          continue
        }

        const { applications: batchApps } = await processRes.json()

        if (batchApps?.length > 0) {
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

          // Reveal dashboard on first batch during onboarding
          if (isOnboarding && !firstBatchReceived) {
            firstBatchReceived = true
            setOnboarded(true)
            localStorage.setItem(ONBOARDED_KEY, "true")
            localStorage.setItem("jobtracker_onboard_date", onboardDate)
          }
        }
      }

      // Done
      const now = new Date().toISOString()
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentApps))
      localStorage.setItem(SYNCED_AT_KEY, now)
      setSyncedAt(now)
      setSyncMessage(null)
      setLoading(false)
      if (isOnboarding) setOnboarded(true)

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

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/")
    }
  }, [status, router])

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
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
      <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Onboarding Modal Gate */}
      {!onboarded && (
        <OnboardScreen 
          onStart={(date) => handleSync(false, date)} 
          syncStatus={syncMessage}
          syncCount={apps.length}
          loading={loading}
        />
      )}
      <nav className="bg-[#111] border-b border-zinc-800 px-4 sm:px-6 py-3.5 flex items-center justify-between sticky top-0 z-20 shadow-sm shadow-black/50 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-white tracking-tight">JobTracker</span>
        </div>
        <div className="flex items-center gap-3">
          {syncedAt && (
            <span className="text-[10px] font-bold text-zinc-500 hidden sm:block uppercase tracking-wider">
              Last Synced {new Date(syncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={handleReimport}
            className="text-[10px] font-bold text-zinc-500 hover:text-red-400 uppercase tracking-wider transition-colors mr-1 sm:mr-2 hidden md:block"
          >
            Re-import
          </button>
          <button
            onClick={handleExport}
            disabled={apps.length === 0}
            className="flex items-center gap-1.5 text-xs text-zinc-300 border border-zinc-700 rounded-lg px-2 sm:px-3 py-1.5 hover:bg-zinc-800 disabled:opacity-40 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
          <button
            onClick={() => handleSync(false)}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-white bg-blue-600 rounded-lg px-2 sm:px-3 py-1.5 hover:bg-blue-700 disabled:opacity-60 transition-all shadow-md shadow-blue-900/50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{loading ? "Syncing..." : "Sync"}</span>
          </button>
          <button
            onClick={() => signOut()}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">
            Welcome back, {session?.user?.name?.split(" ")[0]} 👋
          </h1>
          <p className="text-sm text-zinc-400">
            {apps.length} applications tracked from your Gmail
          </p>
        </div>

        {error && (
          <div className="bg-red-950/50 border border-red-900 rounded-2xl px-5 py-4 text-sm text-red-400 mb-8 flex items-center gap-3">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            {error}
          </div>
        )}

        <SyncStatus message={syncMessage} count={apps.length} loading={loading} />

        <StatsBar apps={apps} filterStatus={filterStatus} onFilterChange={setFilterStatus} />

        <div className="bg-[#111] rounded-2xl sm:rounded-3xl border border-zinc-800 shadow-xl shadow-black/40 overflow-hidden mt-6 sm:mt-8">
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-zinc-800 flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 items-stretch sm:items-center bg-[#111]">
            <div className="relative flex-1 w-full sm:min-w-[200px]">
              <input
                type="text"
                placeholder="Search company or role..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-sm border border-zinc-700 rounded-xl px-4 py-2.5 sm:py-2 bg-black text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
              />
            </div>
            <div className="flex gap-3 sm:gap-4 w-full sm:w-auto">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="flex-1 sm:flex-none text-sm border border-zinc-700 rounded-xl px-3 sm:px-4 py-2.5 sm:py-2 bg-black text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all cursor-pointer"
              >
                <option value="">All statuses</option>
                <option value="applied">Applied</option>
                <option value="responded">Responded</option>
                <option value="interview">Interview</option>
                <option value="rejected">Rejected</option>
                <option value="offer">Offer</option>
              </select>
              <select
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value)}
                className="flex-1 sm:flex-none text-sm border border-zinc-700 rounded-xl px-3 sm:px-4 py-2.5 sm:py-2 bg-black text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all cursor-pointer"
              >
                <option value="">All sources</option>
                <option value="LinkedIn">LinkedIn</option>
                <option value="Indeed">Indeed</option>
                <option value="Direct">Direct</option>
                <option value="Workday">Workday</option>
                <option value="Greenhouse">Greenhouse</option>
              </select>
            </div>
            <span className="text-[10px] font-bold text-zinc-500 w-full sm:w-auto text-right sm:ml-auto uppercase tracking-wider mt-1 sm:mt-0">{filtered.length} results</span>
          </div>

          <ApplicationTable apps={filtered} loading={false} />
        </div>
      </div>
    </div>
  )
}


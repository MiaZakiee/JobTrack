"use client"
import { Loader2, RefreshCw } from "lucide-react"

interface SyncStatusProps {
  message: string | null
  count: number
  loading: boolean
}

export default function SyncStatus({ message, count, loading }: SyncStatusProps) {
  if (!loading && !message) return null

  return (
    <div className="flex items-center gap-4 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 mb-6">
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <div className="flex-shrink-0">
          <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
        </div>
        <p className="text-sm font-medium text-blue-900 truncate">
          {message || "Syncing your applications..."}
        </p>
      </div>
      <div className="flex-shrink-0 flex items-center gap-2">
        <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
          {count} Found
        </span>
      </div>
    </div>
  )
}

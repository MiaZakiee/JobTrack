import type { Application } from "@/app/api/sync/route"

const STATS = [
  { key: "total", label: "Total", color: "text-white" },
  { key: "interview", label: "Interview", color: "text-green-400" },
  { key: "rejected", label: "Rejected", color: "text-red-400" },
  { key: "offer", label: "Offer", color: "text-teal-400" },
] as const

interface StatsBarProps {
  apps: Application[]
  filterStatus?: string
  onFilterChange?: (status: string) => void
}

export default function StatsBar({ apps, filterStatus, onFilterChange }: StatsBarProps) {
  const counts: Record<string, number> = { total: apps.length }
  for (const app of apps) counts[app.status] = (counts[app.status] || 0) + 1

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {STATS.map(({ key, label, color }) => {
        const isActive = filterStatus === key || (key === 'total' && filterStatus === '')
        
        return (
          <button 
            key={key} 
            onClick={() => {
              if (!onFilterChange) return
              if (key === 'total') onFilterChange('')
              else if (filterStatus === key) onFilterChange('')
              else onFilterChange(key)
            }}
            className={`text-left rounded-xl border px-4 py-3.5 shadow-sm shadow-black/20 transition-all focus:outline-none ${
              isActive 
                ? 'bg-zinc-800 border-zinc-600 ring-1 ring-zinc-500' 
                : 'bg-[#111] border-zinc-800 hover:bg-zinc-900 cursor-pointer'
            }`}
          >
            <p className={`text-xs mb-1 ${isActive ? 'text-zinc-300' : 'text-zinc-500'}`}>{label}</p>
            <p className={`text-2xl font-semibold ${color}`}>{counts[key] || 0}</p>
          </button>
        )
      })}
    </div>
  )
}

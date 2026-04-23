import type { Application } from "@/app/api/sync/route"

const STATS = [
  { key: "total", label: "Total", color: "text-white" },
  { key: "interview", label: "Interview", color: "text-green-400" },
  { key: "rejected", label: "Rejected", color: "text-red-400" },
  { key: "offer", label: "Offer", color: "text-teal-400" },
] as const

export default function StatsBar({ apps }: { apps: Application[] }) {
  const counts: Record<string, number> = { total: apps.length }
  for (const app of apps) counts[app.status] = (counts[app.status] || 0) + 1

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {STATS.map(({ key, label, color }) => (
        <div key={key} className="bg-[#111] rounded-xl border border-zinc-800 px-4 py-3.5 shadow-sm shadow-black/20">
          <p className="text-xs text-zinc-500 mb-1">{label}</p>
          <p className={`text-2xl font-semibold ${color}`}>{counts[key] || 0}</p>
        </div>
      ))}
    </div>
  )
}

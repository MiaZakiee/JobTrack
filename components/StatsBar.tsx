import type { Application } from "@/app/api/sync/route"

const STATS = [
  { key: "total", label: "Total", color: "text-gray-900" },
  { key: "interview", label: "Interview", color: "text-green-700" },
  { key: "review", label: "Under review", color: "text-purple-700" },
  { key: "viewed", label: "Viewed", color: "text-amber-700" },
  { key: "rejected", label: "Rejected", color: "text-red-700" },
  { key: "offer", label: "Offer", color: "text-teal-700" },
] as const

export default function StatsBar({ apps }: { apps: Application[] }) {
  const counts: Record<string, number> = { total: apps.length }
  for (const app of apps) counts[app.status] = (counts[app.status] || 0) + 1

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
      {STATS.map(({ key, label, color }) => (
        <div key={key} className="bg-white rounded-xl border border-gray-100 px-4 py-3.5">
          <p className="text-xs text-gray-400 mb-1">{label}</p>
          <p className={`text-2xl font-semibold ${color}`}>{counts[key] || 0}</p>
        </div>
      ))}
    </div>
  )
}

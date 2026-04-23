import type { Application } from "@/app/api/sync/route"

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  applied: { label: "Applied", className: "bg-blue-50 text-blue-700" },
  interview: { label: "Interview", className: "bg-green-50 text-green-700" },
  rejected: { label: "Rejected", className: "bg-red-50 text-red-700" },
  offer: { label: "Offer", className: "bg-teal-50 text-teal-700" },
}

const SOURCE_COLORS: Record<string, string> = {
  LinkedIn: "text-blue-600",
  Indeed: "text-green-600",
  Jobstreet: "text-purple-600",
  Workday: "text-orange-600",
  Greenhouse: "text-teal-600",
  SmartRecruiters: "text-indigo-600",
  Direct: "text-gray-500",
}

export default function ApplicationTable({
  apps,
  loading,
}: {
  apps: Application[]
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-3 text-sm text-gray-400">
        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        Syncing your Gmail...
      </div>
    )
  }

  if (apps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-sm text-gray-400 gap-2">
        <p>No applications found</p>
        <p className="text-xs">Try adjusting your filters or syncing again</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left text-xs font-medium text-gray-400 px-5 py-3 w-[35%]">Company</th>
            <th className="text-left text-xs font-medium text-gray-400 px-5 py-3 w-[30%]">Role</th>
            <th className="text-left text-xs font-medium text-gray-400 px-5 py-3 w-[17%]">Status</th>
            <th className="text-left text-xs font-medium text-gray-400 px-5 py-3 w-[10%]">Source</th>
            <th className="text-left text-xs font-medium text-gray-400 px-5 py-3 w-[8%]">Date</th>
          </tr>
        </thead>
        <tbody>
          {apps.map((app) => {
            const status = STATUS_CONFIG[app.status] ?? STATUS_CONFIG.applied
            const sourceColor = SOURCE_COLORS[app.source] ?? "text-gray-500"
            return (
              <tr key={app.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3 font-medium text-gray-900 truncate max-w-0">
                  <span className="truncate block">{app.company}</span>
                </td>
                <td className="px-5 py-3 text-gray-500 truncate max-w-0">
                  <span className="truncate block">{app.role}</span>
                </td>
                <td className="px-5 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${status.className}`}>
                    {status.label}
                  </span>
                </td>
                <td className={`px-5 py-3 text-xs font-medium ${sourceColor}`}>
                  {app.source}
                </td>
                <td className="px-5 py-3 text-xs text-gray-400 whitespace-nowrap">
                  {new Date(app.date).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

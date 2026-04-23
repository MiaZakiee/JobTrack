"use client"
import { useState, useMemo } from "react"
import { ChevronUp, ChevronDown } from "lucide-react"
import type { Application } from "@/app/api/sync/route"

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  applied: { label: "Applied", className: "bg-blue-500/10 text-blue-400 border border-blue-500/20" },
  interview: { label: "Interview", className: "bg-green-500/10 text-green-400 border border-green-500/20" },
  rejected: { label: "Rejected", className: "bg-red-500/10 text-red-400 border border-red-500/20" },
  offer: { label: "Offer", className: "bg-teal-500/10 text-teal-400 border border-teal-500/20" },
}

const SOURCE_COLORS: Record<string, string> = {
  LinkedIn: "text-blue-400",
  Indeed: "text-green-400",
  Jobstreet: "text-purple-400",
  Workday: "text-orange-400",
  Greenhouse: "text-teal-400",
  SmartRecruiters: "text-indigo-400",
  Direct: "text-zinc-500",
}

type SortField = 'company' | 'role' | 'status' | 'source' | 'date';
type SortOrder = 'asc' | 'desc';

export default function ApplicationTable({
  apps,
  loading,
}: {
  apps: Application[]
  loading: boolean
}) {
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder(field === 'date' ? 'desc' : 'asc')
    }
  }

  const sortedApps = useMemo(() => {
    return [...apps].sort((a, b) => {
      let comparison = 0
      switch (sortField) {
        case 'company':
          comparison = a.company.localeCompare(b.company)
          break
        case 'role':
          comparison = a.role.localeCompare(b.role)
          break
        case 'status':
          comparison = a.status.localeCompare(b.status)
          break
        case 'source':
          comparison = a.source.localeCompare(b.source)
          break
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime()
          break
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })
  }, [apps, sortField, sortOrder])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-3 text-sm text-zinc-500">
        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        Syncing your Gmail...
      </div>
    )
  }

  if (apps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-sm text-zinc-500 gap-2">
        <p>No applications found</p>
        <p className="text-xs">Try adjusting your filters or syncing again</p>
      </div>
    )
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800">
            <th 
              className="text-left text-xs font-medium text-zinc-500 px-5 py-3 w-[35%] cursor-pointer hover:bg-zinc-800/50 hover:text-zinc-300 transition-colors select-none"
              onClick={() => handleSort('company')}
            >
              <div className="flex items-center gap-1">Company <SortIcon field="company" /></div>
            </th>
            <th 
              className="text-left text-xs font-medium text-zinc-500 px-5 py-3 w-[30%] cursor-pointer hover:bg-zinc-800/50 hover:text-zinc-300 transition-colors select-none"
              onClick={() => handleSort('role')}
            >
              <div className="flex items-center gap-1">Role <SortIcon field="role" /></div>
            </th>
            <th 
              className="text-left text-xs font-medium text-zinc-500 px-5 py-3 w-[17%] cursor-pointer hover:bg-zinc-800/50 hover:text-zinc-300 transition-colors select-none"
              onClick={() => handleSort('status')}
            >
              <div className="flex items-center gap-1">Status <SortIcon field="status" /></div>
            </th>
            <th 
              className="text-left text-xs font-medium text-zinc-500 px-5 py-3 w-[10%] cursor-pointer hover:bg-zinc-800/50 hover:text-zinc-300 transition-colors select-none"
              onClick={() => handleSort('source')}
            >
              <div className="flex items-center gap-1">Source <SortIcon field="source" /></div>
            </th>
            <th 
              className="text-left text-xs font-medium text-zinc-500 px-5 py-3 w-[8%] cursor-pointer hover:bg-zinc-800/50 hover:text-zinc-300 transition-colors select-none"
              onClick={() => handleSort('date')}
            >
              <div className="flex items-center gap-1">Date <SortIcon field="date" /></div>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedApps.map((app) => {
            const status = STATUS_CONFIG[app.status] ?? STATUS_CONFIG.applied
            const sourceColor = SOURCE_COLORS[app.source] ?? "text-gray-500"
            return (
              <tr 
                key={app.id} 
                className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors cursor-pointer"
                onClick={() => window.open(`https://mail.google.com/mail/u/0/#all/${app.id}`, '_blank')}
                title="Click to view email in Gmail"
              >
                <td className="px-5 py-3 font-medium text-white truncate max-w-0">
                  <span className="truncate block">{app.company}</span>
                </td>
                <td className="px-5 py-3 text-zinc-400 truncate max-w-0">
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
                <td className="px-5 py-3 text-xs text-zinc-500 whitespace-nowrap">
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

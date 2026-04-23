"use client"
import { useState } from "react"
import { Zap, Calendar, CheckCircle2 } from "lucide-react"

interface OnboardScreenProps {
  onStart: (date: string) => void
  syncStatus: string | null
  syncCount: number
  loading: boolean
}

export default function OnboardScreen({ onStart, syncStatus, syncCount, loading }: OnboardScreenProps) {
  // Date states
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear.toString())
  const [month, setMonth] = useState((new Date().getMonth() + 1).toString().padStart(2, '0'))

  const years = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString())
  const months = [
    { value: "01", label: "January" },
    { value: "02", label: "February" },
    { value: "03", label: "March" },
    { value: "04", label: "April" },
    { value: "05", label: "May" },
    { value: "06", label: "June" },
    { value: "07", label: "July" },
    { value: "08", label: "August" },
    { value: "09", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
  ]

  const handleStart = () => {
    onStart(`${year}/${month}/01`)
  }

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto p-4 md:p-6">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md animate-in fade-in duration-500" />
      
      {/* Scrollable Wrapper */}
      <div className="min-h-full flex items-center justify-center py-8">
        {/* Modal Container */}
        <div className="max-w-md w-full bg-[#111] rounded-[3rem] shadow-2xl border border-zinc-800 relative animate-in zoom-in-95 slide-in-from-bottom-10 duration-500 overflow-hidden">
        <div className="p-8 md:p-10 text-center">
          <div className="w-20 h-20 bg-blue-600 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-blue-500/40 relative">
            <Zap className="w-10 h-10 text-white fill-white" />
            <div className="absolute -inset-1 bg-blue-400/20 blur-xl rounded-full animate-pulse" />
          </div>
          
          <h1 className="text-3xl font-black text-white mb-3 tracking-tight">Setup Your Tracker</h1>
          <p className="text-zinc-400 text-base mb-10 leading-relaxed">
            When did you start your job hunt? We'll sync your Gmail for all application confirmations.
          </p>

          {!loading ? (
            <div className="space-y-8">
              <div className="flex gap-4 justify-center">
                <div className="flex-1 text-left">
                  <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-2.5 ml-1">Month</label>
                  <select 
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className="w-full bg-black border-2 border-zinc-800 rounded-2xl px-5 py-4 text-sm font-bold text-white focus:outline-none focus:border-blue-500 focus:bg-zinc-900 transition-all appearance-none cursor-pointer hover:border-zinc-700"
                  >
                    {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                <div className="w-32 text-left">
                  <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-2.5 ml-1">Year</label>
                  <select 
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    className="w-full bg-black border-2 border-zinc-800 rounded-2xl px-5 py-4 text-sm font-bold text-white focus:outline-none focus:border-blue-500 focus:bg-zinc-900 transition-all appearance-none cursor-pointer hover:border-zinc-700"
                  >
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>

              <button
                onClick={handleStart}
                className="w-full bg-blue-600 text-white rounded-[1.25rem] py-5 text-base font-black hover:bg-blue-700 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-blue-500/25 flex items-center justify-center gap-3 group"
              >
                Scan My Gmail
                <CheckCircle2 className="w-6 h-6 text-blue-200 group-hover:text-white transition-colors" />
              </button>
            </div>
          ) : (
            <div className="py-10 space-y-10">
              <div className="flex flex-col items-center">
                <div className="relative">
                  <div className="w-24 h-24 border-4 border-zinc-800 border-t-blue-600 rounded-full animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Calendar className="w-10 h-10 text-blue-500" />
                  </div>
                </div>
                <div className="mt-8 space-y-2">
                  <p className="text-lg font-black text-white tracking-tight">{syncStatus || "Syncing..."}</p>
                  <p className="text-xs text-zinc-500 pb-2">We'll automatically take you to the dashboard once the first batch of emails is processed.</p>
                  <div className="flex items-center justify-center gap-2 text-sm font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-4 py-1.5 rounded-full mx-auto w-fit">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                    </span>
                    {syncCount} Applications found
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="bg-black/50 border-t border-zinc-800 px-8 py-6">
          <div className="flex flex-col gap-3 text-left">
            <div className="text-xs text-zinc-500 leading-relaxed">
              <span className="font-bold text-zinc-300">100% Local & Read-Only:</span> We do not have a database. Your data is saved entirely in your browser's local storage. Your emails are only processed securely via API and never stored on our servers.
            </div>
            <div className="text-xs text-amber-500 leading-relaxed bg-amber-500/5 p-2 rounded-lg border border-amber-500/20">
              <span className="font-bold">AI Classification:</span> We use LLMs to extract your application status. Since AI isn't perfect, some classifications might be inaccurate.
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-500" />
      
      {/* Modal Container */}
      <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl border border-white/20 overflow-hidden relative animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
        <div className="p-8 md:p-10 text-center">
          <div className="w-20 h-20 bg-blue-600 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-blue-500/40 relative">
            <Zap className="w-10 h-10 text-white fill-white" />
            <div className="absolute -inset-1 bg-blue-400/20 blur-xl rounded-full animate-pulse" />
          </div>
          
          <h1 className="text-3xl font-black text-gray-900 mb-3 tracking-tight">Setup Your Tracker</h1>
          <p className="text-gray-500 text-base mb-10 leading-relaxed">
            When did you start your job hunt? We'll sync your Gmail for all application confirmations.
          </p>

          {!loading ? (
            <div className="space-y-8">
              <div className="flex gap-4 justify-center">
                <div className="flex-1 text-left">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2.5 ml-1">Month</label>
                  <select 
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 focus:outline-none focus:border-blue-500 focus:bg-white transition-all appearance-none cursor-pointer hover:border-gray-200"
                  >
                    {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                <div className="w-32 text-left">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2.5 ml-1">Year</label>
                  <select 
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 focus:outline-none focus:border-blue-500 focus:bg-white transition-all appearance-none cursor-pointer hover:border-gray-200"
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
                  <div className="w-24 h-24 border-4 border-blue-50 border-t-blue-600 rounded-full animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Calendar className="w-10 h-10 text-blue-600" />
                  </div>
                </div>
                <div className="mt-8 space-y-2">
                  <p className="text-lg font-black text-gray-900 tracking-tight">{syncStatus || "Syncing..."}</p>
                  <div className="flex items-center justify-center gap-2 text-sm font-bold text-blue-600 bg-blue-50 px-4 py-1.5 rounded-full mx-auto w-fit">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
                    </span>
                    {syncCount} Applications found
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="bg-gray-50/50 border-t border-gray-100 px-10 py-6">
          <div className="flex justify-between items-center opacity-40">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Security</span>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Read Only</span>
          </div>
        </div>
      </div>
    </div>
  )
}

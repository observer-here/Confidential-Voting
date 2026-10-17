"use client"

import { BarChart3, History, Inbox, Plus, User } from "lucide-react"

export const TABS = [
  { id: "vote", label: "Vote", icon: Inbox },
  { id: "create", label: "Create", icon: Plus },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "history", label: "My Votes", icon: History },
  { id: "account", label: "Account", icon: User },
] as const

// bottom bar order: Create sits in the raised center slot
const MOBILE_ORDER = ["vote", "analytics", "create", "history", "account"]

export function MobileNav({ active, onChange }: { active: string; onChange: (id: string) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.06] bg-[#0b0e0c]/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
      <div className="mx-auto flex h-16 max-w-md items-center justify-around px-2">
        {MOBILE_ORDER.map((id) => {
          const tab = TABS.find((t) => t.id === id)!
          const Icon = tab.icon
          const isActive = active === id

          if (id === "create") {
            return (
              <button
                key={id}
                onClick={() => onChange(id)}
                aria-label="Create proposal"
                className="-mt-7 flex h-14 w-14 items-center justify-center rounded-full bg-[#c5d9c2] text-[#121614] shadow-[0_8px_24px_rgba(143,191,136,0.25)] ring-4 ring-[#090b0a] transition-transform active:scale-95"
              >
                <Icon className="h-6 w-6" />
              </button>
            )
          }

          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className={`flex w-16 flex-col items-center gap-1 py-1 text-[10px] transition-colors active:scale-95 ${
                isActive ? "text-[#c5d9c2]" : "text-zinc-500"
              }`}
            >
              <Icon className={`h-5 w-5 ${isActive ? "stroke-[2.25]" : ""}`} />
              {tab.label}
              <span className={`h-0.5 w-4 rounded-full ${isActive ? "bg-[#8fbf88]" : "bg-transparent"}`} />
            </button>
          )
        })}
      </div>
    </nav>
  )
}

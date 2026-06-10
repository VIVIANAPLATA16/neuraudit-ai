"use client"

import { Sparkles, Plug, Search } from "lucide-react"
import { cn } from "@/lib/utils"

const ITEMS = [
  {
    icon: Sparkles,
    label: "Gemini 2.5 Flash",
    detail: "Narrative risk analysis",
  },
  {
    icon: Plug,
    label: "Agent Builder MCP",
    detail: "POST /api/mcp · investigar_entidad",
  },
  {
    icon: Search,
    label: "Elasticsearch SECOP",
    detail: "Hybrid semantic search · secop-contratos",
  },
] as const

export function HackathonTechStrip({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-center gap-3",
        className
      )}
    >
      {ITEMS.map((item) => (
        <span
          key={item.label}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium border bg-primary/5 text-foreground border-primary/25"
        >
          <item.icon className="size-3.5 text-primary shrink-0" />
          <span>
            <span className="font-semibold">{item.label}</span>
            <span className="text-muted-foreground hidden sm:inline"> · {item.detail}</span>
          </span>
        </span>
      ))}
    </div>
  )
}

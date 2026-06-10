"use client"

import { useEffect, useState } from "react"
import { Sparkles, Bot, Search } from "lucide-react"
import { cn } from "@/lib/utils"

interface Compliance {
  gemini: boolean
  adkAgent: boolean
  elasticMcp: boolean
}

export function HackathonTechStrip({ className }: { className?: string }) {
  const [status, setStatus] = useState<Compliance | null>(null)

  useEffect(() => {
    fetch("/api/system/compliance")
      .then((r) => r.json())
      .then((d) =>
        setStatus({
          gemini: Boolean(d.gemini),
          adkAgent: Boolean(d.adkAgent),
          elasticMcp: Boolean(d.elasticMcp),
        })
      )
      .catch(() => setStatus(null))
  }, [])

  const items = [
    {
      icon: Sparkles,
      label: "Gemini",
      detail: status ? (status.gemini ? "runtime ok" : "not configured") : "checking…",
      ok: status?.gemini,
    },
    {
      icon: Bot,
      label: "ADK Agent",
      detail: status ? (status.adkAgent ? "runtime ok" : "not reachable") : "checking…",
      ok: status?.adkAgent,
    },
    {
      icon: Search,
      label: "Elastic MCP",
      detail: status ? (status.elasticMcp ? "runtime ok" : "not reachable") : "checking…",
      ok: status?.elasticMcp,
    },
  ]

  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-3", className)}>
      {items.map((item) => (
        <span
          key={item.label}
          className={cn(
            "inline-flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium border",
            item.ok === true
              ? "bg-success/10 text-success border-success/30"
              : item.ok === false
                ? "bg-muted/40 text-muted-foreground border-border"
                : "bg-primary/5 text-foreground border-primary/25"
          )}
        >
          <item.icon className="size-3.5 shrink-0" />
          <span>
            <span className="font-semibold">{item.label}</span>
            <span className="hidden sm:inline"> · {item.detail}</span>
          </span>
        </span>
      ))}
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Search, Trash2, ExternalLink, History } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { cn, formatCOP } from "@/lib/utils"
import { getHistory, removeFromHistory, searchHistory, type HistoryEntry } from "@/lib/history"

export default function HistorialPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [filter, setFilter] = useState("")

  useEffect(() => {
    setEntries(filter ? searchHistory(filter) : getHistory())
  }, [filter])

  const handleRemove = (id: string) => {
    removeFromHistory(id)
    setEntries(filter ? searchHistory(filter) : getHistory())
  }

  return (
    <AppShell title="Historial de Investigaciones" subtitle="Consultas guardadas localmente">
      <div className="space-y-6">
        <div className="glass rounded-2xl p-4 flex items-center gap-3">
          <Search className="size-5 text-primary shrink-0" />
          <input
            type="text"
            placeholder="Buscar en historial..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>

        {entries.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center">
            <History className="size-10 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No hay investigaciones en el historial.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((e) => (
              <div key={e.id} className="glass rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">{e.query}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(e.timestamp).toLocaleString("es-CO")} · {formatCOP(e.valorTotal)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-foreground">{e.score}</span>
                  <span
                    className={cn(
                      "text-xs font-semibold px-2 py-1 rounded-full",
                      e.nivel === "ALTO" && "bg-destructive/20 text-destructive",
                      e.nivel === "MEDIO" && "bg-warning/20 text-warning",
                      e.nivel !== "ALTO" && e.nivel !== "MEDIO" && "bg-success/20 text-success"
                    )}
                  >
                    {e.nivel}
                  </span>
                  <Link
                    href={`/investigacion/${encodeURIComponent(e.query)}`}
                    className="size-9 rounded-lg glass flex items-center justify-center text-primary hover:bg-primary/10"
                    title="Abrir expediente"
                  >
                    <ExternalLink className="size-4" />
                  </Link>
                  <button
                    onClick={() => handleRemove(e.id)}
                    className="size-9 rounded-lg glass flex items-center justify-center text-muted-foreground hover:text-destructive"
                    title="Eliminar"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}

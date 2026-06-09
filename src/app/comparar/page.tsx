"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { GitCompare, ArrowRight, Loader2 } from "lucide-react"
import { AppShell } from "@/components/app-shell"

const PRESETS = [
  { a: "UNGRD", b: "ICBF" },
  { a: "UNGRD", b: "Ministerio de Salud" },
  { a: "ICBF", b: "Alcaldía de Bogotá" },
]

export default function CompararPage() {
  const router = useRouter()
  const [entityA, setEntityA] = useState("")
  const [entityB, setEntityB] = useState("")
  const [loading, setLoading] = useState(false)

  const handleCompare = (a: string, b: string) => {
    if (!a.trim() || !b.trim()) return
    setLoading(true)
    router.push(`/comparar/${encodeURIComponent(a.trim())}/${encodeURIComponent(b.trim())}`)
  }

  return (
    <AppShell title="Comparar Entidades" subtitle="Análisis comparativo de riesgo contractual">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="glass rounded-2xl p-6 glow space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <GitCompare className="size-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Seleccione dos entidades</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Entidad A — ej: UNGRD"
              value={entityA}
              onChange={(e) => setEntityA(e.target.value)}
              className="glass rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground bg-transparent border border-border focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <input
              type="text"
              placeholder="Entidad B — ej: ICBF"
              value={entityB}
              onChange={(e) => setEntityB(e.target.value)}
              className="glass rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground bg-transparent border border-border focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <button
            onClick={() => handleCompare(entityA, entityB)}
            disabled={!entityA.trim() || !entityB.trim() || loading}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
            Comparar
          </button>
        </div>

        <div>
          <p className="text-sm text-muted-foreground mb-3">Comparaciones rápidas:</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={`${p.a}-${p.b}`}
                onClick={() => handleCompare(p.a, p.b)}
                className="px-4 py-2 rounded-lg text-sm glass-hover text-muted-foreground hover:text-foreground transition-all"
              >
                {p.a} vs {p.b}
              </button>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  )
}

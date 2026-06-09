"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Loader2, GitCompare, AlertTriangle, ExternalLink } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { AIAnalystPanel } from "@/components/ai-analyst-panel"
import { cn, formatCOP } from "@/lib/utils"
import { buildDerivedComparativeAnalysis } from "@/lib/analysis"
import type { ComparativeAnalystAnalysis, SearchResult } from "@/lib/types"

interface CompareResponse {
  entidadA: SearchResult
  entidadB: SearchResult
  comparacion: { mayorRiesgo: string; diferenciaScore: number }
}

function CompareRow({ label, a, b }: { label: string; a: string; b: string }) {
  return (
    <tr className="border-b border-border/50">
      <td className="py-3 pr-4 text-muted-foreground text-sm">{label}</td>
      <td className="py-3 pr-4 text-foreground text-sm font-medium">{a}</td>
      <td className="py-3 text-foreground text-sm font-medium">{b}</td>
    </tr>
  )
}

function EntityCard({ result, label }: { result: SearchResult; label: string }) {
  const { riesgo } = result
  const isHigh = riesgo.nivel === "ALTO"
  const isMed = riesgo.nivel === "MEDIO"

  return (
    <div className={cn("glass rounded-2xl p-6 space-y-4", isHigh && "glow-danger", isMed && "glow-warning", !isHigh && !isMed && "glow-success")}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
        <Link href={`/investigacion/${encodeURIComponent(result.query)}`} className="text-xs text-primary hover:underline flex items-center gap-1">
          Expediente <ExternalLink className="size-3" />
        </Link>
      </div>
      <h3 className="text-xl font-semibold text-foreground">{result.query}</h3>
      <div className="flex items-baseline gap-2">
        <span className={cn("text-4xl font-bold", isHigh && "text-destructive", isMed && "text-warning", !isHigh && !isMed && "text-success")}>{riesgo.score}</span>
        <span className="text-muted-foreground">/100</span>
        <span className={cn("ml-auto px-3 py-1 rounded-full text-xs font-semibold", isHigh && "bg-destructive/20 text-destructive", isMed && "bg-warning/20 text-warning", !isHigh && !isMed && "bg-success/20 text-success")}>{riesgo.nivel}</span>
      </div>
    </div>
  )
}

export default function CompararResultPage() {
  const params = useParams()
  const entidadA = decodeURIComponent(params.entidadA as string)
  const entidadB = decodeURIComponent(params.entidadB as string)

  const [data, setData] = useState<CompareResponse | null>(null)
  const [comparative, setComparative] = useState<ComparativeAnalystAnalysis | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/agent/compare?a=${encodeURIComponent(entidadA)}&b=${encodeURIComponent(entidadB)}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json() })
      .then((compareData: CompareResponse) => {
        setData(compareData)
        setAnalysisLoading(true)
        return fetch("/api/agent/analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: `${entidadA} vs ${entidadB}`, result: compareData.entidadA, compareWith: compareData.entidadB }),
        })
          .then((r) => r.json())
          .then((res) => setComparative(res.analysis as ComparativeAnalystAnalysis))
          .catch(() => setComparative(buildDerivedComparativeAnalysis(compareData.entidadA, compareData.entidadB)))
          .finally(() => setAnalysisLoading(false))
      })
      .catch(() => setError("No se pudo completar la comparación."))
      .finally(() => setLoading(false))
  }, [entidadA, entidadB])

  if (loading) {
    return (
      <AppShell title="Comparando entidades..." subtitle={`${entidadA} vs ${entidadB}`} backHref="/comparar">
        <div className="flex flex-col items-center py-24 gap-4">
          <Loader2 className="size-8 text-primary animate-spin" />
          <p className="text-muted-foreground">Ejecutando dos investigaciones reales...</p>
        </div>
      </AppShell>
    )
  }

  if (error || !data) {
    return (
      <AppShell title="Error en comparación" backHref="/comparar">
        <div className="glass rounded-2xl p-8 text-center">
          <AlertTriangle className="size-10 text-warning mx-auto mb-4" />
          <p className="text-foreground">{error}</p>
        </div>
      </AppShell>
    )
  }

  const a = data.entidadA.riesgo
  const b = data.entidadB.riesgo
  const fa = data.entidadA.fuentes
  const fb = data.entidadB.fuentes

  return (
    <AppShell title={`${entidadA} vs ${entidadB}`} subtitle={`Mayor riesgo: ${data.comparacion.mayorRiesgo} · Δ ${data.comparacion.diferenciaScore} pts`} backHref="/comparar">
      <div className="space-y-6">
        <div className="glass rounded-xl p-4 flex items-center gap-3">
          <GitCompare className="size-5 text-primary" />
          <p className="text-sm text-foreground">Comparación basada en investigaciones reales en 13 fuentes públicas.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <EntityCard result={data.entidadA} label="Entidad A" />
          <EntityCard result={data.entidadB} label="Entidad B" />
        </div>

        <div className="glass rounded-2xl p-6 overflow-x-auto">
          <h3 className="text-lg font-semibold text-foreground mb-4">Comparativa Detallada</h3>
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="py-2 pr-4">Métrica</th>
                <th className="py-2 pr-4">{entidadA}</th>
                <th className="py-2">{entidadB}</th>
              </tr>
            </thead>
            <tbody>
              <CompareRow label="Score" a={`${a.score}/100`} b={`${b.score}/100`} />
              <CompareRow label="Nivel" a={a.nivel} b={b.nivel} />
              <CompareRow label="Contratos" a={String(a.totalContratos)} b={String(b.totalContratos)} />
              <CompareRow label="Valor contratado" a={formatCOP(a.valorTotal)} b={formatCOP(b.valorTotal)} />
              <CompareRow label="Directos" a={String(a.directos)} b={String(b.directos)} />
              <CompareRow label="Sin competencia" a={String(a.sinCompetencia)} b={String(b.sinCompetencia)} />
              <CompareRow label="Procuraduría" a={String(fa.procuraduria)} b={String(fb.procuraduria)} />
              <CompareRow label="CGR fiscal" a={formatCOP(a.montoCGR)} b={formatCOP(b.montoCGR)} />
              <CompareRow label="Sanciones" a={String(fa.sanciones)} b={String(fb.sanciones)} />
              <CompareRow label="Hallazgos" a={String(a.hallazgos.length)} b={String(b.hallazgos.length)} />
            </tbody>
          </table>
        </div>

        <AIAnalystPanel comparative={comparative} loading={analysisLoading} />
      </div>
    </AppShell>
  )
}

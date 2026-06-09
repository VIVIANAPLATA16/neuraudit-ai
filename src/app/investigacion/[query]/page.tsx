"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { AlertTriangle, Download, Loader2 } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { ExpedienteSections } from "@/components/expediente-sections"
import { cn } from "@/lib/utils"
import { loadInvestigation, saveInvestigation } from "@/lib/investigation-store"
import { buildInterpretacion } from "@/lib/interpretation"
import { buildInvestigationAnalytics } from "@/lib/data-analytics"
import { buildDerivedAnalysis } from "@/lib/analysis"
import { addToHistory } from "@/lib/history"
import type { AnalystAnalysis, SearchResult } from "@/lib/types"
import type { InvestigationAnalytics } from "@/lib/data-analytics"

export default function InvestigacionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const query = decodeURIComponent(params.query as string)

  const [result, setResult] = useState<SearchResult | null>(null)
  const [analytics, setAnalytics] = useState<InvestigationAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [analisisIA, setAnalisisIA] = useState<AnalystAnalysis | null>(null)
  const [analisisLoading, setAnalisisLoading] = useState(false)

  const enrich = (data: SearchResult): SearchResult => {
    const interpretacion = data.interpretacion || buildInterpretacion({
      query: data.query, riesgo: data.riesgo, fuentes: data.fuentes,
      contratos: data.contratos, timestamp: data.timestamp,
    })
    const a = buildInvestigationAnalytics({ ...data, interpretacion })
    setAnalytics(a)
    return { ...data, interpretacion, analytics: a as unknown as Record<string, unknown> }
  }

  const fetchAnalysis = (data: SearchResult) => {
    if (data.analisisIA) { setAnalisisIA(data.analisisIA); return }
    setAnalisisLoading(true)
    fetch("/api/agent/analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: data.query, result: data }),
    })
      .then((r) => r.json())
      .then((res) => {
        const analysis = res.analysis as AnalystAnalysis
        setAnalisisIA(analysis)
        const updated = { ...data, analisisIA: analysis }
        setResult(updated)
        saveInvestigation(updated)
      })
      .catch(() => setAnalisisIA(buildDerivedAnalysis(data)))
      .finally(() => setAnalisisLoading(false))
  }

  useEffect(() => {
    const cached = loadInvestigation(query)
    if (cached) {
      const enriched = enrich(cached)
      setResult(enriched)
      addToHistory(enriched)
      if (cached.analisisIA) setAnalisisIA(cached.analisisIA)
      setLoading(false)
      if (!cached.analisisIA) fetchAnalysis(enriched)
      return
    }

    fetch(`/api/agent/search?q=${encodeURIComponent(query)}`)
      .then((res) => { if (!res.ok) throw new Error(); return res.json() })
      .then((data: SearchResult) => {
        const enriched = enrich(data)
        saveInvestigation(enriched)
        addToHistory(enriched)
        setResult(enriched)
        fetchAnalysis(enriched)
      })
      .catch(() => setError("No se pudo cargar la investigación."))
      .finally(() => setLoading(false))
  }, [query])

  const handleDownloadPdf = async () => {
    setPdfLoading(true)
    try {
      const res = await fetch(`/api/expediente/pdf?q=${encodeURIComponent(query)}`)
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `expediente-neuraudit-${query.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch { setError("No se pudo generar el PDF.") }
    finally { setPdfLoading(false) }
  }

  if (loading) {
    return (
      <AppShell title="Cargando expediente..." subtitle={query}>
        <div className="flex flex-col items-center py-24 gap-4">
          <Loader2 className="size-8 text-primary animate-spin" />
          <p className="text-muted-foreground">Consultando fuentes y preparando expediente...</p>
        </div>
      </AppShell>
    )
  }

  if (error || !result || !analytics) {
    return (
      <AppShell title="Expediente no disponible" subtitle={query}>
        <div className="glass rounded-2xl p-8 text-center">
          <AlertTriangle className="size-10 text-warning mx-auto mb-4" />
          <p className="text-foreground mb-4">{error || "Sin datos."}</p>
          <button onClick={() => router.push("/")} className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium">Nueva investigación</button>
        </div>
      </AppShell>
    )
  }

  const { riesgo, interpretacion } = result
  const isHigh = riesgo.nivel === "ALTO"
  const isMed = riesgo.nivel === "MEDIO"

  return (
    <AppShell title={`Expediente — ${query}`} subtitle={`Score ${riesgo.score}/100 · ${interpretacion?.clasificacion || riesgo.nivel}`} backHref="/">
      <div className="space-y-6">
        <div className={cn("glass rounded-2xl p-4 flex justify-end", isHigh && "glow-danger", isMed && "glow-warning", !isHigh && !isMed && "glow-success")}>
          <button onClick={handleDownloadPdf} disabled={pdfLoading} className="px-5 py-3 rounded-xl bg-primary text-primary-foreground font-medium flex items-center gap-2 disabled:opacity-50">
            {pdfLoading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Descargar PDF Institucional
          </button>
        </div>
        <ExpedienteSections result={result} analytics={analytics} analisisIA={analisisIA} analisisLoading={analisisLoading} />
      </div>
    </AppShell>
  )
}

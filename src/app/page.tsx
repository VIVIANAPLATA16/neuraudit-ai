"use client"

import { useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, Sparkles, ArrowRight, AlertTriangle } from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { AITimeline } from "@/components/ai-timeline"
import { InvestigationResults } from "@/components/investigation-results"
import { formatCOP } from "@/lib/utils"
import { saveInvestigation } from "@/lib/investigation-store"
import { addToHistory } from "@/lib/history"
import { buildDerivedAnalysis } from "@/lib/analysis"
import type { AnalystAnalysis } from "@/lib/types"
import type { SearchResult } from "@/lib/types"

const quickExamples = [
  { name: "UNGRD", label: "UNGRD" },
  { name: "ICBF", label: "ICBF" },
  { name: "Ministerio de Salud", label: "Min. Salud" },
  { name: "Alcaldía de Bogotá", label: "Alcaldía Bogotá" },
]

type ViewState = "home" | "loading" | "results"

function mapResultToDisplay(result: SearchResult) {
  const { riesgo, fuentes } = result
  return {
    alerts: riesgo.alertas,
    contractValue: formatCOP(riesgo.valorTotal),
    fiscalResponsibility: formatCOP(riesgo.montoCGR),
    processCount: riesgo.totalContratos > 0 ? riesgo.totalContratos : fuentes.total,
    sources: [
      { name: "SECOP II", checked: fuentes.secopII > 0 },
      { name: "Contraloría", checked: fuentes.cgr > 0 },
      { name: "Procuraduría", checked: fuentes.procuraduria > 0 },
      { name: "SGR (Regalías)", checked: fuentes.sgr > 0 },
      { name: "Sanciones", checked: fuentes.sanciones > 0 },
      { name: "Datos Abiertos Colombia", checked: fuentes.total > 0 },
    ],
  }
}

export default function NeurAuditAI() {
  const [searchQuery, setSearchQuery] = useState("")
  const [viewState, setViewState] = useState<ViewState>("home")
  const [currentStep, setCurrentStep] = useState(0)
  const [entityName, setEntityName] = useState("")
  const [riskScore, setRiskScore] = useState(0)
  const [resultData, setResultData] = useState<ReturnType<typeof mapResultToDisplay> | null>(null)
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null)
  const [analisisIA, setAnalisisIA] = useState<AnalystAnalysis | null>(null)
  const [analisisLoading, setAnalisisLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const stepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopStepTimer = () => {
    if (stepTimerRef.current) {
      clearInterval(stepTimerRef.current)
      stepTimerRef.current = null
    }
  }

  const startStepTimer = () => {
    stopStepTimer()
    setCurrentStep(0)
    stepTimerRef.current = setInterval(() => {
      setCurrentStep((prev) => Math.min(prev + 1, 5))
    }, 800)
  }

  const handleSearch = async (query: string) => {
    const term = query.trim()
    if (!term) return

    setError(null)
    setEntityName(term)
    setSearchQuery(term)
    setViewState("loading")
    startStepTimer()

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 60000)

      const response = await fetch(
        `/api/agent/search?q=${encodeURIComponent(term)}`,
        { signal: controller.signal }
      )
      clearTimeout(timeout)

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || "Error en la búsqueda")
      }

      const data: SearchResult = await response.json()
      saveInvestigation(data)
      addToHistory(data)
      stopStepTimer()
      setCurrentStep(6)
      setRiskScore(data.riesgo.score)
      setSearchResult(data)
      setResultData(mapResultToDisplay(data))
      setViewState("results")

      setAnalisisLoading(true)
      fetch("/api/agent/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: term, result: data }),
      })
        .then((r) => r.json())
        .then((res) => {
          const analysis = res.analysis as AnalystAnalysis
          setAnalisisIA(analysis)
          const updated = { ...data, analisisIA: analysis }
          setSearchResult(updated)
          saveInvestigation(updated)
        })
        .catch(() => {
          const derived = buildDerivedAnalysis(data)
          setAnalisisIA(derived)
          saveInvestigation({ ...data, analisisIA: derived })
        })
        .finally(() => setAnalisisLoading(false))
    } catch (err) {
      stopStepTimer()
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("La búsqueda excedió el tiempo límite. Intente con un término más específico.")
      } else {
        setError("No se pudo completar la búsqueda. Verifique su conexión e intente nuevamente.")
      }
      setViewState("home")
      console.error(err)
    }
  }

  const handleGeneratePdf = async () => {
    if (!entityName) return
    setPdfLoading(true)
    try {
      const res = await fetch(`/api/expediente/pdf?q=${encodeURIComponent(entityName)}`)
      if (!res.ok) throw new Error("Error generando PDF")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `expediente-neuraudit-${entityName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error(err)
    } finally {
      setPdfLoading(false)
    }
  }

  const handleNewInvestigation = () => {
    stopStepTimer()
    setViewState("home")
    setSearchQuery("")
    setEntityName("")
    setCurrentStep(0)
    setResultData(null)
    setSearchResult(null)
    setAnalisisIA(null)
    setError(null)
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar onNewInvestigation={handleNewInvestigation} />

      <main className="flex-1 overflow-auto">
        <AnimatePresence mode="wait">
          {viewState === "home" && (
            <motion.div
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="min-h-full flex flex-col"
            >
              {/* Header */}
              <header className="flex items-center justify-between px-8 py-6">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="size-4 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </div>
                  <span className="font-semibold text-foreground">NeurAudit AI</span>
                  <span className="text-muted-foreground text-sm">|</span>
                  <span className="text-muted-foreground text-sm">Inteligencia Anticorrupción para Colombia</span>
                </div>

                <div className="flex items-center gap-3">
                  <button className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Ver Demo
                  </button>
                  <button
                    onClick={() => document.getElementById("search-input")?.focus()}
                    className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
                  >
                    <Search className="size-4" />
                    Investigar Entidad
                  </button>
                </div>
              </header>

              {/* Hero */}
              <div className="flex-1 flex flex-col items-center justify-center px-8 pb-32">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-center max-w-3xl mx-auto mb-12"
                >
                  <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6 leading-tight">
                    Detecta riesgos de corrupción{" "}
                    <span className="gradient-text">antes de que ocurra el daño fiscal</span>
                  </h1>
                  <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                    NeurAudit analiza SECOP, Contraloría, Procuraduría, Regalías y múltiples fuentes públicas usando IA para identificar patrones de riesgo.
                  </p>
                </motion.div>

                {/* Search Box */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="w-full max-w-2xl"
                >
                  {error && (
                    <div className="mb-4 glass rounded-xl p-4 border border-destructive/30 flex items-center gap-3">
                      <AlertTriangle className="size-5 text-destructive shrink-0" />
                      <p className="text-sm text-foreground">{error}</p>
                    </div>
                  )}

                  <div className="relative">
                    <div className="glass rounded-2xl p-2 glow">
                      <div className="flex items-center gap-3">
                        <div className="pl-4">
                          <Sparkles className="size-5 text-primary" />
                        </div>
                        <input
                          id="search-input"
                          type="text"
                          placeholder="Ejemplo: Investiga la UNGRD"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSearch(searchQuery)}
                          className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground py-4 text-lg focus:outline-none"
                        />
                        <button
                          onClick={() => handleSearch(searchQuery)}
                          disabled={!searchQuery.trim()}
                          className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium flex items-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Analizar
                          <ArrowRight className="size-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Quick Examples */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="flex items-center justify-center gap-2 mt-6 flex-wrap"
                  >
                    <span className="text-sm text-muted-foreground mr-2">Ejemplos rápidos:</span>
                    {quickExamples.map((example) => (
                      <button
                        key={example.name}
                        onClick={() => {
                          setSearchQuery(example.name)
                          handleSearch(example.name)
                        }}
                        className="px-4 py-2 rounded-lg text-sm glass-hover text-muted-foreground hover:text-foreground transition-all"
                      >
                        {example.label}
                      </button>
                    ))}
                  </motion.div>
                </motion.div>
              </div>
            </motion.div>
          )}

          {viewState === "loading" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="min-h-full flex flex-col items-center justify-center px-8"
            >
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-12"
              >
                <h2 className="text-2xl font-semibold text-foreground mb-2">
                  Investigando {entityName}
                </h2>
                <p className="text-muted-foreground">
                  Analizando múltiples fuentes gubernamentales con IA
                </p>
              </motion.div>

              <AITimeline currentStep={currentStep} />
            </motion.div>
          )}

          {viewState === "results" && resultData && (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="min-h-full py-12 px-8"
            >
              <InvestigationResults
                entityName={entityName}
                riskScore={riskScore}
                data={resultData}
                riesgo={searchResult?.riesgo}
                interpretacion={searchResult?.interpretacion}
                analisisIA={analisisIA}
                analisisLoading={analisisLoading}
                detailsHref={`/investigacion/${encodeURIComponent(entityName)}`}
                onGeneratePdf={handleGeneratePdf}
                pdfLoading={pdfLoading}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}

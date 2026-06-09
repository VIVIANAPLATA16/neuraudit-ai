"use client"

import { motion } from "framer-motion"
import { Bot, Loader2, Cpu, Clock, Zap, CheckCircle2, XCircle } from "lucide-react"
import type { AnalystAnalysis, ComparativeAnalystAnalysis } from "@/lib/types"
import { cn } from "@/lib/utils"

interface AIAnalystPanelProps {
  analysis?: AnalystAnalysis | null
  comparative?: ComparativeAnalystAnalysis | null
  loading?: boolean
  delay?: number
}

function Section({ title, content }: { title: string; content: string }) {
  if (!content?.trim()) return null
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      {content.split("\n\n").map((p, i) => (
        <p key={i} className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
          {p.trim()}
        </p>
      ))}
    </div>
  )
}

function MetaBar({ meta, source }: { meta?: AnalystAnalysis["meta"]; source?: string }) {
  if (!meta && !source) return null
  const engine = meta?.engine || source || "derived"
  const labels: Record<string, string> = {
    adk: "Motor ADK + Gemini",
    gemini: "Gemini directo",
    derived: "Análisis derivado (fallback)",
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20 mb-5">
      <div className="flex items-center gap-2">
        <Cpu className="size-4 text-primary shrink-0" />
        <div>
          <p className="text-xs text-muted-foreground">Modelo</p>
          <p className="text-xs font-medium text-foreground">{meta?.model || "gemini-2.5-flash"}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {meta?.geminiConnected ? (
          <CheckCircle2 className="size-4 text-success shrink-0" />
        ) : (
          <XCircle className="size-4 text-muted-foreground shrink-0" />
        )}
        <div>
          <p className="text-xs text-muted-foreground">Gemini</p>
          <p className="text-xs font-medium text-foreground">
            {meta?.geminiConnected ? "Conectado" : "Fallback local"}
          </p>
        </div>
      </div>
      {meta?.durationMs !== undefined && meta.durationMs > 0 && (
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-accent shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Tiempo</p>
            <p className="text-xs font-medium text-foreground">{(meta.durationMs / 1000).toFixed(1)}s</p>
          </div>
        </div>
      )}
      <div className="flex items-center gap-2">
        <Zap className="size-4 text-warning shrink-0" />
        <div>
          <p className="text-xs text-muted-foreground">Fuente</p>
          <p className={cn("text-xs font-medium", engine === "adk" && "text-primary")}>
            {labels[engine] || engine}
          </p>
        </div>
      </div>
      {meta?.estimatedTokens ? (
        <div className="col-span-2 sm:col-span-4 text-xs text-muted-foreground">
          Tokens estimados: ~{meta.estimatedTokens.toLocaleString("es-CO")}
        </div>
      ) : null}
    </div>
  )
}

export function AIAnalystPanel({ analysis, comparative, loading, delay = 0 }: AIAnalystPanelProps) {
  const isCompare = !!comparative

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="glass rounded-2xl p-6"
    >
      <div className="flex items-center gap-3 mb-2">
        <Bot className="size-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">
          {isCompare ? "Análisis Comparativo IA" : "🤖 Analista IA"}
        </h3>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 py-6">
          <Loader2 className="size-5 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">
            El motor NeurAudit ADK está elaborando el informe de auditoría...
          </p>
        </div>
      ) : isCompare && comparative ? (
        <>
          <MetaBar meta={comparative.meta} source={comparative.source} />
          <div className="space-y-5">
            <Section title="Entidad de mayor riesgo" content={comparative.entidadMayorRiesgo} />
            <Section title="Diferencias relevantes" content={comparative.diferenciasRelevantes} />
            <Section title="Prioridades de auditoría" content={comparative.prioridadesAuditoria} />
            {comparative.entidadAuditarPrimero && (
              <Section title="Auditar primero" content={`${comparative.entidadAuditarPrimero}. ${comparative.justificacionPrioridad || ""}`} />
            )}
            <Section title="Conclusión" content={comparative.conclusion} />
          </div>
        </>
      ) : analysis ? (
        <>
          <MetaBar meta={analysis.meta} source={analysis.source} />
          <div className="space-y-5">
            <Section title="1. Resumen Ejecutivo" content={analysis.resumenEjecutivo} />
            <Section title="2. Evaluación de Riesgo" content={analysis.evaluacionRiesgo} />
            <Section title="3. Hallazgos Críticos" content={analysis.hallazgosCriticos} />
            <Section title="4. Evaluación de Contratación" content={analysis.evaluacionContratacion} />
            <Section title="5. Riesgo de Concentración" content={analysis.riesgoConcentracion} />
            <Section title="6. Riesgo Disciplinario" content={analysis.riesgoDisciplinario} />
            <Section title="7. Riesgo Fiscal" content={analysis.riesgoFiscal} />
            <Section title="8. Recomendaciones" content={analysis.recomendaciones} />
            <Section title="9. Conclusión" content={analysis.conclusion} />
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground py-4">
          Análisis no disponible. Los datos se procesarán automáticamente.
        </p>
      )}
    </motion.div>
  )
}

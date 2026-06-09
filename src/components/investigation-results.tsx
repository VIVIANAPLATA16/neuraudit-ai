"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { AlertTriangle, TrendingUp, FileText, Database, CheckCircle2, ExternalLink, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { IntelligenceSections } from "@/components/intelligence-sections"
import type { AnalystAnalysis, InterpretacionAnalisis, RiskData } from "@/lib/types"

interface InvestigationResultsProps {
  entityName: string
  riskScore: number
  data: {
    alerts: string[]
    contractValue: string
    fiscalResponsibility: string
    processCount: number
    sources: { name: string; checked: boolean }[]
  }
  riesgo?: RiskData
  interpretacion?: InterpretacionAnalisis | null
  analisisIA?: AnalystAnalysis | null
  analisisLoading?: boolean
  detailsHref?: string
  onGeneratePdf?: () => void
  pdfLoading?: boolean
}

export function InvestigationResults({
  entityName,
  riskScore,
  data,
  riesgo,
  interpretacion,
  analisisIA,
  analisisLoading,
  detailsHref,
  onGeneratePdf,
  pdfLoading,
}: InvestigationResultsProps) {
  const riskLevel = riskScore >= 80 ? "ALTO" : riskScore >= 50 ? "MEDIO" : "BAJO"
  const isHighRisk = riskScore >= 80
  const isMediumRisk = riskScore >= 50 && riskScore < 80

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full max-w-4xl mx-auto space-y-8"
    >
      {/* Risk Score Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={cn(
          "glass rounded-2xl p-8",
          isHighRisk && "glow-danger",
          isMediumRisk && "glow-warning",
          !isHighRisk && !isMediumRisk && "glow-success"
        )}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-muted-foreground text-sm mb-1">Entidad analizada</p>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{entityName}</h2>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground text-sm mb-1">Score de Riesgo</p>
            <div className="flex items-baseline gap-2">
              <span
                className={cn(
                  "text-5xl font-bold",
                  isHighRisk && "text-destructive",
                  isMediumRisk && "text-warning",
                  !isHighRisk && !isMediumRisk && "text-success"
                )}
              >
                {riskScore}
              </span>
              <span className="text-muted-foreground">/100</span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-4">
          <span
            className={cn(
              "px-4 py-2 rounded-full text-sm font-semibold",
              isHighRisk && "bg-destructive/20 text-destructive",
              isMediumRisk && "bg-warning/20 text-warning",
              !isHighRisk && !isMediumRisk && "bg-success/20 text-success"
            )}
          >
            RIESGO {riskLevel}
          </span>
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${riskScore}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className={cn(
                "h-full rounded-full",
                isHighRisk && "bg-destructive",
                isMediumRisk && "bg-warning",
                !isHighRisk && !isMediumRisk && "bg-success"
              )}
            />
          </div>
        </div>
      </motion.div>

      {/* Alerts Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass rounded-2xl p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="size-5 text-warning" />
          <h3 className="text-lg font-semibold text-foreground">Alertas Detectadas</h3>
        </div>
        <div className="grid gap-3">
          {data.alerts.length > 0 ? (
            data.alerts.map((alert, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + index * 0.05 }}
                className="flex items-start gap-3 p-4 rounded-xl bg-warning/5 border border-warning/20"
              >
                <AlertTriangle className="size-4 text-warning mt-0.5 shrink-0" />
                <p className="text-sm text-foreground">{alert}</p>
              </motion.div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No se detectaron alertas de alta criticidad.
            </p>
          )}
        </div>
      </motion.div>

      {/* Economic Impact */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="size-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <TrendingUp className="size-5 text-primary" />
            </div>
          </div>
          <p className="text-muted-foreground text-sm mb-1">Valor Contratado</p>
          <p className="text-2xl font-bold text-foreground">{data.contractValue}</p>
        </div>

        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="size-10 rounded-lg bg-destructive/20 flex items-center justify-center">
              <AlertTriangle className="size-5 text-destructive" />
            </div>
          </div>
          <p className="text-muted-foreground text-sm mb-1">Responsabilidad Fiscal</p>
          <p className="text-2xl font-bold text-foreground">{data.fiscalResponsibility}</p>
          {riesgo?.montoCGR === 0 && (
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              No se identificaron fallos fiscales activos. Esto no elimina otros riesgos administrativos, disciplinarios o contractuales.
            </p>
          )}
        </div>

        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="size-10 rounded-lg bg-accent/20 flex items-center justify-center">
              <FileText className="size-5 text-accent" />
            </div>
          </div>
          <p className="text-muted-foreground text-sm mb-1">Procesos Encontrados</p>
          <p className="text-2xl font-bold text-foreground">{data.processCount.toLocaleString()}</p>
        </div>
      </motion.div>

      {/* Sources */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass rounded-2xl p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <Database className="size-5 text-accent" />
          <h3 className="text-lg font-semibold text-foreground">Fuentes Consultadas</h3>
        </div>
        <div className="flex flex-wrap gap-3">
          {data.sources.map((source, index) => (
            <motion.div
              key={source.name}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 + index * 0.05 }}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 border border-border"
            >
              {source.checked && <CheckCircle2 className="size-4 text-success" />}
              <span className="text-sm text-foreground">{source.name}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {riesgo && (
        <IntelligenceSections
          riesgo={riesgo}
          interpretacion={interpretacion}
          analisisIA={analisisIA}
          analisisLoading={analisisLoading}
          delay={0.35}
        />
      )}

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="flex justify-center gap-4 pb-8"
      >
        <button
          onClick={onGeneratePdf}
          disabled={pdfLoading || !onGeneratePdf}
          className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium flex items-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {pdfLoading ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
          Generar Expediente PDF
        </button>
        <Link
          href={detailsHref || `/investigacion/${encodeURIComponent(entityName)}`}
          className="px-6 py-3 rounded-xl glass border border-border text-foreground font-medium flex items-center gap-2 hover:bg-muted transition-colors"
        >
          <ExternalLink className="size-4" />
          Ver Detalles Completos
        </Link>
      </motion.div>
    </motion.div>
  )
}

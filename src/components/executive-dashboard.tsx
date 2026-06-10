"use client"

import { motion } from "framer-motion"
import { Database, Search, Plug, Shield } from "lucide-react"
import { cn, formatCOP } from "@/lib/utils"
import { buildExecutiveSummary, riskLabel } from "@/lib/executive-summary"
import type { ElasticInsights, InterpretacionAnalisis, RiskData } from "@/lib/types"

interface ExecutiveDashboardProps {
  entityName: string
  riskScore: number
  riesgo: RiskData
  interpretacion?: InterpretacionAnalisis | null
  elasticInsights?: ElasticInsights | null
  sourcesTotal?: number
  delay?: number
}

function RiskGauge({ score }: { score: number }) {
  const level = riskLabel(score)
  const color =
    level === "Alto" ? "var(--destructive)" : level === "Medio" ? "var(--warning)" : "var(--success)"

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative size-28 rounded-full flex items-center justify-center"
        style={{
          background: `conic-gradient(${color} ${score * 3.6}deg, rgba(255,255,255,0.08) 0deg)`,
        }}
      >
        <div className="size-20 rounded-full bg-background/90 flex flex-col items-center justify-center border border-border">
          <span className="text-2xl font-bold text-foreground">{score}</span>
          <span className="text-[10px] text-muted-foreground">/100</span>
        </div>
      </div>
      <p className="text-xs font-semibold text-foreground">Risk Score</p>
    </div>
  )
}

function FactorBars({ riesgo }: { riesgo: RiskData }) {
  const factors = (riesgo.scoreBreakdown || []).slice(0, 5)
  const maxPts = Math.max(...factors.map((f) => f.points), 1)

  return (
    <div className="space-y-2">
      {factors.map((f) => (
        <div key={f.factor}>
          <div className="flex justify-between text-xs mb-1 gap-2">
            <span className="text-foreground truncate">{f.factor}</span>
            <span className="text-muted-foreground shrink-0">+{f.points}</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full"
              style={{ width: `${Math.max(8, (f.points / maxPts) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function ElasticTrackStrip({ insights }: { insights?: ElasticInsights | null }) {
  const searchOk = insights?.status === "ok"
  const hits = insights?.totalHits ?? 0
  const viaMcp = insights?.retrievalMethod === "elastic-agent-builder-mcp"
  const mcpTool = insights?.mcpTool

  const items = [
    {
      label: viaMcp
        ? `Elastic MCP · ${mcpTool || "search"}`
        : searchOk
          ? "Elasticsearch SDK"
          : "Elastic unavailable",
      ok: viaMcp || searchOk,
    },
    {
      label: hits > 0 ? `Evidence · ${hits} hits` : "No evidence hits",
      ok: hits > 0,
    },
  ]

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item.label}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border",
            item.ok
              ? "bg-success/10 text-success border-success/30"
              : "bg-muted/40 text-muted-foreground border-border"
          )}
        >
          <Search className="size-3" />
          {item.label}
        </span>
      ))}
    </div>
  )
}

export function ExecutiveDashboard({
  entityName,
  riskScore,
  riesgo,
  interpretacion,
  elasticInsights,
  sourcesTotal,
  delay = 0,
}: ExecutiveDashboardProps) {
  const summary = buildExecutiveSummary(riesgo, interpretacion)
  const distribution = {
    bajo: riskScore < 50 ? 1 : 0,
    medio: riskScore >= 50 && riskScore < 75 ? 1 : 0,
    alto: riskScore >= 75 ? 1 : 0,
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="glass rounded-2xl p-6 space-y-6"
    >
      <div className="flex items-center gap-2 text-xs text-primary font-semibold uppercase tracking-wider">
        <Shield className="size-4" />
        Executive Intelligence · {entityName}
      </div>

      <ElasticTrackStrip insights={elasticInsights} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-muted/20">
          <RiskGauge score={riskScore} />
          <p className="text-sm font-semibold text-foreground">
            {summary.riskEmoji} Riesgo {summary.riskLabel}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-muted/20 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Distribución</p>
          {[
            { key: "Bajo", on: distribution.bajo, color: "bg-success" },
            { key: "Medio", on: distribution.medio, color: "bg-warning" },
            { key: "Alto", on: distribution.alto, color: "bg-destructive" },
          ].map((d) => (
            <div key={d.key} className="flex items-center gap-2 text-sm">
              <span className={cn("size-2.5 rounded-full", d.on ? d.color : "bg-muted")} />
              <span className={d.on ? "text-foreground font-medium" : "text-muted-foreground"}>
                {d.key}
              </span>
            </div>
          ))}
        </div>

        <div className="p-4 rounded-xl bg-muted/20">
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Factores de Riesgo</p>
          <FactorBars riesgo={riesgo} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-2">Resumen Ejecutivo</h4>
          <ul className="space-y-2">
            {(summary.bullets.length ? summary.bullets : ["Investigación completada con datos oficiales."]).map(
              (b, i) => (
                <li key={i} className="text-sm text-muted-foreground flex gap-2">
                  <span className="text-primary">•</span>
                  <span>{b}</span>
                </li>
              )
            )}
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-foreground mb-2">Hallazgos Clave</h4>
          <ul className="space-y-2">
            {summary.hallazgos.length ? (
              summary.hallazgos.map((h, i) => (
                <li key={i} className="text-sm p-2 rounded-lg bg-accent/5 border border-accent/15">
                  <span className="font-medium text-foreground">{h.titulo}</span>
                  <p className="text-muted-foreground mt-0.5">{h.descripcion}</p>
                </li>
              ))
            ) : (
              <li className="text-sm text-muted-foreground">Sin hallazgos críticos adicionales.</li>
            )}
          </ul>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-foreground mb-2">Evidencia</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="p-3 rounded-xl bg-muted/30">
            <p className="text-xs text-muted-foreground">Contratos</p>
            <p className="font-semibold text-foreground">{riesgo.totalContratos.toLocaleString("es-CO")}</p>
          </div>
          <div className="p-3 rounded-xl bg-muted/30">
            <p className="text-xs text-muted-foreground">Valor</p>
            <p className="font-semibold text-foreground">{formatCOP(riesgo.valorTotal)}</p>
          </div>
          <div className="p-3 rounded-xl bg-muted/30">
            <p className="text-xs text-muted-foreground">Fuentes</p>
            <p className="font-semibold text-foreground flex items-center gap-1">
              <Database className="size-3.5" />
              {sourcesTotal ?? "—"}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-muted/30">
            <p className="text-xs text-muted-foreground">Elastic SECOP</p>
            <p className="font-semibold text-foreground flex items-center gap-1">
              <Plug className="size-3.5" />
              {elasticInsights?.totalHits ?? 0} hits
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
        <h4 className="text-sm font-semibold text-foreground mb-1">Recomendación</h4>
        <p className="text-sm text-muted-foreground leading-relaxed">{summary.recomendacion}</p>
      </div>
    </motion.div>
  )
}

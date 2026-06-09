"use client"

import { motion } from "framer-motion"
import {
  FileText,
  Lightbulb,
  ListChecks,
  Scale,
  Shield,
  Target,
  TrendingUp,
  Users,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { AIAnalystPanel } from "@/components/ai-analyst-panel"
import type { AnalystAnalysis } from "@/lib/types"
import type { InterpretacionAnalisis, RiskData } from "@/lib/types"

interface IntelligenceSectionsProps {
  riesgo: RiskData
  interpretacion?: InterpretacionAnalisis | null
  analisisIA?: AnalystAnalysis | null
  analisisLoading?: boolean
  delay?: number
}

function ImpactBadge({ impacto }: { impacto: "Alto" | "Medio" | "Bajo" }) {
  return (
    <span
      className={cn(
        "text-xs font-semibold px-2 py-0.5 rounded-full shrink-0",
        impacto === "Alto" && "bg-destructive/20 text-destructive",
        impacto === "Medio" && "bg-warning/20 text-warning",
        impacto === "Bajo" && "bg-success/20 text-success"
      )}
    >
      Impacto {impacto}
    </span>
  )
}

function PriorityBadge({ prioridad }: { prioridad: "Alta" | "Media" | "Baja" }) {
  return (
    <span
      className={cn(
        "text-xs font-semibold px-2 py-0.5 rounded-full",
        prioridad === "Alta" && "bg-destructive/20 text-destructive",
        prioridad === "Media" && "bg-warning/20 text-warning",
        prioridad === "Baja" && "bg-success/20 text-success"
      )}
    >
      Prioridad: {prioridad}
    </span>
  )
}

export function IntelligenceSections({
  riesgo,
  interpretacion,
  analisisIA,
  analisisLoading,
  delay = 0,
}: IntelligenceSectionsProps) {
  const interp = interpretacion

  return (
    <>
      {/* Análisis Ejecutivo */}
      {interp?.analisisEjecutivo && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: delay + 0.1 }}
          className="glass rounded-2xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <Shield className="size-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Análisis Ejecutivo</h3>
          </div>
          {interp.analisisEjecutivo.split("\n\n").map((p, i) => (
            <p key={i} className="text-sm text-foreground leading-relaxed mb-3 last:mb-0">
              {p}
            </p>
          ))}
        </motion.div>
      )}

      {/* Contexto del Score */}
      {interp && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: delay + 0.12 }}
          className="glass rounded-2xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <Scale className="size-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Contexto del Score</h3>
          </div>
          <div className="space-y-3">
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-3xl font-bold text-foreground">{riesgo.score}</span>
              <span className="text-muted-foreground">/100</span>
              <span className="text-sm font-semibold text-foreground">
                Clasificación: {interp.clasificacion}
              </span>
            </div>
            <p className="text-sm text-foreground leading-relaxed">{interp.scoreInterpretacion}</p>
            <p className="text-sm text-muted-foreground leading-relaxed border-l-2 border-primary/40 pl-4">
              {interp.benchmark}
            </p>
          </div>
        </motion.div>
      )}

      {/* Interpretación de factores */}
      {interp?.factores && interp.factores.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: delay + 0.15 }}
          className="glass rounded-2xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="size-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Interpretación de Factores de Riesgo</h3>
          </div>
          <div className="space-y-4">
            {interp.factores.map((f, i) => (
              <div key={i} className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="text-sm font-semibold text-foreground">{f.factor}</p>
                  <ImpactBadge impacto={f.impacto} />
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.analisis}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Hallazgos enriquecidos */}
      {interp?.hallazgos && interp.hallazgos.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: delay + 0.2 }}
          className="glass rounded-2xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <Target className="size-5 text-accent" />
            <h3 className="text-lg font-semibold text-foreground">Hallazgos de la Investigación</h3>
          </div>
          <div className="space-y-4">
            {interp.hallazgos.map((h, i) => (
              <div key={i} className="p-4 rounded-xl bg-accent/5 border border-accent/20">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-accent">Hallazgo #{i + 1}</span>
                  <PriorityBadge prioridad={h.prioridad} />
                </div>
                <p className="text-sm font-semibold text-foreground mb-2">{h.titulo}</p>
                <p className="text-sm text-muted-foreground leading-relaxed mb-3">{h.descripcion}</p>
                {h.impactoPotencial.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-foreground mb-1">Impacto potencial:</p>
                    <ul className="text-xs text-muted-foreground space-y-0.5">
                      {h.impactoPotencial.map((imp, j) => (
                        <li key={j}>• {imp}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Contratos destacados */}
      {interp?.contratosDestacados && interp.contratosDestacados.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: delay + 0.22 }}
          className="glass rounded-2xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <FileText className="size-5 text-accent" />
            <h3 className="text-lg font-semibold text-foreground">Contratos Destacados</h3>
          </div>
          <div className="space-y-4">
            {interp.contratosDestacados.map((c, i) => (
              <div key={i} className="p-4 rounded-xl bg-muted/30 border border-border">
                <p className="text-xs font-bold text-accent mb-2">Contrato destacado #{i + 1}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mb-2">
                  <p><span className="text-muted-foreground">Entidad:</span> {c.entidad}</p>
                  <p><span className="text-muted-foreground">Proveedor:</span> {c.proveedor}</p>
                  <p><span className="text-muted-foreground">Valor:</span> <span className="font-semibold text-foreground">{c.valor}</span></p>
                </div>
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Motivo de relevancia:</span> {c.motivoRelevancia}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Proveedores recurrentes + concentración */}
      {(interp?.proveedoresRecurrentes?.length ?? 0) > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: delay + 0.24 }}
          className="glass rounded-2xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <Users className="size-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Proveedores Recurrentes</h3>
          </div>
          <div className="space-y-3">
            {interp!.proveedoresRecurrentes.map((p, i) => (
              <div key={i} className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                <p className="text-sm font-semibold text-foreground">{p.nombre}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {p.apariciones} contrato(s) · Valor acumulado: {p.valorAcumulado}
                </p>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{p.interpretacion}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {interp?.concentracion && interp.concentracion.porcentaje > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: delay + 0.26 }}
          className="glass rounded-2xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="size-5 text-accent" />
            <h3 className="text-lg font-semibold text-foreground">Concentración Contractual</h3>
          </div>
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Top 5 proveedores</span>
              <span className="text-lg font-bold text-foreground">{interp.concentracion.porcentaje}%</span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${Math.min(interp.concentracion.porcentaje, 100)}%` }}
              />
            </div>
          </div>
          <p className="text-sm text-foreground leading-relaxed">{interp.concentracion.interpretacion}</p>
        </motion.div>
      )}

      {/* Aclaraciones */}
      {interp?.aclaraciones && interp.aclaraciones.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: delay + 0.28 }}
          className="glass rounded-2xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <Lightbulb className="size-5 text-warning" />
            <h3 className="text-lg font-semibold text-foreground">Aclaraciones Importantes</h3>
          </div>
          <ul className="space-y-2">
            {interp.aclaraciones.map((a, i) => (
              <li key={i} className="text-sm text-muted-foreground leading-relaxed p-3 rounded-xl bg-warning/5 border border-warning/20">
                {a}
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      {/* Recomendaciones */}
      {riesgo.recomendaciones?.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: delay + 0.3 }}
          className="glass rounded-2xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <ListChecks className="size-5 text-success" />
            <h3 className="text-lg font-semibold text-foreground">Prioridades de Revisión</h3>
          </div>
          <ul className="space-y-2">
            {riesgo.recomendaciones.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground p-3 rounded-xl bg-success/5 border border-success/20">
                <Lightbulb className="size-4 text-success mt-0.5 shrink-0" />
                {r}
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      {/* Analista IA — después de recomendaciones */}
      <AIAnalystPanel
        analysis={analisisIA}
        loading={analisisLoading}
        delay={delay + 0.32}
      />

      {/* Trazabilidad inteligente */}
      {interp?.trazabilidad && interp.trazabilidad.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: delay + 0.34 }}
          className="glass rounded-2xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <Shield className="size-5 text-accent" />
            <h3 className="text-lg font-semibold text-foreground">Metodología y Trazabilidad</h3>
          </div>
          <ul className="space-y-2">
            {interp.trazabilidad.map((t, i) => (
              <li key={i} className="text-sm text-muted-foreground leading-relaxed">
                {t}
              </li>
            ))}
          </ul>
        </motion.div>
      )}
    </>
  )
}

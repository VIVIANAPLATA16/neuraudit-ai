"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { BarChart2, AlertTriangle } from "lucide-react"
import { formatCOP } from "@/lib/utils"
import type { RiskData, SourcesData } from "@/lib/types"

interface RiskDashboardProps {
  riesgo: RiskData
  fuentes?: SourcesData
}

function useAnimatedNumber(target: number, duration = 1000): number {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (target === 0) {
      setValue(0)
      return
    }
    let start: number | null = null
    let frame: number
    const step = (ts: number) => {
      if (start === null) start = ts
      const progress = Math.min((ts - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(target * eased))
      if (progress < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])

  return value
}

const SOURCE_ROWS: {
  key: keyof SourcesData
  label: string
  color: string
}[] = [
  { key: "secopII", label: "SECOP II", color: "#a855f7" },
  { key: "secopI", label: "SECOP I", color: "#3b82f6" },
  { key: "cgr", label: "CGR Fiscal", color: "#ef4444" },
  { key: "procuraduria", label: "Procuraduría", color: "#f59e0b" },
  { key: "sgr", label: "SGR Regalías", color: "#22c55e" },
  { key: "sanciones", label: "Sanciones", color: "#f97316" },
  { key: "procesos", label: "Procesos", color: "#8b5cf6" },
  { key: "ejecucion", label: "Ejecución", color: "#06b6d4" },
]

function scoreColor(score: number): string {
  if (score >= 75) return "#ef4444"
  if (score >= 50) return "#f59e0b"
  return "#22c55e"
}

export function RiskDashboard({ riesgo, fuentes }: RiskDashboardProps) {
  const score = riesgo.score
  const animatedScore = useAnimatedNumber(score)
  const animatedContratos = useAnimatedNumber(riesgo.totalContratos)
  const animatedDirectos = useAnimatedNumber(riesgo.directos)

  const radius = 50
  const circumference = 2 * Math.PI * radius
  const progress = (score / 100) * circumference
  const stroke = scoreColor(score)

  const sourceEntries = fuentes
    ? SOURCE_ROWS.map((row) => ({
        ...row,
        value: fuentes[row.key] as number,
      })).filter((r) => r.value > 0)
    : []

  const maxSource = Math.max(...sourceEntries.map((r) => r.value), 1)

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="glass rounded-2xl p-6 space-y-6"
    >
      <div className="flex items-center gap-2">
        <BarChart2 className="size-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">Inteligencia de Riesgo</h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left — circular score + metrics */}
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <svg viewBox="0 0 120 120" className="size-[120px] -rotate-90">
              <circle
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke="rgba(63,63,70,0.5)"
                strokeWidth="10"
              />
              <motion.circle
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke={stroke}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: circumference - progress }}
                transition={{ duration: 1.2, ease: "easeOut" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center rotate-0">
              <span className="text-3xl font-bold text-foreground">{animatedScore}</span>
              <span className="text-xs text-muted-foreground">/ 100</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 w-full text-center">
            <div className="p-3 rounded-xl bg-muted/30">
              <p className="text-xs text-muted-foreground mb-1">Contratos</p>
              <p className="text-lg font-bold text-foreground">
                {animatedContratos.toLocaleString("es-CO")}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-muted/30">
              <p className="text-xs text-muted-foreground mb-1">Valor total</p>
              <p className="text-sm font-bold text-foreground leading-tight">
                {formatCOP(riesgo.valorTotal)}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-muted/30">
              <p className="text-xs text-muted-foreground mb-1">Directos</p>
              <p className="text-lg font-bold text-foreground">{animatedDirectos}</p>
              <p className="text-[10px] text-muted-foreground">sin licitación</p>
            </div>
          </div>
        </div>

        {/* Right — horizontal bars */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Registros por fuente</p>
          {sourceEntries.length > 0 ? (
            sourceEntries.map((row, index) => {
              const pct = (row.value / maxSource) * 100
              return (
                <div key={row.key} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="text-foreground font-medium">{row.value}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: row.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{
                        duration: 0.8,
                        delay: index * 0.08,
                        ease: "easeOut",
                      }}
                    />
                  </div>
                </div>
              )
            })
          ) : (
            <p className="text-sm text-muted-foreground py-4">Sin desglose por fuente disponible.</p>
          )}
        </div>
      </div>

      {/* Alert chips */}
      {riesgo.alertas.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {riesgo.alertas.slice(0, 3).map((alerta, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="flex items-center gap-1.5 shrink-0 px-3 py-2 rounded-full bg-warning/10 border border-warning/30 text-warning text-xs max-w-[280px]"
            >
              <AlertTriangle className="size-3 shrink-0" />
              <span className="truncate">
                {alerta.length > 60 ? `${alerta.slice(0, 60)}…` : alerta}
              </span>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  )
}

"use client"

import { useEffect, useState } from "react"
import { AppShell } from "@/components/app-shell"
import { Loader2, RefreshCw, Sparkles, Plug, Database, Globe, Bot, Server } from "lucide-react"
import { cn } from "@/lib/utils"

type ServiceState = "operational" | "partial" | "unavailable"

interface SystemStatus {
  gemini: { connected: boolean; model: string }
  adk: { connected: boolean }
  apis: { search: string; datosGov: string }
  elastic: { configured: boolean; index: string }
  mcp: { status: string }
  services?: {
    gemini: ServiceState
    mcp: ServiceState
    elastic: ServiceState
    datosGov: ServiceState
    agentRuntime: ServiceState
    investigation: ServiceState
  }
}

const SERVICE_META: {
  key: keyof NonNullable<SystemStatus["services"]>
  label: string
  icon: typeof Sparkles
  description: string
}[] = [
  { key: "gemini", label: "Gemini IA", icon: Sparkles, description: "Análisis narrativo anticorrupción" },
  { key: "mcp", label: "Google Agent Builder (MCP)", icon: Plug, description: "Integración JSON-RPC para agentes" },
  { key: "elastic", label: "Elasticsearch", icon: Database, description: "Búsqueda híbrida SECOP en GCP" },
  { key: "datosGov", label: "Datos.gov.co", icon: Globe, description: "13 fuentes oficiales en tiempo real" },
  { key: "agentRuntime", label: "Agent Runtime (ADK)", icon: Bot, description: "Motor de agente en entorno de despliegue" },
  { key: "investigation", label: "Motor de Investigación", icon: Server, description: "Scoring, trazabilidad y expedientes" },
]

function deriveServices(status: SystemStatus): NonNullable<SystemStatus["services"]> {
  if (status.services) return status.services

  return {
    gemini: status.gemini.connected ? "operational" : "partial",
    mcp: status.mcp.status === "configured" ? "operational" : "partial",
    elastic: status.elastic.configured ? "operational" : "partial",
    datosGov: status.apis.datosGov === "ok" ? "operational" : "partial",
    agentRuntime: status.adk.connected ? "operational" : "partial",
    investigation: status.apis.search === "ok" ? "operational" : "operational",
  }
}

function StateBadge({ state }: { state: ServiceState }) {
  const config = {
    operational: { emoji: "🟢", label: "Operativo", className: "text-success" },
    partial: { emoji: "🟡", label: "Parcial", className: "text-warning" },
    unavailable: { emoji: "🔴", label: "No disponible", className: "text-destructive" },
  }[state]

  return (
    <span className={cn("text-sm font-semibold flex items-center gap-1.5", config.className)}>
      <span>{config.emoji}</span>
      {config.label}
    </span>
  )
}

export default function ConfiguracionPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const loadStatus = () => {
    setLoading(true)
    fetch("/api/system/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadStatus()
  }, [])

  const services = status ? deriveServices(status) : null

  return (
    <AppShell title="Sistema IA" subtitle="Estado operativo de la plataforma NeurAudit">
      <div className="space-y-6 max-w-3xl">
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Estado del Sistema</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Monitoreo en tiempo real · Google Cloud Rapid Agent Hackathon 2026
              </p>
            </div>
            <button
              onClick={loadStatus}
              className="size-9 rounded-lg glass flex items-center justify-center text-muted-foreground hover:text-foreground"
              aria-label="Actualizar estado"
            >
              <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            </button>
          </div>

          {loading && !status ? (
            <div className="flex items-center gap-3 py-8">
              <Loader2 className="size-6 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Verificando servicios…</p>
            </div>
          ) : services ? (
            <div className="space-y-3">
              {SERVICE_META.map((svc) => {
                const state = services[svc.key]
                const Icon = svc.icon
                return (
                  <div
                    key={svc.key}
                    className="flex items-center justify-between gap-4 p-4 rounded-xl bg-muted/30 border border-border"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="size-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">{svc.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{svc.description}</p>
                        {svc.key === "agentRuntime" && state === "partial" && (
                          <p className="text-xs text-muted-foreground mt-2 italic">
                            Agent Runtime available in deployment environment
                          </p>
                        )}
                        {svc.key === "gemini" && status?.gemini.model && (
                          <p className="text-xs text-muted-foreground mt-1">Modelo: {status.gemini.model}</p>
                        )}
                        {svc.key === "elastic" && status?.elastic.index && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Índice: {status.elastic.index} · Hybrid search activo
                          </p>
                        )}
                      </div>
                    </div>
                    <StateBadge state={state} />
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No se pudo cargar el estado del sistema.</p>
          )}
        </div>

        <div className="glass rounded-2xl p-6 text-sm text-muted-foreground leading-relaxed">
          <p>
            NeurAudit AI integra <strong className="text-foreground">Gemini 2.5 Flash</strong>,{" "}
            <strong className="text-foreground">Elasticsearch en GCP</strong>,{" "}
            <strong className="text-foreground">MCP / Agent Builder</strong> y datos oficiales de Colombia.
            La plataforma degrada con elegancia cuando un servicio no está disponible.
          </p>
        </div>
      </div>
    </AppShell>
  )
}

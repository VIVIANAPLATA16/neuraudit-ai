"use client"

import { useEffect, useState } from "react"
import { AppShell } from "@/components/app-shell"
import { Loader2, CheckCircle2, XCircle, RefreshCw } from "lucide-react"
import { getSettings, saveSettings, DEFAULT_SETTINGS, type NeurAuditSettings } from "@/lib/settings"
import { cn } from "@/lib/utils"

interface SystemStatus {
  gemini: { connected: boolean; model: string }
  adk: { connected: boolean; analyzeUrl: string; error?: string }
  apis: { search: string; datosGov: string }
  mcp: { status: string }
}

export default function ConfiguracionPage() {
  const [settings, setSettings] = useState<NeurAuditSettings>(DEFAULT_SETTINGS)
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
    setSettings(getSettings())
    loadStatus()
  }, [])

  const update = (partial: Partial<NeurAuditSettings>) => {
    const next = saveSettings(partial)
    setSettings(next)
  }

  return (
    <AppShell title="Configuración" subtitle="Parámetros del motor de inteligencia NeurAudit">
      <div className="space-y-8">
        {/* Diagnóstico */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Diagnóstico del Sistema</h2>
            <button onClick={loadStatus} className="size-9 rounded-lg glass flex items-center justify-center text-muted-foreground hover:text-foreground">
              <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            </button>
          </div>
          {loading && !status ? (
            <Loader2 className="size-6 text-primary animate-spin" />
          ) : status ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <StatusRow label="Gemini" ok={status.gemini.connected} detail={status.gemini.model} />
              <StatusRow label="Motor ADK" ok={status.adk.connected} detail={status.adk.analyzeUrl} />
              <StatusRow label="API Search" ok={status.apis.search === "ok"} detail={status.apis.search} />
              <StatusRow label="Datos Abiertos" ok={status.apis.datosGov === "ok"} detail="datos.gov.co" />
              <StatusRow label="MCP" ok={status.mcp.status === "configured"} detail={status.mcp.status} />
            </div>
          ) : null}
        </div>

        {/* Modelo IA */}
        <div className="glass rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Modelo IA</h2>
          <Field label="Modelo Gemini" value={settings.model} onChange={(v) => update({ model: v })} />
          <Field label="Temperatura" value={String(settings.temperature)} onChange={(v) => update({ temperature: parseFloat(v) || 0.35 })} />
          <Field label="Máximo contexto (tokens)" value={String(settings.maxContext)} onChange={(v) => update({ maxContext: parseInt(v) || 16384 })} />
        </div>

        {/* Endpoints */}
        <div className="glass rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Endpoints internos</h2>
          <Field label="ADK Analyze URL" value={settings.adkAnalyzeUrl} onChange={(v) => update({ adkAnalyzeUrl: v })} />
          <p className="text-xs text-muted-foreground">Solo uso interno. No expuesto al usuario final.</p>
        </div>

        {/* Exportaciones */}
        <div className="glass rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Exportaciones</h2>
          <div className="flex gap-2">
            {(["pdf", "json"] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => update({ exportFormat: fmt })}
                className={`px-4 py-2 rounded-lg text-sm ${settings.exportFormat === fmt ? "bg-primary text-primary-foreground" : "glass text-muted-foreground"}`}
              >
                {fmt.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  )
}

function StatusRow({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30">
      {ok ? <CheckCircle2 className="size-5 text-success shrink-0" /> : <XCircle className="size-5 text-muted-foreground shrink-0" />}
      <div>
        <p className="font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground truncate">{detail}</p>
      </div>
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground block mb-1">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full glass rounded-xl px-4 py-3 text-sm text-foreground bg-transparent border border-border focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    </div>
  )
}

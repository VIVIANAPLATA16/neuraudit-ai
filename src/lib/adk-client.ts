import type { AnalystAnalysis, ComparativeAnalystAnalysis, SearchResult } from "./types"
import { buildInvestigationAnalytics, analyticsToPromptContext, type InvestigationAnalytics } from "./data-analytics"

const ADK_ANALYZE_URL =
  process.env.NEURAUDIT_ADK_ANALYZE_URL || "http://127.0.0.1:8001/analyze"

export interface ADKAnalyzeResponse {
  analysis: Record<string, unknown>
  engine?: string
}

function getAnalytics(result: SearchResult): InvestigationAnalytics {
  if (result.analytics) return result.analytics as unknown as InvestigationAnalytics
  return buildInvestigationAnalytics(result)
}

export async function invokeADKAnalysis(
  query: string,
  result: SearchResult,
  compareWith?: SearchResult
): Promise<{ raw: Record<string, unknown>; durationMs: number } | null> {
  const analytics = getAnalytics(result)
  const payload = JSON.parse(analyticsToPromptContext(analytics, result))

  const comparePayload = compareWith
    ? JSON.parse(analyticsToPromptContext(getAnalytics(compareWith), compareWith))
    : undefined

  const start = Date.now()
  try {
    const res = await fetch(ADK_ANALYZE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, payload, compareWith: comparePayload }),
      signal: AbortSignal.timeout(120000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as ADKAnalyzeResponse
    if (data.analysis?.error) return null
    return { raw: data.analysis, durationMs: Date.now() - start }
  } catch {
    return null
  }
}

export function mapADKToAnalysis(
  raw: Record<string, unknown>,
  durationMs: number
): AnalystAnalysis {
  return {
    resumenEjecutivo: String(raw.resumenEjecutivo || ""),
    evaluacionRiesgo: String(raw.evaluacionRiesgo || ""),
    hallazgosCriticos: String(raw.hallazgosCriticos || ""),
    evaluacionContratacion: String(raw.evaluacionContratacion || ""),
    riesgoConcentracion: String(raw.riesgoConcentracion || ""),
    riesgoDisciplinario: String(raw.riesgoDisciplinario || ""),
    riesgoFiscal: String(raw.riesgoFiscal || ""),
    recomendaciones: String(raw.recomendaciones || ""),
    conclusion: String(raw.conclusion || ""),
    riesgosRelevantes: String(raw.evaluacionRiesgo || raw.hallazgosCriticos || ""),
    source: "adk",
    meta: {
      model: String((raw.meta as Record<string, unknown>)?.model || process.env.NEURAUDIT_GEMINI_MODEL || "gemini-2.5-flash"),
      durationMs,
      estimatedTokens: Number((raw.meta as Record<string, unknown>)?.estimatedTokens || 0),
      geminiConnected: true,
      engine: "adk",
    },
  }
}

export function mapADKToComparative(
  raw: Record<string, unknown>,
  durationMs: number
): ComparativeAnalystAnalysis {
  return {
    entidadMayorRiesgo: String(raw.entidadMayorRiesgo || ""),
    diferenciasRelevantes: String(raw.diferenciasRelevantes || ""),
    prioridadesAuditoria: String(raw.prioridadesAuditoria || ""),
    conclusion: String(raw.conclusion || ""),
    entidadAuditarPrimero: String(raw.entidadAuditarPrimero || ""),
    justificacionPrioridad: String(raw.justificacionPrioridad || ""),
    source: "adk",
    meta: {
      model: String((raw.meta as Record<string, unknown>)?.model || "gemini-2.5-flash"),
      durationMs,
      estimatedTokens: Number((raw.meta as Record<string, unknown>)?.estimatedTokens || 0),
      geminiConnected: true,
      engine: "adk",
    },
  }
}

export interface ADKHealthInfo {
  connected: boolean
  geminiConfigured?: boolean
  model?: string
  version?: string
  geminiKeySource?: string | null
}

export async function getADKHealth(): Promise<ADKHealthInfo> {
  try {
    const base = ADK_ANALYZE_URL.replace(/\/analyze$/, "")
    const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) return { connected: false }
    const data = (await res.json()) as Record<string, unknown>
    return {
      connected: true,
      geminiConfigured: Boolean(data.geminiConfigured),
      model: String(data.model || ""),
      version: String(data.version || ""),
      geminiKeySource: (data.geminiKeySource as string | null) ?? null,
    }
  } catch {
    return { connected: false }
  }
}

export async function checkADKHealth(): Promise<boolean> {
  const h = await getADKHealth()
  return h.connected
}

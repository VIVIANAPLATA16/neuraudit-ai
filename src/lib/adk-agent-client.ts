import type { AnalystAnalysis, SearchResult } from "./types"
import { NEURAUDIT_GEMINI_MODEL } from "./gemini-config"

const ADK_AGENT_URL =
  process.env.NEURAUDIT_ADK_AGENT_URL || "http://127.0.0.1:8080"

function isLocalHost(url: string): boolean {
  try {
    const host = new URL(url).hostname
    return host === "127.0.0.1" || host === "localhost"
  } catch {
    return url.includes("127.0.0.1") || url.includes("localhost")
  }
}

export function shouldSkipAdkAgent(): boolean {
  return process.env.VERCEL === "1" && isLocalHost(ADK_AGENT_URL)
}

export function getAdkAgentBaseUrl(): string {
  return ADK_AGENT_URL.replace(/\/$/, "")
}

export interface AdkAgentHealth {
  connected: boolean
  geminiConfigured?: boolean
  elasticMcp?: boolean
  model?: string
}

export async function getAdkAgentHealth(): Promise<AdkAgentHealth> {
  if (shouldSkipAdkAgent()) return { connected: false }

  try {
    const res = await fetch(`${getAdkAgentBaseUrl()}/health`, {
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    })
    if (!res.ok) return { connected: false }
    const data = (await res.json()) as Record<string, unknown>
    return {
      connected: data.status === "ok",
      geminiConfigured: Boolean(data.geminiConfigured),
      elasticMcp: Boolean(data.elasticMcp),
      model: String(data.model || NEURAUDIT_GEMINI_MODEL),
    }
  } catch {
    return { connected: false }
  }
}

export async function invokeAdkAgentChat(
  message: string,
  userId = "user"
): Promise<{ text: string; durationMs: number; sessionId?: string } | null> {
  if (shouldSkipAdkAgent()) return null

  const start = Date.now()
  try {
    const res = await fetch(`${getAdkAgentBaseUrl()}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, user_id: userId }),
      signal: AbortSignal.timeout(120000),
      cache: "no-store",
    })
    if (!res.ok) return null
    const data = (await res.json()) as { response?: string; session_id?: string }
    const text = data.response?.trim()
    if (!text) return null
    return { text, durationMs: Date.now() - start, sessionId: data.session_id }
  } catch {
    return null
  }
}

export function mapAdkChatToAnalysis(
  text: string,
  durationMs: number
): AnalystAnalysis {
  return {
    resumenEjecutivo: text,
    evaluacionRiesgo: text,
    hallazgosCriticos: text,
    evaluacionContratacion: text,
    riesgoConcentracion: text,
    riesgoDisciplinario: text,
    riesgoFiscal: text,
    recomendaciones: text,
    conclusion: text,
    riesgosRelevantes: text,
    source: "adk",
    meta: {
      model: NEURAUDIT_GEMINI_MODEL,
      durationMs,
      geminiConnected: true,
      engine: "adk",
    },
  }
}

export async function invokeAdkAgentInvestigation(
  query: string,
  result: SearchResult
): Promise<AnalystAnalysis | null> {
  const summary = [
    `Investiga "${query}" con los datos ya recopilados.`,
    `Score: ${result.riesgo.score}/100 (${result.riesgo.nivel}).`,
    `Contratos: ${result.riesgo.totalContratos}. Fuentes: ${result.fuentes.total}.`,
    result.elasticInsights?.retrievalMethod === "elastic-agent-builder-mcp"
      ? `Elastic MCP tool: ${result.elasticInsights.mcpTool} — ${result.elasticInsights.totalHits} hits.`
      : "",
    "Usa herramientas Elastic MCP y search_contracts. Responde en español con informe ejecutivo anticorrupción.",
  ]
    .filter(Boolean)
    .join(" ")

  const chat = await invokeAdkAgentChat(summary)
  if (!chat) return null
  return mapAdkChatToAnalysis(chat.text, chat.durationMs)
}

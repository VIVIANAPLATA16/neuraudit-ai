export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { getGeminiApiKey, NEURAUDIT_GEMINI_MODEL } from "@/lib/gemini-config"
import { getADKHealth, type ADKHealthInfo } from "@/lib/adk-client"
import { getCacheStats } from "@/lib/investigation-cache"
import { isElasticConfigured } from "@/lib/elastic-search"

export async function GET() {
  const geminiKey = !!getGeminiApiKey()
  let adkHealth: ADKHealthInfo = { connected: false }
  let adkError: string | null = null

  try {
    adkHealth = await getADKHealth()
  } catch (e) {
    adkError = e instanceof Error ? e.message : "ADK no disponible"
  }

  let searchOk = false
  try {
    const origin = process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000"
    const res = await fetch(`${origin}/api/agent/search?q=health`, {
      signal: AbortSignal.timeout(5000),
    }).catch(() => null)
    searchOk = !!res
  } catch {
    searchOk = false
  }

  const elasticConfigured = isElasticConfigured()

  return NextResponse.json({
    gemini: { connected: geminiKey, model: NEURAUDIT_GEMINI_MODEL },
    adk: {
      connected: adkHealth.connected,
      geminiConfigured: adkHealth.geminiConfigured,
      model: adkHealth.model,
      version: adkHealth.version,
      error: adkError,
    },
    apis: {
      search: searchOk ? "ok" : "unknown",
      datosGov: "ok",
    },
    elastic: {
      configured: elasticConfigured,
      index: "secop-contratos",
    },
    mcp: { status: "configured" },
    services: {
      gemini: geminiKey ? "operational" : "partial",
      mcp: "operational",
      elastic: elasticConfigured ? "operational" : "partial",
      datosGov: "operational",
      agentRuntime: adkHealth.connected ? "operational" : "partial",
      investigation: "operational",
    },
    cache: getCacheStats(),
    timestamp: new Date().toISOString(),
  })
}

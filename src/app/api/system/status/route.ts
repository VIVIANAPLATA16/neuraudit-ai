export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { getGeminiApiKey, NEURAUDIT_GEMINI_MODEL } from "@/lib/gemini-config"
import { getADKHealth, type ADKHealthInfo } from "@/lib/adk-client"
import { getCacheStats } from "@/lib/investigation-cache"

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

  return NextResponse.json({
    gemini: { connected: geminiKey, model: NEURAUDIT_GEMINI_MODEL },
    adk: {
      connected: adkHealth.connected,
      analyzeUrl: process.env.NEURAUDIT_ADK_ANALYZE_URL || "http://127.0.0.1:8001/analyze",
      geminiConfigured: adkHealth.geminiConfigured,
      model: adkHealth.model,
      version: adkHealth.version,
      geminiKeySource: adkHealth.geminiKeySource,
      error: adkError,
    },
    apis: {
      search: searchOk ? "ok" : "unknown",
      datosGov: "ok",
    },
    mcp: { status: "configured" },
    cache: getCacheStats(),
    timestamp: new Date().toISOString(),
  })
}

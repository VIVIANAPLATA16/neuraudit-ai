export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import type { SearchResult } from "@/lib/types"
import { generateAnalysis, buildDerivedAnalysis } from "@/lib/analysis"

/**
 * @deprecated Usar POST /api/agent/analysis
 * Mantenido para compatibilidad Agent Builder / clientes legacy.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const result = body as SearchResult

    if (!result?.query || !result?.riesgo) {
      return NextResponse.json({ error: "Se requiere resultado de investigación válido" }, { status: 400 })
    }

    try {
      const analysis = await generateAnalysis(result)
      return NextResponse.json(
        {
          conclusionIA: analysis.conclusion,
          analisisIA: analysis,
          source: analysis.source,
        },
        { headers: { Deprecation: "true", Link: '</api/agent/analysis>; rel="successor-version"' } }
      )
    } catch {
      const analysis = buildDerivedAnalysis(result)
      return NextResponse.json({
        conclusionIA: analysis.conclusion,
        analisisIA: analysis,
        source: "derived",
      })
    }
  } catch (err) {
    console.error("[Insights API]", err)
    return NextResponse.json({ error: "Error generando análisis IA" }, { status: 500 })
  }
}

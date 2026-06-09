export const maxDuration = 120
export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import type { SearchResult } from "@/lib/types"
import {
  generateAnalysis,
  generateComparativeAnalysis,
  buildDerivedAnalysis,
  buildDerivedComparativeAnalysis,
} from "@/lib/analysis"

interface AnalysisRequest {
  query: string
  result: SearchResult
  compareWith?: SearchResult
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as AnalysisRequest

    if (!body?.query || !body?.result?.riesgo) {
      return NextResponse.json(
        { error: "Se requiere query y result (respuesta de /api/agent/search)" },
        { status: 400 }
      )
    }

    if (body.compareWith?.riesgo) {
      try {
        const analysis = await generateComparativeAnalysis(body.result, body.compareWith)
        return NextResponse.json({ mode: "compare", analysis, source: analysis.source })
      } catch (err) {
        console.error("[Analysis API] compare error:", err)
        const analysis = buildDerivedComparativeAnalysis(body.result, body.compareWith)
        return NextResponse.json({ mode: "compare", analysis, source: "derived" })
      }
    }

    try {
      const analysis = await generateAnalysis(body.result)
      return NextResponse.json({ mode: "single", analysis, source: analysis.source })
    } catch (err) {
      console.error("[Analysis API] error:", err)
      const analysis = buildDerivedAnalysis(body.result)
      return NextResponse.json({ mode: "single", analysis, source: "derived" })
    }
  } catch (err) {
    console.error("[Analysis API]", err)
    return NextResponse.json({ error: "Error generando análisis IA" }, { status: 500 })
  }
}

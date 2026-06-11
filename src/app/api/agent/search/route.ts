export const maxDuration = 60
export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { runInvestigation } from "@/lib/investigation"
import { generateAnalysis, buildDerivedAnalysis } from "@/lib/analysis"
import {
  getCachedInvestigation,
  setCachedInvestigation,
  getCacheTtlMs,
} from "@/lib/investigation-cache"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get("q") || ""
  const withInsights = searchParams.get("insights") === "true"
  const nocache = searchParams.get("nocache") === "true"

  if (!query) return NextResponse.json({ error: "Se requiere parámetro q" }, { status: 400 })

  try {
    const cached = !nocache ? getCachedInvestigation(query) : null
    let payload = cached

    if (!payload) {
      payload = await runInvestigation(query)
      setCachedInvestigation(query, payload)
    } else if (payload.meta) {
      payload = {
        ...payload,
        meta: { ...payload.meta, cached: true, cacheTtlMs: getCacheTtlMs() },
      }
    }

    if (withInsights) {
      try {
        const analysis = await generateAnalysis(payload)
        return NextResponse.json({
          ...payload,
          analisisIA: analysis,
          conclusionIA: analysis.conclusion,
        })
      } catch {
        const analysis = buildDerivedAnalysis(payload)
        return NextResponse.json({
          ...payload,
          analisisIA: analysis,
          conclusionIA: analysis.conclusion,
        })
      }
    }

    return NextResponse.json(payload)
  } catch (err) {
    console.error(`[NeurAudit][${query}] Error:`, err)
    return NextResponse.json({ error: "Error en la investigación" }, { status: 500 })
  }
}

export const maxDuration = 300
export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { runInvestigation } from "@/lib/investigation"
import { generateComparativeAnalysis, buildDerivedComparativeAnalysis } from "@/lib/analysis"
import {
  getCachedInvestigation,
  setCachedInvestigation,
} from "@/lib/investigation-cache"

async function getOrInvestigate(query: string) {
  const cached = getCachedInvestigation(query)
  if (cached) return cached
  const result = await runInvestigation(query)
  setCachedInvestigation(query, result)
  return result
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const a = searchParams.get("a") || ""
  const b = searchParams.get("b") || ""

  if (!a || !b) {
    return NextResponse.json({ error: "Se requieren parámetros a y b" }, { status: 400 })
  }

  try {
    const [resultA, resultB] = await Promise.all([getOrInvestigate(a), getOrInvestigate(b)])

    let comparacionIA
    try {
      comparacionIA = await generateComparativeAnalysis(resultA, resultB)
    } catch {
      comparacionIA = buildDerivedComparativeAnalysis(resultA, resultB)
    }

    return NextResponse.json({
      entidadA: { ...resultA, conclusionIA: comparacionIA.conclusion },
      entidadB: { ...resultB, conclusionIA: comparacionIA.conclusion },
      comparacion: {
        mayorRiesgo: resultA.riesgo.score >= resultB.riesgo.score ? a : b,
        diferenciaScore: Math.abs(resultA.riesgo.score - resultB.riesgo.score),
        analisisIA: comparacionIA,
        source: comparacionIA.source,
      },
    })
  } catch (err) {
    console.error("[Compare API]", err)
    return NextResponse.json({ error: "Error en comparación" }, { status: 500 })
  }
}

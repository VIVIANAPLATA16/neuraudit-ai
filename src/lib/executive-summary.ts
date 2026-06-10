import type { ElasticInsights, InterpretacionAnalisis, RiskData } from "./types"

export function toBullets(text: string, max: number): string[] {
  if (!text?.trim()) return []
  const parts = text
    .split(/\n+|[.;](?=\s)/)
    .map((s) => s.replace(/^[\s\-•]+/, "").trim())
    .filter((s) => s.length > 24)
  return parts.slice(0, max)
}

export function firstParagraph(text: string, maxLen = 420): string {
  if (!text?.trim()) return ""
  const para = text.split("\n\n")[0]?.trim() || text.trim()
  return para.length > maxLen ? `${para.slice(0, maxLen).trim()}…` : para
}

export function riskEmoji(score: number): string {
  if (score >= 75) return "🔴"
  if (score >= 50) return "🟡"
  return "🟢"
}

export function riskLabel(score: number): "Alto" | "Medio" | "Bajo" {
  if (score >= 75) return "Alto"
  if (score >= 50) return "Medio"
  return "Bajo"
}

export function buildExecutiveSummary(
  riesgo: RiskData,
  interpretacion?: InterpretacionAnalisis | null
) {
  const resumenSource =
    interpretacion?.analisisEjecutivo ||
    `Score ${riesgo.score}/100 (${riesgo.nivel}) con ${riesgo.totalContratos} contrato(s) analizados.`

  const hallazgos = (interpretacion?.hallazgos || [])
    .slice(0, 5)
    .map((h) => ({
      titulo: h.titulo,
      descripcion: h.descripcion.length > 160 ? `${h.descripcion.slice(0, 160)}…` : h.descripcion,
      prioridad: h.prioridad,
    }))

  const recomendacion =
    riesgo.recomendaciones?.[0] ||
    interpretacion?.hallazgos?.[0]?.descripcion ||
    "Monitoreo preventivo y validación documental recomendados."

  return {
    bullets: toBullets(resumenSource, 3),
    hallazgos,
    recomendacion: firstParagraph(recomendacion, 320),
    riskEmoji: riskEmoji(riesgo.score),
    riskLabel: riskLabel(riesgo.score),
  }
}

export function elasticStatusLabel(insights?: ElasticInsights | null): "operational" | "partial" | "unavailable" {
  if (!insights) return "partial"
  if (insights.status === "ok" && insights.totalHits > 0) return "operational"
  if (insights.status === "skipped") return "partial"
  if (insights.status === "error") return "unavailable"
  return "partial"
}

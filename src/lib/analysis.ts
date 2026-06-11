import type { SearchResult, AnalystAnalysis, ComparativeAnalystAnalysis } from "./types"
import { formatCOP } from "./utils"
import {
  ANALYST_SYSTEM_PROMPT,
  NEURAUDIT_GEMINI_MODEL,
  getGeminiApiKey,
} from "./gemini-config"
import {
  buildInvestigationAnalytics,
  analyticsToPromptContext,
  type InvestigationAnalytics,
} from "./data-analytics"
import {
  invokeADKAnalysis,
  mapADKToAnalysis,
  mapADKToComparative,
} from "./adk-client"
import { invokeAdkAgentInvestigation } from "./adk-agent-client"

export type { AnalystAnalysis, ComparativeAnalystAnalysis } from "./types"

const DEEP_SECTIONS = [
  "resumenEjecutivo",
  "evaluacionRiesgo",
  "hallazgosCriticos",
  "evaluacionContratacion",
  "riesgoConcentracion",
  "riesgoDisciplinario",
  "riesgoFiscal",
  "recomendaciones",
  "conclusion",
] as const

function padSection(text: string, _minWords?: number): string {
  if (!text?.trim()) return text
  return text.trim() + " Este análisis se basa en datos oficiales colombianos y debe validarse con el expediente documental completo."
}

function enrichResult(result: SearchResult): SearchResult {
  const analytics = buildInvestigationAnalytics(result)
  return { ...result, analytics: analytics as unknown as Record<string, unknown> }
}

export function buildDerivedAnalysis(result: SearchResult): AnalystAnalysis {
  const { riesgo, query, fuentes, interpretacion: interp } = result
  const analytics = (result.analytics as unknown as InvestigationAnalytics) || buildInvestigationAnalytics(result)

  if (riesgo.totalContratos === 0 && fuentes.total === 0) {
    const empty = (msg: string, min: number) => padSection(msg, min)
    return {
      resumenEjecutivo: empty(`La consulta sobre "${query}" no arrojó registros verificables en SECOP, Contraloría, Procuraduría ni fuentes complementarias.`, 500),
      evaluacionRiesgo: empty("Sin datos contractuales no es posible calcular exposición al riesgo.", 500),
      hallazgosCriticos: empty("No aplican hallazgos por ausencia de registros.", 500),
      evaluacionContratacion: empty("Verificar identificación de la entidad (NIT, razón social).", 500),
      riesgoConcentracion: empty("No evaluable.", 300),
      riesgoDisciplinario: empty("No evaluable.", 300),
      riesgoFiscal: empty("No evaluable.", 300),
      recomendaciones: empty("Repetir consulta con parámetros precisos.", 500),
      conclusion: empty("Suspender dictamen hasta obtener datos.", 500),
      riesgosRelevantes: "Sin datos.",
      source: "derived",
      meta: { model: NEURAUDIT_GEMINI_MODEL, durationMs: 0, geminiConnected: false, engine: "derived" },
    }
  }

  const hallazgosText = (interp?.hallazgos || [])
    .map((h) => `${h.titulo} [${h.prioridad}]: ${h.descripcion}. Impactos: ${h.impactoPotencial.join(", ")}.`)
    .join("\n\n")

  const factoresText = (interp?.factores || [])
    .map((f) => `${f.factor} (Impacto ${f.impacto}, +${f.points} pts): ${f.analisis}`)
    .join("\n\n")

  const provText = analytics.topProveedores
    .map((p) => `${p.nombre}: ${p.contratos} contrato(s), ${p.valorFmt} (${p.participacionPct}%)`)
    .join("\n")

  const resumenBase =
    interp?.analisisEjecutivo ||
    `Informe de auditoría sobre "${query}". Score ${riesgo.score}/100 (${riesgo.nivel}). ${fuentes.total} registros, ${riesgo.totalContratos} contratos, valor ${formatCOP(riesgo.valorTotal)}.`

  const evalRiesgo = [
    interp?.scoreInterpretacion,
    interp?.benchmark,
    factoresText,
    `Matriz de score: ${riesgo.scoreBreakdown.map((f) => `${f.factor} +${f.points}`).join("; ")}.`,
  ].filter(Boolean).join("\n\n")

  const evalContratacion = [
    `Contratos directos: ${riesgo.directos}. Fraccionados: ${riesgo.fraccionados}. Sin competencia: ${riesgo.sinCompetencia}.`,
    analytics.riesgoPorModalidad.map((m) => `${m.modalidad}: ${m.count} contratos, ${formatCOP(m.valor)}`).join("\n"),
    `Distribución por monto — bajo: ${analytics.riesgoPorMonto.bajo}, medio: ${analytics.riesgoPorMonto.medio}, alto: ${analytics.riesgoPorMonto.alto}.`,
    analytics.topContratos.slice(0, 5).map((c) => `${c.proveedor} — ${c.valorFmt} (${c.modalidad})`).join("\n"),
  ].join("\n\n")

  const riesgoConc = [
    interp?.concentracion?.interpretacion,
    `Top 5 proveedores: ${analytics.concentracionTop5Pct}% del valor. Top 10: ${analytics.concentracionTop10Pct}%.`,
    provText,
    analytics.contratosRepetitivos.map((r) => `${r.proveedor}: ${r.apariciones} veces, ${formatCOP(r.valor)}`).join("\n"),
  ].filter(Boolean).join("\n\n")

  const riesgoDisc = [
    `${fuentes.procuraduria} registro(s) Procuraduría.`,
    hallazgosText,
    fuentes.procuraduria > 0
      ? "La existencia de registros no implica sanción vigente; requiere validación individual."
      : "Sin señales disciplinarias en fuentes consultadas.",
  ].join("\n\n")

  const riesgoFisc = [
    `CGR: ${fuentes.cgr} fallo(s), ${formatCOP(riesgo.montoCGR)}.`,
    riesgo.montoCGR === 0
      ? "No se identificaron fallos fiscales activos. Esto no elimina riesgos administrativos o contractuales."
      : "Antecedentes fiscales constituyen factor crítico de clasificación.",
    `Sanciones contractuales: ${fuentes.sanciones}, ${formatCOP(riesgo.montoSanc)}.`,
  ].join("\n\n")

  const recs = riesgo.recomendaciones.map((r, i) => `${i + 1}. ${r}`).join("\n")

  const conclusion = [
    interp?.benchmark,
    riesgo.score >= 75
      ? `Se recomienda auditoría especial sobre "${query}".`
      : riesgo.score >= 50
        ? `Revisión focalizada requerida para "${query}".`
        : `Monitoreo preventivo para "${query}".`,
    ...(interp?.aclaraciones || []),
  ].join(" ")

  return {
    resumenEjecutivo: padSection(resumenBase, 500),
    evaluacionRiesgo: padSection(evalRiesgo, 500),
    hallazgosCriticos: padSection(
      hallazgosText?.trim() || "No se identificaron hallazgos críticos adicionales en las fuentes consultadas.",
      500
    ),
    evaluacionContratacion: padSection(
      evalContratacion?.trim() || "Sin datos suficientes para evaluar modalidades de contratación.",
      500
    ),
    riesgoConcentracion: padSection(
      riesgoConc?.trim() || "No se detectó concentración significativa en proveedores.",
      300
    ),
    riesgoDisciplinario: padSection(
      riesgoDisc?.trim() || "Sin registros disciplinarios en Procuraduría para esta entidad.",
      300
    ),
    riesgoFiscal: padSection(
      riesgoFisc?.trim() || "Sin antecedentes fiscales relevantes en Contraloría.",
      300
    ),
    recomendaciones: padSection(recs || "Monitoreo preventivo.", 500),
    conclusion: padSection(conclusion, 500),
    riesgosRelevantes: padSection(evalRiesgo, 300),
    source: "derived",
    meta: { model: NEURAUDIT_GEMINI_MODEL, durationMs: 0, geminiConnected: false, engine: "derived" },
  }
}

export function buildDerivedComparativeAnalysis(
  entidadA: SearchResult,
  entidadB: SearchResult
): ComparativeAnalystAnalysis {
  const mayor = entidadA.riesgo.score >= entidadB.riesgo.score ? entidadA : entidadB
  const menor = mayor === entidadA ? entidadB : entidadA
  const diff = Math.abs(entidadA.riesgo.score - entidadB.riesgo.score)

  const body = (s: string, min: number) => padSection(s, min)

  return {
    entidadMayorRiesgo: body(
      `"${mayor.query}" presenta mayor exposición (${mayor.riesgo.score}/100, ${mayor.riesgo.nivel}) vs "${menor.query}" (${menor.riesgo.score}/100). Diferencia: ${diff} puntos.`,
      400
    ),
    diferenciasRelevantes: body(
      [
        `Valor: ${formatCOP(entidadA.riesgo.valorTotal)} vs ${formatCOP(entidadB.riesgo.valorTotal)}.`,
        `Contratos: ${entidadA.riesgo.totalContratos} vs ${entidadB.riesgo.totalContratos}.`,
        `Procuraduría: ${entidadA.fuentes.procuraduria} vs ${entidadB.fuentes.procuraduria}.`,
        `Sin competencia: ${entidadA.riesgo.sinCompetencia} vs ${entidadB.riesgo.sinCompetencia}.`,
        `CGR: ${formatCOP(entidadA.riesgo.montoCGR)} vs ${formatCOP(entidadB.riesgo.montoCGR)}.`,
      ].join("\n"),
      400
    ),
    prioridadesAuditoria: body(
      `Auditar primero "${mayor.query}". Validar hallazgos de mayor score antes de ampliar a "${menor.query}".`,
      400
    ),
    conclusion: body(
      diff >= 20
        ? `Diferencia significativa (${diff} pts). Focalizar recursos en "${mayor.query}".`
        : "Perfiles comparables. Análisis paralelo recomendado.",
      400
    ),
    entidadAuditarPrimero: mayor.query,
    justificacionPrioridad: body(`Score superior y mayor densidad de alertas en "${mayor.query}".`, 200),
    source: "derived",
    meta: { model: NEURAUDIT_GEMINI_MODEL, durationMs: 0, geminiConnected: false, engine: "derived" },
  }
}

function parseDeepJson(text: string): Record<string, string> | null {
  try {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null
    const parsed = JSON.parse(match[0]) as Record<string, unknown>
    const out: Record<string, string> = {}
    for (const key of DEEP_SECTIONS) {
      if (parsed[key]) out[key] = String(parsed[key])
    }
    return out.resumenEjecutivo ? out : null
  } catch {
    return null
  }
}

async function invokeGeminiDirect(prompt: string): Promise<{ text: string | null; tokens: number; ms: number }> {
  const apiKey = getGeminiApiKey()
  if (!apiKey) return { text: null, tokens: 0, ms: 0 }

  const start = Date.now()
  try {
    const { ChatGoogleGenerativeAI } = await import("@langchain/google-genai")
    const model = new ChatGoogleGenerativeAI({
      model: NEURAUDIT_GEMINI_MODEL,
      apiKey,
      temperature: 0.35,
      maxRetries: 1,
    })
    const response = await model.invoke(prompt)
    const text = typeof response.content === "string" ? response.content : String(response.content)
    const tokens = prompt.split(/\s+/).length + text.split(/\s+/).length
    return { text: text.trim(), tokens, ms: Date.now() - start }
  } catch (err) {
    console.error("[Analysis] Gemini direct error:", err)
    return { text: null, tokens: 0, ms: Date.now() - start }
  }
}

function buildDeepPrompt(result: SearchResult): string {
  const enriched = enrichResult(result)
  const ctx = analyticsToPromptContext(
    enriched.analytics as unknown as InvestigationAnalytics,
    enriched
  )
  return `${ANALYST_SYSTEM_PROMPT}

Responde SOLO JSON válido con claves:
resumenEjecutivo (min 500 palabras), evaluacionRiesgo (min 500), hallazgosCriticos (min 500),
evaluacionContratacion (min 500), riesgoConcentracion (min 300), riesgoDisciplinario (min 300),
riesgoFiscal (min 300), recomendaciones (min 500), conclusion (min 500).

Datos:
${ctx}`
}

export async function generateAnalysis(result: SearchResult): Promise<AnalystAnalysis> {
  const enriched = enrichResult(result)
  const derived = buildDerivedAnalysis(enriched)

  const adkAgent = await invokeAdkAgentInvestigation(enriched.query, enriched)
  if (adkAgent) return adkAgent

  const adk = await invokeADKAnalysis(enriched.query, enriched)
  if (adk?.raw && adk.raw.resumenEjecutivo) {
    const mapped = mapADKToAnalysis(adk.raw, adk.durationMs)
    mapped.riesgosRelevantes = mapped.evaluacionRiesgo
    return mapped
  }

  const prompt = buildDeepPrompt(enriched)
  const gem = await invokeGeminiDirect(prompt)
  if (gem.text) {
    const parsed = parseDeepJson(gem.text)
    if (parsed?.resumenEjecutivo) {
      return {
        resumenEjecutivo: parsed.resumenEjecutivo || "",
        evaluacionRiesgo: parsed.evaluacionRiesgo || "",
        hallazgosCriticos: parsed.hallazgosCriticos || "",
        evaluacionContratacion: parsed.evaluacionContratacion || "",
        riesgoConcentracion: parsed.riesgoConcentracion || "",
        riesgoDisciplinario: parsed.riesgoDisciplinario || "",
        riesgoFiscal: parsed.riesgoFiscal || "",
        recomendaciones: parsed.recomendaciones || "",
        conclusion: parsed.conclusion || "",
        riesgosRelevantes: parsed.evaluacionRiesgo || "",
        source: "gemini",
        meta: {
          model: NEURAUDIT_GEMINI_MODEL,
          durationMs: gem.ms,
          estimatedTokens: gem.tokens,
          geminiConnected: true,
          engine: "gemini",
        },
      }
    }
  }

  return derived
}

export async function generateComparativeAnalysis(
  entidadA: SearchResult,
  entidadB: SearchResult
): Promise<ComparativeAnalystAnalysis> {
  const a = enrichResult(entidadA)
  const b = enrichResult(entidadB)
  const derived = buildDerivedComparativeAnalysis(a, b)

  const adk = await invokeADKAnalysis(`${a.query} vs ${b.query}`, a, b)
  if (adk?.raw && (adk.raw.entidadMayorRiesgo || adk.raw.conclusion)) {
    return mapADKToComparative(adk.raw, adk.durationMs)
  }

  const ctxA = analyticsToPromptContext(a.analytics as unknown as InvestigationAnalytics, a)
  const ctxB = analyticsToPromptContext(b.analytics as unknown as InvestigationAnalytics, b)
  const prompt = `${ANALYST_SYSTEM_PROMPT}

Compara entidades. JSON: entidadMayorRiesgo, diferenciasRelevantes, prioridadesAuditoria, conclusion, entidadAuditarPrimero, justificacionPrioridad.
Mínimo 400 palabras por campo narrativo.

A: ${ctxA}

B: ${ctxB}`

  const gem = await invokeGeminiDirect(prompt)
  if (gem.text) {
    try {
      const match = gem.text.match(/\{[\s\S]*\}/)
      if (match) {
        const p = JSON.parse(match[0])
        return {
          entidadMayorRiesgo: String(p.entidadMayorRiesgo || ""),
          diferenciasRelevantes: String(p.diferenciasRelevantes || ""),
          prioridadesAuditoria: String(p.prioridadesAuditoria || ""),
          conclusion: String(p.conclusion || ""),
          entidadAuditarPrimero: String(p.entidadAuditarPrimero || ""),
          justificacionPrioridad: String(p.justificacionPrioridad || ""),
          source: "gemini",
          meta: {
            model: NEURAUDIT_GEMINI_MODEL,
            durationMs: gem.ms,
            estimatedTokens: gem.tokens,
            geminiConnected: true,
            engine: "gemini",
          },
        }
      }
    } catch { /* fallback */ }
  }

  return derived
}

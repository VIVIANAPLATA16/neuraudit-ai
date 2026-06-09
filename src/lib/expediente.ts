import type { SearchResult } from "./types"
import { buildDerivedAnalysis } from "./analysis"
import { formatCOP } from "./utils"

export interface ExpedienteContent {
  titulo: string
  entidad: string
  fecha: string
  score: number
  nivel: string
  analisisEjecutivo: string
  scoreInterpretacion: string
  clasificacion: string
  benchmark: string
  factores: { factor: string; impacto: string; analisis: string }[]
  hallazgos: { titulo: string; descripcion: string; prioridad: string; impactoPotencial: string[] }[]
  recomendaciones: string[]
  analistaIA: {
    resumenEjecutivo: string
    evaluacionRiesgo: string
    hallazgosCriticos: string
    evaluacionContratacion: string
    riesgoConcentracion: string
    riesgoDisciplinario: string
    riesgoFiscal: string
    recomendaciones: string
    conclusion: string
    source?: string
  }
  conclusionIA: string
  contratosDestacados: { entidad: string; proveedor: string; valor: string; motivo: string }[]
  proveedoresRecurrentes: { nombre: string; apariciones: number; valor: string; interpretacion: string }[]
  concentracion: { porcentaje: number; interpretacion: string }
  aclaraciones: string[]
  trazabilidad: string[]
  metricas: { label: string; value: string; nota?: string }[]
}

export function buildExpediente(result: SearchResult): ExpedienteContent {
  const { riesgo, query, timestamp, interpretacion: interp } = result

  const analisisEjecutivo =
    interp?.analisisEjecutivo ||
    (riesgo.totalContratos === 0
      ? `No se encontraron registros públicos para "${query}" en las fuentes consultadas.`
      : `Investigación sobre "${query}" con score ${riesgo.score}/100 (${riesgo.nivel}).`)

  const analistaIA = result.analisisIA || buildDerivedAnalysis(result)

  const conclusionIA = [
    analistaIA.resumenEjecutivo,
    analistaIA.conclusion,
  ].join("\n\n")

  return {
    titulo: `INFORME DE AUDITORÍA — ${query.toUpperCase()}`,
    entidad: query,
    fecha: new Date(timestamp).toLocaleString("es-CO"),
    score: riesgo.score,
    nivel: riesgo.nivel,
    analisisEjecutivo,
    scoreInterpretacion: interp?.scoreInterpretacion || `Score ${riesgo.score}/100 — Riesgo ${riesgo.nivel}.`,
    clasificacion: interp?.clasificacion || `Riesgo ${riesgo.nivel}`,
    benchmark: interp?.benchmark || "",
    factores: (interp?.factores || []).map((f) => ({
      factor: f.factor,
      impacto: f.impacto,
      analisis: f.analisis,
    })),
    hallazgos: (interp?.hallazgos || []).map((h) => ({
      titulo: h.titulo,
      descripcion: h.descripcion,
      prioridad: h.prioridad,
      impactoPotencial: h.impactoPotencial,
    })),
    recomendaciones: riesgo.recomendaciones || [],
    analistaIA: {
      resumenEjecutivo: analistaIA.resumenEjecutivo,
      evaluacionRiesgo: analistaIA.evaluacionRiesgo,
      hallazgosCriticos: analistaIA.hallazgosCriticos,
      evaluacionContratacion: analistaIA.evaluacionContratacion,
      riesgoConcentracion: analistaIA.riesgoConcentracion,
      riesgoDisciplinario: analistaIA.riesgoDisciplinario,
      riesgoFiscal: analistaIA.riesgoFiscal,
      recomendaciones: analistaIA.recomendaciones,
      conclusion: analistaIA.conclusion,
      source: analistaIA.source,
    },
    conclusionIA,
    contratosDestacados: (interp?.contratosDestacados || []).map((c) => ({
      entidad: c.entidad,
      proveedor: c.proveedor,
      valor: c.valor,
      motivo: c.motivoRelevancia,
    })),
    proveedoresRecurrentes: (interp?.proveedoresRecurrentes || []).map((p) => ({
      nombre: p.nombre,
      apariciones: p.apariciones,
      valor: p.valorAcumulado,
      interpretacion: p.interpretacion,
    })),
    concentracion: {
      porcentaje: interp?.concentracion?.porcentaje || 0,
      interpretacion: interp?.concentracion?.interpretacion || "",
    },
    aclaraciones: interp?.aclaraciones || [],
    trazabilidad: interp?.trazabilidad || [],
    metricas: [
      { label: "Contratos analizados", value: String(riesgo.totalContratos) },
      { label: "Valor contratado", value: formatCOP(riesgo.valorTotal) },
      {
        label: "Responsabilidad fiscal (CGR)",
        value: formatCOP(riesgo.montoCGR),
        nota: riesgo.montoCGR === 0 ? "No se identificaron fallos fiscales activos. Esto no elimina otros riesgos." : undefined,
      },
      { label: "Registros Procuraduría", value: String(result.fuentes.procuraduria) },
      { label: "Procesos sin competencia", value: String(riesgo.sinCompetencia) },
      { label: "Contratos directos", value: String(riesgo.directos) },
    ],
  }
}

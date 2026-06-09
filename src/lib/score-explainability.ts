/**
 * Explicabilidad formal del score de riesgo NeurAudit.
 * Documenta reglas aplicadas y no aplicadas.
 */

import type { RiskEngineOutput } from "./risk-engine"
import type { ScoreExplainability, ScoreRuleExplanation } from "./types"

/** Reglas documentadas alineadas con risk-engine.ts */
const ALL_RULES: Omit<ScoreRuleExplanation, "cumplida" | "puntos">[] = [
  {
    id: "concentracion",
    factor: "Concentración contractual",
    regla: "Motor NeurAudit — distribución por entidad",
    condicion: ">10 contratos concentrados en <3 entidades",
    pesoMaximo: 25,
  },
  {
    id: "contratacion_directa",
    factor: "Contratación directa",
    regla: "SECOP I/II — modalidad de contratación",
    condicion: ">60% de contratos por modalidad directa",
    pesoMaximo: 20,
  },
  {
    id: "cgr",
    factor: "Responsabilidad fiscal (CGR)",
    regla: "Contraloría General de la República",
    condicion: "≥1 fallo de responsabilidad fiscal",
    pesoMaximo: 35,
  },
  {
    id: "sanciones",
    factor: "Sanciones contractuales",
    regla: "Registro Nacional de Sanciones",
    condicion: "≥1 sanción contractual registrada",
    pesoMaximo: 20,
  },
  {
    id: "procuraduria",
    factor: "Registros Procuraduría",
    regla: "Relatoría Procuraduría General de la Nación",
    condicion: "≥1 registro en Relatoría",
    pesoMaximo: 25,
  },
  {
    id: "competencia",
    factor: "Baja competencia",
    regla: "SECOP Procesos de Contratación",
    condicion: ">2 procesos con ≤1 proponente",
    pesoMaximo: 15,
  },
  {
    id: "contadores",
    factor: "Contadores sancionados",
    regla: "Registro de contadores sancionados",
    condicion: "≥1 sanción disciplinaria a contador vinculado",
    pesoMaximo: 10,
  },
  {
    id: "volumen",
    factor: "Volumen contractual elevado",
    regla: "Suma de contratos SECOP",
    condicion: "Valor total > $1.000 millones COP",
    pesoMaximo: 10,
  },
  {
    id: "sgr",
    factor: "Recursos de regalías (SGR)",
    regla: "Sistema General de Regalías",
    condicion: "Recursos SGR > $500 millones COP",
    pesoMaximo: 15,
  },
  {
    id: "fraccionamiento",
    factor: "Posible fraccionamiento",
    regla: "Detección de umbrales legales",
    condicion: "≥3 contratos justo por debajo de umbrales",
    pesoMaximo: 20,
  },
]

function nivelFromScore(score: number): string {
  if (score >= 70) return "Crítico"
  if (score >= 50) return "Alto"
  if (score >= 30) return "Medio"
  return "Bajo"
}

export function buildScoreExplainability(riesgo: RiskEngineOutput): ScoreExplainability {
  const aplicados = riesgo.scoreBreakdown || []
  const aplicadosMap = new Map(aplicados.map((a) => [a.factor, a]))

  const factoresAplicados: ScoreRuleExplanation[] = aplicados.map((item) => {
    const rule = ALL_RULES.find((r) => r.factor === item.factor)
    return {
      id: rule?.id || item.factor,
      factor: item.factor,
      regla: rule?.regla || item.factor,
      condicion: rule?.condicion || "Condición evaluada por motor de riesgo",
      pesoMaximo: rule?.pesoMaximo || item.points,
      cumplida: true,
      puntos: item.points,
      evidencia: item.description,
    }
  })

  const factoresNoAplicados: ScoreRuleExplanation[] = ALL_RULES.filter(
    (r) => !aplicadosMap.has(r.factor)
  ).map((r) => ({ ...r, cumplida: false, puntos: 0 }))

  const sumaPuntos = aplicados.reduce((s, a) => s + a.points, 0)
  const capAplicado = sumaPuntos > 100

  const interpretacion =
    aplicados.length === 0
      ? `Score ${riesgo.score}/100 (Riesgo ${riesgo.nivel}): no se activó ninguna regla de riesgo. ` +
        "La entidad no presenta señales adversas en las fuentes consultadas."
      : `Score ${riesgo.score}/100 (Riesgo ${riesgo.nivel}): ${aplicados.length} de ${ALL_RULES.length} reglas activas. ` +
        `Contribución bruta: ${sumaPuntos} pts${capAplicado ? " (cap aplicado a 100)" : ""}. ` +
        `Factor principal: ${aplicados[0]?.factor} (+${aplicados[0]?.points} pts).`

  return {
    scoreFinal: riesgo.score,
    nivel: riesgo.nivel,
    formula: "score = min(100, Σ puntos por regla activa)",
    totalReglas: ALL_RULES.length,
    reglasActivas: aplicados.length,
    factoresAplicados,
    factoresNoAplicados,
    sumaPuntos,
    capAplicado,
    interpretacion,
    benchmark: `Percentil estimado ${nivelFromScore(riesgo.score)} según umbrales NeurAudit (Bajo <30, Medio 30-49, Alto 50-69, Crítico ≥70)`,
  }
}

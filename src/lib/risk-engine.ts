import type { ScoreBreakdownItem } from "./types"

export interface RiskEngineInput {
  contratos: Record<string, unknown>[]
  procesos: Record<string, unknown>[]
  cgr: Record<string, unknown>[]
  sanciones: Record<string, unknown>[]
  contadores: Record<string, unknown>[]
  procuraduria: Record<string, unknown>[]
  sgr: Record<string, unknown>[]
}

export interface RiskEngineOutput {
  score: number
  nivel: string
  alertas: string[]
  scoreBreakdown: ScoreBreakdownItem[]
  hallazgos: string[]
  recomendaciones: string[]
  totalContratos: number
  entidadesUnicas: number
  directos: number
  fraccionados: number
  valorTotal: number
  montoCGR: number
  montoSanc: number
  totalSGR: number
  sinCompetencia: number
}

function addFactor(
  breakdown: ScoreBreakdownItem[],
  alertas: string[],
  factor: string,
  points: number,
  description: string,
  alerta?: string
) {
  breakdown.push({ factor, points, description })
  if (alerta) alertas.push(alerta)
}

export function calcularRiesgo(input: RiskEngineInput): RiskEngineOutput {
  const { contratos, procesos, cgr, sanciones, contadores, procuraduria, sgr } = input
  const alertas: string[] = []
  const scoreBreakdown: ScoreBreakdownItem[] = []
  const hallazgos: string[] = []
  const recomendaciones: string[] = []
  let score = 0

  const total = contratos.length
  const entidades = new Set(contratos.map((c) => c.nombre_entidad || c.nombre_de_la_entidad || "")).size
  const directos = contratos.filter((c) =>
    String(c.modalidad_de_contratacion || "").toLowerCase().includes("directa")
  ).length
  const valorTotal = contratos.reduce((acc, c) => acc + (parseFloat(String(c.valor_del_contrato)) || 0), 0)
  const montoCGR = cgr.reduce((acc, c) => {
    const m = parseFloat(String(c.monto_de_la_multa_o_sanci || "0").replace(/[$,\s]/g, ""))
    return acc + (isNaN(m) ? 0 : m)
  }, 0)
  const montoSanc = sanciones.reduce((acc, c) => acc + (parseFloat(String(c.valor_sancion)) || 0), 0)
  const sinCompetencia = procesos.filter((p) => parseInt(String(p.proveedores_que_manifestaron || "0")) <= 1).length
  const totalSGR = sgr.reduce((acc, c) => acc + (parseFloat(String(c.valor || c.monto || "0")) || 0), 0)

  const umbrales = [10_000_000, 28_000_000, 100_000_000]
  const fraccionadosList = contratos.filter((c) => {
    const v = parseFloat(String(c.valor_del_contrato)) || 0
    return umbrales.some((u) => v < u && (u - v) / u < 0.05)
  })
  const fraccionados = fraccionadosList.length

  // Concentración contractual
  if (total > 10 && entidades < 3) {
    score += 25
    addFactor(
      scoreBreakdown, alertas,
      "Concentración contractual",
      25,
      `${total} contratos concentrados en solo ${entidades} entidad(es)`,
      `Concentración extrema: ${total} contratos en solo ${entidades} entidades`
    )
    hallazgos.push(`Alta concentración contractual: ${total} contratos en ${entidades} entidad(es)`)
    recomendaciones.push("Revisar distribución de contratos entre entidades y validar justificación de concentración.")
  }

  // Proveedor dominante
  const proveedorMap = new Map<string, number>()
  contratos.forEach((c) => {
    const p = String(c.proveedor_adjudicado || "").trim()
    if (p) proveedorMap.set(p, (proveedorMap.get(p) || 0) + 1)
  })
  const topProveedor = [...proveedorMap.entries()].sort((a, b) => b[1] - a[1])[0]
  if (topProveedor && total > 5 && topProveedor[1] / total > 0.5) {
    hallazgos.push(
      `Dependencia de proveedor único: "${topProveedor[0]}" concentra ${Math.round((topProveedor[1] / total) * 100)}% de contratos`
    )
    recomendaciones.push(`Auditar recurrencia y relación contractual con el proveedor "${topProveedor[0]}".`)
  }

  // Contratación directa
  if (total > 0 && directos / total > 0.6) {
    score += 20
    const pct = Math.round((directos / total) * 100)
    addFactor(
      scoreBreakdown, alertas,
      "Contratación directa",
      20,
      `${pct}% de contratos por modalidad directa (${directos}/${total})`,
      `${directos}/${total} contratos por contratación directa (${pct}%)`
    )
    hallazgos.push(`Contratación directa elevada: ${pct}% del total contractual`)
    recomendaciones.push("Auditar contratos directos de mayor cuantía y verificar estudios previos en SECOP II.")
  }

  // CGR
  if (cgr.length > 0) {
    score += 35
    addFactor(
      scoreBreakdown, alertas,
      "Responsabilidad fiscal (CGR)",
      35,
      `${cgr.length} fallo(s) CGR por $${(montoCGR / 1e9).toFixed(2)}B COP`,
      `CRÍTICO: ${cgr.length} fallo(s) CGR — $${(montoCGR / 1e9).toFixed(2)}B COP en responsabilidad fiscal`
    )
    hallazgos.push(`Riesgo de reincidencia: ${cgr.length} fallo(s) de responsabilidad fiscal registrados`)
    recomendaciones.push("Cruzar fallos CGR con contratos vigentes y verificar cumplimiento de sanciones.")
  }

  // Sanciones
  if (sanciones.length > 0) {
    score += 20
    addFactor(
      scoreBreakdown, alertas,
      "Sanciones contractuales",
      20,
      `${sanciones.length} sanción(es) por $${(montoSanc / 1e6).toFixed(0)}M COP`,
      `${sanciones.length} sanción(es) contractual(es) — $${(montoSanc / 1e6).toFixed(0)}M COP`
    )
    hallazgos.push(`${sanciones.length} sanción(es) contractual(es) en bases oficiales`)
    recomendaciones.push("Verificar inhabilidad de contratistas sancionados según Ley 80/1993 Art. 8.")
  }

  // Procuraduría
  if (procuraduria.length > 0) {
    score += 25
    addFactor(
      scoreBreakdown, alertas,
      "Registros Procuraduría",
      25,
      `${procuraduria.length} registro(s) en Relatoría Procuraduría`,
      `${procuraduria.length} registro(s) en Relatoría Procuraduría — revisar inhabilidades`
    )
    hallazgos.push(`${procuraduria.length} registro(s) en Procuraduría — posibles inhabilidades`)
    recomendaciones.push("Consultar antecedentes disciplinarios e inhabilidades en Procuraduría.")
  }

  // Sin competencia
  if (sinCompetencia > 2) {
    score += 15
    addFactor(
      scoreBreakdown, alertas,
      "Baja competencia",
      15,
      `${sinCompetencia} proceso(s) con ≤1 proponente`,
      `${sinCompetencia} proceso(s) sin competencia real (≤1 proponente)`
    )
    hallazgos.push(`Baja competencia: ${sinCompetencia} procesos con un solo proponente`)
    recomendaciones.push("Validar procesos sin competencia real y revisar estudios de mercado.")
  }

  // Contadores
  if (contadores.length > 0) {
    score += 10
    addFactor(
      scoreBreakdown, alertas,
      "Contadores sancionados",
      10,
      `${contadores.length} sanción(es) disciplinaria(s) a contadores vinculados`,
      `${contadores.length} sanción(es) disciplinaria(s) a contador(es) vinculado(s)`
    )
    hallazgos.push(`${contadores.length} contador(es) sancionado(s) vinculado(s) a la entidad`)
  }

  // Valor elevado
  if (valorTotal > 1_000_000_000) {
    score += 10
    addFactor(
      scoreBreakdown, alertas,
      "Volumen contractual elevado",
      10,
      `Valor total contratado: $${(valorTotal / 1e9).toFixed(2)}B COP`,
      `Valor total contratado: $${(valorTotal / 1e9).toFixed(2)}B COP`
    )
  }

  // SGR
  if (totalSGR > 500_000_000) {
    score += 15
    addFactor(
      scoreBreakdown, alertas,
      "Recursos de regalías (SGR)",
      15,
      `$${(totalSGR / 1e9).toFixed(2)}B COP en recursos SGR`,
      `Recursos SGR involucrados: $${(totalSGR / 1e9).toFixed(2)}B COP — requiere revisión Contraloría`
    )
    hallazgos.push(`Recursos SGR significativos: $${(totalSGR / 1e9).toFixed(2)}B COP`)
    recomendaciones.push("Revisar ejecución de recursos SGR con Contraloría territorial.")
  }

  // Fraccionamiento
  if (fraccionados >= 3) {
    score += 20
    addFactor(
      scoreBreakdown, alertas,
      "Posible fraccionamiento",
      20,
      `${fraccionados} contratos justo por debajo de umbrales legales`,
      `Posible fraccionamiento: ${fraccionados} contratos con valores justo por debajo de umbrales legales`
    )
    hallazgos.push(`Posible fraccionamiento contractual: ${fraccionados} contratos bajo umbrales legales`)
    recomendaciones.push("Priorizar revisión de contratos fraccionados cerca de umbrales de Ley 1150/2007.")
  }

  if (total === 0) {
    hallazgos.push("No se encontraron contratos en SECOP para esta entidad")
    recomendaciones.push("Verificar nombre exacto de la entidad, NIT o razón social en datos.gov.co.")
  }

  if (recomendaciones.length === 0 && score >= 50) {
    recomendaciones.push("Monitorear contratación periódica en SECOP II.")
  } else if (recomendaciones.length === 0) {
    recomendaciones.push("Mantener monitoreo preventivo — ninguna señal crítica detectada.")
  }

  const finalScore = Math.min(100, score)
  return {
    score: finalScore,
    nivel: finalScore >= 75 ? "ALTO" : finalScore >= 50 ? "MEDIO" : "BAJO",
    alertas,
    scoreBreakdown,
    hallazgos,
    recomendaciones,
    totalContratos: total,
    entidadesUnicas: entidades,
    directos,
    fraccionados,
    valorTotal,
    montoCGR,
    montoSanc,
    totalSGR,
    sinCompetencia,
  }
}

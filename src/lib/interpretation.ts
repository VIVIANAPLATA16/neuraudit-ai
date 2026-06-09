import type {
  InterpretacionAnalisis,
  FactorInterpretacion,
  HallazgoEnriquecido,
  ContratoDestacado,
  ProveedorRecurrente,
  ScoreBreakdownItem,
  SourcesData,
  RiskData,
  SourceTraceEntry,
} from "./types"
import { formatCOP } from "./utils"

interface InterpretacionInput {
  query: string
  riesgo: RiskData
  fuentes: SourcesData
  fuentesTrace?: SourceTraceEntry[]
  contratos: Record<string, unknown>[]
  timestamp: string
}

function impactoFromPoints(points: number): "Alto" | "Medio" | "Bajo" {
  if (points >= 25) return "Alto"
  if (points >= 15) return "Medio"
  return "Bajo"
}

function interpretFactor(item: ScoreBreakdownItem, riesgo: RiskData, fuentes: SourcesData): FactorInterpretacion {
  const impacto = impactoFromPoints(item.points)
  const f = item.factor.toLowerCase()

  let analisis = item.description + ". "

  if (f.includes("procuraduría") || f.includes("procuraduria")) {
    analisis =
      `Se identificaron ${fuentes.procuraduria} registro(s) asociados a fuentes disciplinarias. ` +
      "Esto no implica automáticamente responsabilidad o sanción vigente, pero constituye una señal que justifica validaciones adicionales sobre antecedentes e inhabilidades de contratistas y funcionarios vinculados."
  } else if (f.includes("competencia") || f.includes("baja competencia")) {
    analisis =
      `Se encontraron ${riesgo.sinCompetencia} proceso(s) con un único proponente. ` +
      "La baja competencia puede ser consistente con mercados especializados, pero también puede indicar barreras de entrada o condiciones que limitan la concurrencia. Amerita revisión de estudios de mercado y pliegos de condiciones."
  } else if (f.includes("directa") || f.includes("contratación directa")) {
    analisis =
      `${riesgo.directos} contrato(s) se ejecutaron por modalidad directa. ` +
      "Una proporción elevada de contratación directa reduce la transparencia competitiva y aumenta la exposición a riesgos de direccionamiento o favoritismo si no existe justificación documental robusta."
  } else if (f.includes("cgr") || f.includes("fiscal")) {
    analisis =
      `Existen ${fuentes.cgr} fallo(s) de responsabilidad fiscal por ${formatCOP(riesgo.montoCGR)}. ` +
      "Los antecedentes de la Contraloría representan uno de los indicadores de mayor peso en el análisis, dado que evidencian determinaciones formales sobre manejo de recursos públicos."
  } else if (f.includes("sancion")) {
    analisis =
      `${fuentes.sanciones} sanción(es) contractual(es) registradas. ` +
      "Las sanciones previas pueden indicar incumplimientos contractuales reiterados y deben cruzarse con contratistas activos en SECOP."
  } else if (f.includes("concentración") || f.includes("concentracion")) {
    analisis =
      `Se observa concentración contractual: ${riesgo.totalContratos} contratos en ${riesgo.entidadesUnicas} entidad(es). ` +
      "La concentración incrementa el riesgo de dependencia operativa y dificulta la diversificación de proveedores."
  } else if (f.includes("fraccionamiento")) {
    analisis =
      `${riesgo.fraccionados} contrato(s) presentan valores justo por debajo de umbrales legales. ` +
      "Este patrón puede indicar fraccionamiento contractual, práctica que la normativa colombiana prohíbe expresamente para evadir procesos competitivos."
  } else if (f.includes("volumen") || f.includes("valor")) {
    analisis =
      `El valor contratado supera ${formatCOP(riesgo.valorTotal)}. ` +
      "Un mayor volumen contractual incrementa la exposición al riesgo operativo y financiero, razón por la cual contribuye al score aunque no constituya por sí solo una irregularidad."
  } else if (f.includes("regalías") || f.includes("sgr")) {
    analisis =
      `Recursos de regalías identificados por ${formatCOP(riesgo.totalSGR)}. ` +
      "Los recursos del SGR requieren especial vigilancia dado su origen constitucional y las obligaciones de control de la Contraloría."
  } else if (f.includes("contador")) {
    analisis =
      "Se identificaron sanciones disciplinarias a contadores vinculados. " +
      "Esto puede afectar la confiabilidad de estados financieros y dictámenes contables asociados a procesos contractuales."
  } else {
    analisis += "Este factor contribuye al score global y debe evaluarse en conjunto con los demás indicadores del análisis."
  }

  return { factor: item.factor, points: item.points, impacto, analisis }
}

function buildHallazgosEnriquecidos(
  riesgo: RiskData,
  fuentes: SourcesData,
  query: string
): HallazgoEnriquecido[] {
  const hallazgos: HallazgoEnriquecido[] = []

  if (fuentes.procuraduria > 0) {
    hallazgos.push({
      titulo: "Antecedentes disciplinarios identificados",
      descripcion: `Se encontraron ${fuentes.procuraduria} registro(s) relacionados con fuentes disciplinarias consultadas para "${query}". Aunque la existencia de registros no implica automáticamente sanción vigente, representa una señal que requiere revisión documental y validación individual de cada caso.`,
      impactoPotencial: ["Riesgos reputacionales", "Riesgos de cumplimiento", "Restricciones contractuales futuras", "Inhabilidades e incompatibilidades"],
      prioridad: fuentes.procuraduria >= 10 ? "Alta" : "Media",
    })
  }

  if (riesgo.sinCompetencia > 0) {
    hallazgos.push({
      titulo: "Procesos con baja competencia",
      descripcion: `${riesgo.sinCompetencia} proceso(s) de licitación registraron un único proponente. Esto puede reflejar mercados especializados legítimos, pero también puede señalar barreras de entrada, pliegos restrictivos o condiciones que limitan la participación de oferentes.`,
      impactoPotencial: ["Riesgo de direccionamiento", "Precios no competitivos", "Debilitamiento del control social", "Posible cartelización"],
      prioridad: riesgo.sinCompetencia >= 10 ? "Alta" : "Media",
    })
  }

  if (riesgo.directos > 0 && riesgo.totalContratos > 0 && riesgo.directos / riesgo.totalContratos > 0.4) {
    hallazgos.push({
      titulo: "Contratación directa significativa",
      descripcion: `${riesgo.directos} de ${riesgo.totalContratos} contratos (${Math.round((riesgo.directos / riesgo.totalContratos) * 100)}%) se adjudicaron por contratación directa. Modalidades directas requieren justificación expresa y estudios previos que demuestren la imposibilidad de selección mediante concurso.`,
      impactoPotencial: ["Menor transparencia", "Riesgo de favoritismo", "Dificultad para control ciudadano"],
      prioridad: riesgo.directos / riesgo.totalContratos > 0.6 ? "Alta" : "Media",
    })
  }

  if (fuentes.cgr > 0) {
    hallazgos.push({
      titulo: "Antecedentes de responsabilidad fiscal",
      descripcion: `${fuentes.cgr} fallo(s) de responsabilidad fiscal identificados por ${formatCOP(riesgo.montoCGR)}. Estos antecedentes constituyen determinaciones formales de la Contraloría sobre manejo indebido de recursos públicos.`,
      impactoPotencial: ["Responsabilidad fiscal personal", "Reintegros al erario", "Inhabilidades para contratar con el Estado"],
      prioridad: "Alta",
    })
  }

  if (riesgo.fraccionados >= 3) {
    hallazgos.push({
      titulo: "Posible fraccionamiento contractual",
      descripcion: `${riesgo.fraccionados} contrato(s) presentan valores inmediatamente inferiores a umbrales legales de contratación. Este patrón es indicativo de posible fraccionamiento, conducta sancionable bajo la Ley 1474 de 2011.`,
      impactoPotencial: ["Evación de licitación pública", "Riesgo disciplinario", "Responsabilidad fiscal"],
      prioridad: "Alta",
    })
  }

  if (fuentes.sanciones > 0) {
    hallazgos.push({
      titulo: "Sanciones contractuales previas",
      descripcion: `${fuentes.sanciones} sanción(es) contractual(es) registradas por ${formatCOP(riesgo.montoSanc)}. Indica historial de incumplimientos que debe verificarse contra contratistas actualmente activos.`,
      impactoPotencial: ["Incumplimiento reiterado", "Multas y sanciones", "Inhabilidad para contratar"],
      prioridad: "Media",
    })
  }

  if (hallazgos.length === 0 && riesgo.totalContratos > 0) {
    hallazgos.push({
      titulo: "Sin hallazgos críticos identificados",
      descripcion: `El análisis de ${riesgo.totalContratos} contrato(s) no reveló patrones de riesgo elevado en las dimensiones evaluadas. Se recomienda monitoreo preventivo periódico.`,
      impactoPotencial: ["Riesgo operativo residual"],
      prioridad: "Baja",
    })
  }

  return hallazgos
}

function buildContratosDestacados(contratos: Record<string, unknown>[]): ContratoDestacado[] {
  const sorted = [...contratos]
    .map((c) => ({
      entidad: String(c.nombre_entidad || c.nombre_de_la_entidad || "—"),
      proveedor: String(c.proveedor_adjudicado || "—"),
      valorNumerico: parseFloat(String(c.valor_del_contrato)) || 0,
    }))
    .filter((c) => c.valorNumerico > 0)
    .sort((a, b) => b.valorNumerico - a.valorNumerico)
    .slice(0, 5)

  return sorted.map((c, i) => ({
    ...c,
    valor: formatCOP(c.valorNumerico),
    motivoRelevancia:
      i === 0
        ? "Contrato de mayor valor identificado en el análisis. Concentra la mayor exposición financiera individual."
        : `Se encuentra entre los ${sorted.length} contratos de mayor valor observados durante el análisis.`,
  }))
}

function buildProveedoresRecurrentes(contratos: Record<string, unknown>[]): ProveedorRecurrente[] {
  const map = new Map<string, { count: number; total: number }>()
  contratos.forEach((c) => {
    const p = String(c.proveedor_adjudicado || "").trim()
    if (!p || p === "—") return
    const val = parseFloat(String(c.valor_del_contrato)) || 0
    const cur = map.get(p) || { count: 0, total: 0 }
    map.set(p, { count: cur.count + 1, total: cur.total + val })
  })

  return [...map.entries()]
    .filter(([, v]) => v.count >= 2)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5)
    .map(([nombre, { count, total }]) => ({
      nombre,
      apariciones: count,
      valorAcumulado: formatCOP(total),
      interpretacion:
        count >= 5
          ? `Proveedor con recurrencia significativa (${count} contratos). La repetición puede indicar especialización legítima o, alternativamente, concentración de adjudicaciones que amerita revisión.`
          : `Proveedor recurrente con ${count} contrato(s). Verificar que la recurrencia responda a criterios objetivos de selección.`,
    }))
}

function buildConcentracion(contratos: Record<string, unknown>[], valorTotal: number) {
  const map = new Map<string, number>()
  contratos.forEach((c) => {
    const p = String(c.proveedor_adjudicado || "").trim()
    if (!p) return
    map.set(p, (map.get(p) || 0) + (parseFloat(String(c.valor_del_contrato)) || 0))
  })

  const top5 = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  const top5Total = top5.reduce((acc, [, v]) => acc + v, 0)
  const porcentaje = valorTotal > 0 ? Math.round((top5Total / valorTotal) * 100) : 0

  let interpretacion = "No se identificó concentración significativa de proveedores."
  if (porcentaje >= 70) {
    interpretacion = `Los cinco principales proveedores concentran el ${porcentaje}% del valor contractual identificado. Este nivel de concentración es elevado y sugiere dependencia significativa de un grupo reducido de contratistas.`
  } else if (porcentaje >= 40) {
    interpretacion = `Los cinco principales proveedores concentran el ${porcentaje}% del valor contractual identificado. Se recomienda evaluar si existen alternativas de mercado y diversificar la base de contratistas.`
  } else if (porcentaje > 0) {
    interpretacion = `Los cinco principales proveedores concentran el ${porcentaje}% del valor contractual. La distribución no presenta concentración extrema, aunque conviene monitorear la evolución.`
  }

  return { porcentaje, proveedoresTop5: top5.map(([n, v]) => ({ nombre: n, valor: formatCOP(v) })), interpretacion }
}

function buildBenchmark(score: number): string {
  if (score >= 75) {
    return `Score ${score}/100 — Clasificado como Riesgo Alto. Este puntaje supera significativamente el umbral de entidades con riesgo bajo (<40) y medio (40-74). Requiere atención prioritaria de auditores, veedores o funcionarios de control interno.`
  }
  if (score >= 50) {
    return `Score ${score}/100 — Clasificado como Riesgo Medio. Este puntaje se ubica por encima del promedio esperado para entidades sin alertas relevantes (<40), pero por debajo del umbral de riesgo alto (≥75). Justifica revisión focalizada de los factores identificados.`
  }
  if (score >= 25) {
    return `Score ${score}/100 — Clasificado como Riesgo Bajo-Medio. Por debajo del umbral de preocupación media (50), pero con señales que ameritan monitoreo preventivo.`
  }
  return `Score ${score}/100 — Clasificado como Riesgo Bajo. Por debajo de los umbrales de alerta establecidos. Se recomienda monitoreo rutinario.`
}

function buildScoreInterpretacion(riesgo: RiskData, fuentes: SourcesData): string {
  const topFactors = [...(riesgo.scoreBreakdown || [])].sort((a, b) => b.points - a.points).slice(0, 3)
  const factorNames = topFactors.map((f) => f.factor.toLowerCase()).join(", ")

  if (riesgo.totalContratos === 0) {
    return "No se encontraron contratos en SECOP para calcular un score significativo. El puntaje refleja únicamente registros encontrados en fuentes complementarias."
  }

  const hasFiscal = fuentes.cgr > 0
  const hasDisciplinary = fuentes.procuraduria > 0

  let text = `El puntaje de ${riesgo.score}/100 se ubica en la categoría de Riesgo ${riesgo.nivel}. `

  if (topFactors.length > 0) {
    text += `Está impulsado principalmente por: ${factorNames}. `
  }

  if (!hasFiscal && hasDisciplinary) {
    text += "Aunque no se observan hallazgos fiscales activos en Contraloría, la presencia de registros disciplinarios eleva el score por encima del nivel bajo."
  } else if (hasFiscal) {
    text += "Los antecedentes de responsabilidad fiscal de la Contraloría son el factor de mayor peso en la clasificación."
  } else if (riesgo.sinCompetencia > 5) {
    text += "La señal predominante proviene de procesos con baja competencia, lo que incrementa la exposición a riesgos de direccionamiento."
  } else {
    text += "No se identificaron factores de riesgo extremo, aunque las señales detectadas justifican vigilancia."
  }

  return text
}

function buildAnalisisEjecutivo(input: InterpretacionInput, hallazgos: HallazgoEnriquecido[]): string {
  const { query, riesgo, fuentes } = input
  const nivel = riesgo.nivel

  if (riesgo.totalContratos === 0 && fuentes.total === 0) {
    return `La consulta sobre "${query}" no arrojó registros en las 13 fuentes públicas analizadas. Esto puede deberse a un nombre impreciso, a que la entidad opera bajo otra razón social, o a que no tiene historial contractual reciente en SECOP. Se recomienda verificar el NIT o nombre oficial antes de emitir conclusiones.`
  }

  const partes: string[] = []

  partes.push(
    `La entidad consultada ("${query}") presenta un nivel de riesgo ${nivel} (${riesgo.score}/100) ` +
    `basado en el análisis de ${fuentes.total} registros distribuidos en ${riesgo.totalContratos} contrato(s) y fuentes complementarias de control.`
  )

  const altaPrioridad = hallazgos.filter((h) => h.prioridad === "Alta")
  if (altaPrioridad.length > 0) {
    partes.push(
      `El análisis identifica ${altaPrioridad.length} hallazgo(s) de prioridad alta, ` +
      `destacando: ${altaPrioridad.map((h) => h.titulo.toLowerCase()).join("; ")}. ` +
      "Estos elementos justifican una revisión más profunda por parte del auditor o investigador."
    )
  }

  if (fuentes.cgr === 0 && riesgo.montoCGR === 0) {
    partes.push(
      "No se identificaron fallos de responsabilidad fiscal activos en las fuentes de Contraloría consultadas. " +
      "Esto no elimina otros riesgos administrativos, disciplinarios o contractuales que el análisis haya detectado."
    )
  }

  if (riesgo.valorTotal > 0) {
    partes.push(
      `El valor contractual identificado asciende a ${formatCOP(riesgo.valorTotal)}, ` +
      "lo que define la magnitud de la exposición financiera bajo análisis."
    )
  }

  if (riesgo.recomendaciones.length > 0) {
    partes.push(`Acción prioritaria recomendada: ${riesgo.recomendaciones[0]}`)
  }

  return partes.join("\n\n")
}

function buildAclaraciones(riesgo: RiskData, fuentes: SourcesData): string[] {
  const aclaraciones: string[] = []

  if (riesgo.montoCGR === 0 && fuentes.cgr === 0) {
    aclaraciones.push(
      "Responsabilidad fiscal (CGR) = $0: No se identificaron fallos fiscales activos en las fuentes consultadas. Esto no elimina otros riesgos administrativos, disciplinarios o contractuales detectados en el análisis."
    )
  }

  if (fuentes.procuraduria > 0) {
    aclaraciones.push(
      `${fuentes.procuraduria} registro(s) en Procuraduría: La existencia de registros disciplinarios no implica automáticamente sanción vigente ni inhabilidad. Cada registro requiere validación documental individual.`
    )
  }

  if (riesgo.sinCompetencia > 0) {
    aclaraciones.push(
      `${riesgo.sinCompetencia} proceso(s) con un proponente: Un único oferente puede ser legítimo en mercados especializados. La señal de alerta requiere contrastar con el objeto contractual y el estudio de mercado.`
    )
  }

  if (riesgo.totalContratos > 0 && riesgo.valorTotal === 0) {
    aclaraciones.push(
      "Contratos sin valor registrado: Algunos registros en SECOP no incluyen valor contractual. El score puede subestimar la exposición financiera real."
    )
  }

  return aclaraciones
}

const STATUS_LABEL: Record<string, string> = {
  success: "éxito",
  empty: "sin registros",
  error: "error",
  timeout: "timeout",
  partial: "parcial",
}

function buildTrazabilidad(
  fuentes: SourcesData,
  riesgo: RiskData,
  timestamp: string,
  fuentesTrace?: SourceTraceEntry[]
): string[] {
  const lines: string[] = []

  if (fuentesTrace && fuentesTrace.length > 0) {
    lines.push(
      `Se consultaron ${fuentesTrace.length} fuente(s) oficiales en datos.gov.co con paginación automática.`
    )
    for (const src of fuentesTrace) {
      const estado = STATUS_LABEL[src.status] || src.status
      const detalle =
        src.status === "success" || src.status === "empty" || src.status === "partial"
          ? `${src.records} registro(s) en ${src.pages} página(s) (${src.durationMs}ms)${src.status === "partial" ? " — datos incompletos" : ""}`
          : src.message || estado
      lines.push(`• ${src.name} [${src.dataset}]: ${estado} — ${detalle}`)
    }
  }

  if (fuentes.secopII + fuentes.secopI > 0) {
    lines.push(
      `Se analizaron ${fuentes.secopII + fuentes.secopI} registro(s) contractuales provenientes de SECOP I y SECOP II, ` +
      "incluyendo datos de entidad, proveedor, modalidad y valor."
    )
  }

  if (fuentes.procuraduria > 0) {
    lines.push(
      `Se consultaron ${fuentes.procuraduria} registro(s) disciplinarios provenientes de la Relatoría de la Procuraduría General de la Nación.`
    )
  }

  if (fuentes.cgr > 0) {
    lines.push(`Se identificaron ${fuentes.cgr} fallo(s) de responsabilidad fiscal en bases de la Contraloría General de la República.`)
  }

  if (fuentes.sanciones > 0) {
    lines.push(`Se cruzaron ${fuentes.sanciones} sanción(es) contractuales en el Registro Nacional de Sanciones.`)
  }

  if (fuentes.sgr > 0) {
    lines.push(`Se consultaron ${fuentes.sgr} registro(s) de recursos de regalías (SGR).`)
  }

  if (fuentes.procesos > 0) {
    lines.push(
      `Se evaluaron ${fuentes.procesos} proceso(s) de licitación para detectar niveles de competencia entre proponentes.`
    )
  }

  lines.push(
    `Posteriormente se ejecutó el motor de riesgo NeurAudit, identificando ${riesgo.scoreBreakdown?.length || 0} factor(es) ` +
    `contributivos para un score de ${riesgo.score}/100 (Riesgo ${riesgo.nivel}).`
  )

  lines.push(`Análisis completado: ${new Date(timestamp).toLocaleString("es-CO")}.`)

  return lines
}

export function buildInterpretacion(input: InterpretacionInput): InterpretacionAnalisis {
  const { riesgo, fuentes, contratos } = input
  const hallazgos = buildHallazgosEnriquecidos(riesgo, fuentes, input.query)
  const factores = (riesgo.scoreBreakdown || []).map((item) => interpretFactor(item, riesgo, fuentes))
  const concentracion = buildConcentracion(contratos, riesgo.valorTotal)

  return {
    analisisEjecutivo: buildAnalisisEjecutivo(input, hallazgos),
    scoreInterpretacion: buildScoreInterpretacion(riesgo, fuentes),
    clasificacion: `Riesgo ${riesgo.nivel}`,
    benchmark: buildBenchmark(riesgo.score),
    factores,
    hallazgos,
    contratosDestacados: buildContratosDestacados(contratos),
    proveedoresRecurrentes: buildProveedoresRecurrentes(contratos),
    concentracion,
    aclaraciones: buildAclaraciones(riesgo, fuentes),
    trazabilidad: buildTrazabilidad(fuentes, riesgo, input.timestamp, input.fuentesTrace),
  }
}

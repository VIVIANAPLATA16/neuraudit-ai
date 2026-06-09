import type { SearchResult } from "./types"
import { formatCOP } from "./utils"

export interface InsightsResult {
  conclusionIA: string
  source: "gemini" | "derived"
}

function buildDerivedConclusion(result: SearchResult): string {
  const { riesgo, query, fuentes, interpretacion: interp } = result

  if (riesgo.totalContratos === 0 && fuentes.total === 0) {
    return `1. Resumen general\n\nLa consulta sobre "${query}" no arrojó registros en las fuentes públicas analizadas. Antes de emitir un dictamen, se recomienda verificar el NIT o la razón social oficial de la entidad, así como ampliar la búsqueda con variantes del nombre o siglas institucionales.\n\n2. Riesgos principales\n\nNo aplican por ausencia de datos verificables en SECOP, Contraloría, Procuraduría y demás fuentes integradas.\n\n3. Riesgos secundarios\n\nNo aplican en ausencia de registros.\n\n4. Aspectos positivos\n\nNo se identificaron señales de alerta en las fuentes consultadas.\n\n5. Prioridades de revisión\n\nConfirmar la identificación correcta de la entidad y repetir la consulta con parámetros precisos (NIT, razón social completa o dependencia específica).\n\n6. Recomendación final\n\nSuspender conclusiones definitivas hasta obtener datos verificables. El auditor debe documentar la imposibilidad de acceder a información antes de cerrar el expediente.`
  }

  const sections: string[] = []

  // 1. Resumen general
  const resumenParts = [
    interp?.analisisEjecutivo ||
      `La entidad "${query}" presenta un nivel de riesgo ${riesgo.nivel} con un score de ${riesgo.score}/100.`,
    interp?.scoreInterpretacion || "",
    `El análisis integró ${fuentes.total} registros provenientes de SECOP I, SECOP II, Contraloría, Procuraduría, Registro de Sanciones, SGR y fuentes complementarias. Se identificaron ${riesgo.totalContratos} contrato(s) por un valor acumulado de ${formatCOP(riesgo.valorTotal)}.`,
    interp?.benchmark || "",
  ].filter(Boolean)
  sections.push(`1. Resumen general\n\n${resumenParts.join(" ")}`)

  // 2. Riesgos principales
  const altos = interp?.hallazgos.filter((h) => h.prioridad === "Alta") || []
  let riesgosPrincipales = ""
  if (altos.length > 0) {
    riesgosPrincipales = altos
      .map((h) => {
        const impactos = h.impactoPotencial.length > 0 ? ` Los impactos potenciales incluyen: ${h.impactoPotencial.join(", ")}.` : ""
        return `${h.titulo}. ${h.descripcion}${impactos}`
      })
      .join("\n\n")
  }
  if (interp?.factores && interp.factores.length > 0) {
    const factorText = interp.factores
      .filter((f) => f.impacto === "Alto" || f.impacto === "Medio")
      .map((f) => `${f.factor} (Impacto ${f.impacto}): ${f.analisis}`)
      .join(" ")
    riesgosPrincipales += (riesgosPrincipales ? "\n\n" : "") + factorText
  }
  if (!riesgosPrincipales && riesgo.scoreBreakdown.length > 0) {
    const top = [...riesgo.scoreBreakdown].sort((a, b) => b.points - a.points)[0]
    riesgosPrincipales = `El factor de mayor peso es "${top.factor}" (${top.description}). Este indicador define la clasificación de riesgo ${riesgo.nivel} y requiere atención del auditor o veedor.`
  }
  if (!riesgosPrincipales) {
    riesgosPrincipales = "No se identificaron riesgos principales de magnitud crítica en las dimensiones evaluadas."
  }
  sections.push(`2. Riesgos principales\n\n${riesgosPrincipales}`)

  // 3. Riesgos secundarios
  const medios = interp?.hallazgos.filter((h) => h.prioridad === "Media") || []
  const secundarios: string[] = medios.map((h) => `${h.titulo}: ${h.descripcion}`)
  if (riesgo.directos > 0) {
    secundarios.push(
      `Contratación directa: ${riesgo.directos} contrato(s) ejecutados por modalidad directa. Requiere verificación de estudios previos y justificación de la imposibilidad de licitar.`
    )
  }
  if (riesgo.fraccionados > 0) {
    secundarios.push(
      `Fraccionamiento potencial: ${riesgo.fraccionados} contrato(s) con valores inmediatamente inferiores a umbrales legales.`
    )
  }
  if (interp?.concentracion && interp.concentracion.porcentaje >= 40) {
    secundarios.push(interp.concentracion.interpretacion)
  }
  if (interp?.proveedoresRecurrentes && interp.proveedoresRecurrentes.length > 0) {
    secundarios.push(
      "Proveedores recurrentes: " +
      interp.proveedoresRecurrentes.map((p) => `${p.nombre} (${p.apariciones} contratos, ${p.valorAcumulado})`).join("; ") +
      ". " + interp.proveedoresRecurrentes[0].interpretacion
    )
  }
  if (secundarios.length === 0) {
    secundarios.push("Los riesgos secundarios identificados son de magnitud moderada y no alteran la clasificación principal del análisis.")
  }
  sections.push(`3. Riesgos secundarios\n\n${secundarios.join("\n\n")}`)

  // 4. Aspectos positivos
  const positivos: string[] = []
  if (fuentes.cgr === 0) {
    positivos.push(
      "No se identificaron fallos de responsabilidad fiscal activos en las fuentes de Contraloría consultadas. Este es un indicador favorable en la dimensión de control fiscal, aunque no descarta riesgos en otras dimensiones del análisis."
    )
  }
  if (fuentes.sanciones === 0) {
    positivos.push("No se registraron sanciones contractuales en el Registro Nacional de Sanciones para los contratistas analizados en esta consulta.")
  }
  if (riesgo.score < 75) {
    positivos.push(`El score de ${riesgo.score}/100 se mantiene por debajo del umbral de riesgo alto (≥75), lo que indica que no se activan los criterios de intervención inmediata previstos para entidades de alto riesgo.`)
  }
  if (interp?.contratosDestacados && interp.contratosDestacados.length > 0) {
    positivos.push(
      `La distribución contractual incluye ${interp.contratosDestacados.length} contrato(s) de mayor valor identificados, lo que permite focalizar la revisión en los instrumentos de mayor exposición financiera.`
    )
  }
  if (positivos.length === 0) {
    positivos.push("No se identificaron aspectos positivos significativos que compensen las señales de alerta detectadas en el análisis.")
  }
  sections.push(`4. Aspectos positivos\n\n${positivos.join(" ")}`)

  // 5. Prioridades de revisión
  const prioridades: string[] = []
  if (riesgo.recomendaciones.length > 0) {
    riesgo.recomendaciones.forEach((r, i) => prioridades.push(`${i + 1}. ${r}`))
  }
  if (fuentes.procuraduria > 0) {
    prioridades.push(`${prioridades.length + 1}. Validar individualmente los ${fuentes.procuraduria} registro(s) disciplinarios y cruzar con inhabilidades vigentes.`)
  }
  if (riesgo.sinCompetencia > 0) {
    prioridades.push(`${prioridades.length + 1}. Revisar pliegos de condiciones y estudios de mercado de los ${riesgo.sinCompetencia} proceso(s) con un único proponente.`)
  }
  if (interp?.contratosDestacados && interp.contratosDestacados.length > 0) {
    prioridades.push(`${prioridades.length + 1}. Auditar los ${Math.min(5, interp.contratosDestacados.length)} contratos de mayor valor, comenzando por ${interp.contratosDestacados[0].proveedor} (${interp.contratosDestacados[0].valor}).`)
  }
  if (prioridades.length === 0) {
    prioridades.push("1. Monitoreo preventivo periódico de la entidad.\n2. Verificación de actualización de registros en SECOP y fuentes disciplinarias.")
  }
  sections.push(`5. Prioridades de revisión\n\n${prioridades.join("\n")}`)

  // 6. Recomendación final
  const benchmark = interp?.benchmark || `Score ${riesgo.score}/100 — Riesgo ${riesgo.nivel}.`
  const aclaraciones = interp?.aclaraciones?.join(" ") || ""
  let recomendacion = ""
  if (riesgo.score >= 75) {
    recomendacion =
      `Con base en el análisis integral de ${fuentes.total} registros, se recomienda activar un procedimiento de auditoría o veeduría especial sobre "${query}". ${benchmark} ` +
      "Los hallazgos de prioridad alta justifican la asignación de recursos de control interno y, de ser pertinente, la remisión a autoridades competentes (Contraloría, Procuraduría, Fiscalía). " +
      "Se sugiere documentar cada hallazgo con soporte probatorio, incluyendo actas, pliegos, contratos y determinaciones disciplinarias, antes de emitir un dictamen definitivo. " +
      aclaraciones
  } else if (riesgo.score >= 50) {
    recomendacion =
      `La entidad "${query}" requiere revisión focalizada de los factores identificados, sin que ello implique necesariamente la existencia de irregularidades confirmadas. ${benchmark} ` +
      "Como analista de cumplimiento, se recomienda: (a) cruzar registros disciplinarios con inhabilidades vigentes en Procuraduría; (b) validar la competencia en procesos con un solo proponente contrastando con el objeto contractual; (c) verificar la justificación documental de contratos directos; (d) evaluar la concentración de proveedores y la recurrencia de adjudicaciones. " +
      "El auditor debe priorizar los hallazgos de mayor impacto antes de ampliar el alcance de la investigación. " +
      "La metodología aplicada por NeurAudit integra datos de SECOP, fuentes disciplinarias y el motor de riesgo propietario, garantizando trazabilidad de cada conclusión. " +
      aclaraciones
  } else {
    recomendacion =
      `El perfil de riesgo de "${query}" no presenta señales que exijan intervención inmediata. ${benchmark} ` +
      "Se recomienda monitoreo rutinario y repetición del análisis ante cambios significativos en la contratación de la entidad. " +
      aclaraciones
  }
  if (interp?.trazabilidad && interp.trazabilidad.length > 0) {
    recomendacion += " Metodología: " + interp.trazabilidad.join(" ")
  }
  sections.push(`6. Recomendación final\n\n${recomendacion}`)

  return sections.join("\n\n")
}

export async function generateInsights(result: SearchResult): Promise<InsightsResult> {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY

  if (!apiKey) {
    return { conclusionIA: buildDerivedConclusion(result), source: "derived" }
  }

  try {
    const { ChatGoogleGenerativeAI } = await import("@langchain/google-genai")
    const model = new ChatGoogleGenerativeAI({
      model: "gemini-2.5-flash",
      apiKey,
      temperature: 0.4,
      maxRetries: 1,
    })

    const prompt = `Eres un auditor forense y analista de cumplimiento especializado en contratación pública colombiana.
Redacta un INFORME DE CONCLUSIÓN profesional entre 600 y 1200 palabras en español.
Usa EXCLUSIVAMENTE los datos proporcionados. NO inventes cifras ni hechos. NO uses markdown ni bullets con asteriscos.

Estructura obligatoria con estos títulos numerados:
1. Resumen general
2. Riesgos principales
3. Riesgos secundarios
4. Aspectos positivos
5. Prioridades de revisión
6. Recomendación final

Tono: auditor de control interno, analista de cumplimiento, investigador de contratación pública.
NO escribas como chatbot ni asistente genérico. Usa lenguaje institucional y técnico-jurídico colombiano.

Entidad: ${result.query}
Score: ${result.riesgo.score}/100 — Nivel: ${result.riesgo.nivel}
Contratos: ${result.riesgo.totalContratos} | Valor: $${result.riesgo.valorTotal.toLocaleString("es-CO")} COP
Análisis ejecutivo: ${result.interpretacion?.analisisEjecutivo || "N/A"}
Benchmark: ${result.interpretacion?.benchmark || "N/A"}
Factores: ${JSON.stringify(result.riesgo.scoreBreakdown || [])}
Hallazgos enriquecidos: ${JSON.stringify(result.interpretacion?.hallazgos || result.riesgo.hallazgos || [])}
Recomendaciones: ${JSON.stringify(result.riesgo.recomendaciones || [])}
Concentración top 5: ${result.interpretacion?.concentracion?.porcentaje || 0}%
Aclaraciones: ${JSON.stringify(result.interpretacion?.aclaraciones || [])}`

    const response = await model.invoke(prompt)
    const text = typeof response.content === "string" ? response.content : String(response.content)

    if (text.trim().length > 200) {
      return { conclusionIA: text.trim(), source: "gemini" }
    }
  } catch (err) {
    console.error("[Insights] Gemini error:", err)
  }

  return { conclusionIA: buildDerivedConclusion(result), source: "derived" }
}

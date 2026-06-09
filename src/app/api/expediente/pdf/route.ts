export const maxDuration = 300
export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { jsPDF } from "jspdf"
import { runInvestigation } from "@/lib/investigation"
import { generateAnalysis, buildDerivedAnalysis } from "@/lib/analysis"
import { buildExpediente } from "@/lib/expediente"
import { getCachedInvestigation, setCachedInvestigation } from "@/lib/investigation-cache"

function generatePdf(exp: ReturnType<typeof buildExpediente>): Uint8Array {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const margin = 15
  let y = margin
  const pageWidth = doc.internal.pageSize.getWidth()
  const maxWidth = pageWidth - margin * 2
  const sections: string[] = []

  const addLine = (text: string, size = 10, bold = false, color: [number, number, number] = [30, 30, 30]) => {
    doc.setFontSize(size)
    doc.setFont("helvetica", bold ? "bold" : "normal")
    doc.setTextColor(...color)
    const lines = doc.splitTextToSize(text, maxWidth)
    for (const line of lines) {
      if (y > 275) { doc.addPage(); y = margin }
      doc.text(line, margin, y)
      y += size * 0.42 + 2.2
    }
  }

  const addSection = (title: string) => {
    sections.push(title)
    y += 5
    if (y > 260) { doc.addPage(); y = margin }
    doc.setDrawColor(168, 85, 247)
    doc.setLineWidth(0.5)
    doc.line(margin, y, pageWidth - margin, y)
    y += 6
    addLine(title, 12, true, [168, 85, 247])
    y += 2
  }

  // PORTADA
  doc.setFillColor(9, 9, 11)
  doc.rect(0, 0, pageWidth, 297, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(28)
  doc.setFont("helvetica", "bold")
  doc.text("NeurAudit AI", margin, 50)
  doc.setFontSize(14)
  doc.setFont("helvetica", "normal")
  doc.text("Informe Ejecutivo de Auditoría Contractual", margin, 62)
  doc.setFontSize(11)
  y = 85
  ;[
    ["Entidad auditada:", exp.entidad],
    ["Fecha:", exp.fecha],
    ["Clasificación:", exp.clasificacion],
    ["Score:", `${exp.score}/100`],
    ["Nivel:", exp.nivel],
  ].forEach(([l, v]) => {
    doc.setFont("helvetica", "bold")
    doc.text(l, margin, y)
    doc.setFont("helvetica", "normal")
    doc.text(v, margin + 48, y)
    y += 9
  })
  doc.setTextColor(180, 180, 180)
  doc.setFontSize(9)
  doc.text("Motor de Inteligencia Anticorrupción — Colombia", margin, 120)
  doc.setFontSize(8)
  doc.text("Documento confidencial — Uso institucional", margin, 280)

  // ÍNDICE
  doc.addPage()
  y = margin
  doc.setTextColor(30, 30, 30)
  addSection("ÍNDICE")
  const indexItems = [
    "1. Resumen Ejecutivo",
    "2. Metodología",
    "3. Matriz de Riesgos",
    "4. Hallazgos",
    "5. Contratos Relevantes",
    "6. Proveedores y Concentración",
    "7. Análisis IA — Informe Completo",
    "8. Recomendaciones",
    "9. Fuentes y Trazabilidad",
    "10. Firma",
  ]
  indexItems.forEach((item, i) => addLine(`${item}`, 10, false, i % 2 ? [60, 60, 60] : [30, 30, 30]))

  addSection("1. RESUMEN EJECUTIVO")
  addLine(exp.analisisEjecutivo)
  addLine(exp.scoreInterpretacion)
  if (exp.benchmark) addLine(exp.benchmark, 10, false, [80, 80, 80])

  addSection("2. METODOLOGÍA")
  addLine(
    "NeurAudit AI integra 13 fuentes públicas colombianas (SECOP I/II, Contraloría, Procuraduría, SGR, sanciones, procesos de licitación) con el motor de riesgo propietario y el analista IA basado en Gemini 2.5 Flash (Google ADK). El score de 0-100 resulta de factores documentados: concentración, contratación directa, antecedentes CGR, sanciones, Procuraduría, baja competencia, volumen y fraccionamiento."
  )
  exp.trazabilidad.forEach((t, i) => addLine(`${i + 1}. ${t}`, 9))

  addSection("3. MATRIZ DE RIESGOS")
  addLine(`Score total: ${exp.score}/100 — ${exp.clasificacion}`, 11, true)
  exp.factores.forEach((f, i) => {
    addLine(`${i + 1}. ${f.factor} — Impacto ${f.impacto}`, 10, true)
    addLine(f.analisis, 9)
  })
  exp.metricas.forEach((m) => {
    addLine(`${m.label}: ${m.value}`, 10)
    if (m.nota) addLine(m.nota, 9, false, [100, 100, 100])
  })

  addSection("4. HALLAZGOS")
  exp.hallazgos.forEach((h, i) => {
    addLine(`Hallazgo #${i + 1}: ${h.titulo} [${h.prioridad}]`, 10, true)
    addLine(h.descripcion, 9)
    if (h.impactoPotencial.length) addLine(`Impacto: ${h.impactoPotencial.join("; ")}`, 9, false, [80, 80, 80])
  })
  exp.aclaraciones.forEach((a, i) => addLine(`Aclaración ${i + 1}: ${a}`, 9))

  addSection("5. CONTRATOS RELEVANTES")
  exp.contratosDestacados.forEach((c, i) => {
    addLine(`#${i + 1} ${c.proveedor} | ${c.valor}`, 10, true)
    addLine(`${c.entidad} — ${c.motivo}`, 9)
  })

  addSection("6. PROVEEDORES Y CONCENTRACIÓN")
  addLine(`Concentración Top 5: ${exp.concentracion.porcentaje}%`, 10, true)
  addLine(exp.concentracion.interpretacion)
  exp.proveedoresRecurrentes.forEach((p) => {
    addLine(`${p.nombre}: ${p.apariciones} ctr · ${p.valor}`, 9)
    addLine(p.interpretacion, 9, false, [80, 80, 80])
  })

  addSection("7. ANÁLISIS IA — INFORME COMPLETO")
  addLine(`Fuente: ${exp.analistaIA.source || "NeurAudit ADK"}`, 9, false, [100, 100, 100])
  const iaSections: [string, string][] = [
    ["Resumen Ejecutivo", exp.analistaIA.resumenEjecutivo],
    ["Evaluación de Riesgo", exp.analistaIA.evaluacionRiesgo],
    ["Hallazgos Críticos", exp.analistaIA.hallazgosCriticos],
    ["Evaluación de Contratación", exp.analistaIA.evaluacionContratacion],
    ["Riesgo de Concentración", exp.analistaIA.riesgoConcentracion],
    ["Riesgo Disciplinario", exp.analistaIA.riesgoDisciplinario],
    ["Riesgo Fiscal", exp.analistaIA.riesgoFiscal],
    ["Recomendaciones", exp.analistaIA.recomendaciones],
    ["Conclusión", exp.analistaIA.conclusion],
  ]
  iaSections.forEach(([title, content]) => {
    if (content) {
      addLine(title, 11, true)
      addLine(content, 9)
      y += 2
    }
  })

  addSection("8. RECOMENDACIONES (MOTOR DE RIESGO)")
  exp.recomendaciones.forEach((r, i) => addLine(`${i + 1}. ${r}`, 10))

  addSection("9. FUENTES")
  addLine("SECOP I/II, Contraloría (CGR), Procuraduría, SGR Regalías, Registro de Sanciones, Procesos de Licitación, Datos Abiertos Colombia (datos.gov.co).")

  addSection("10. FIRMA AUTOMÁTICA")
  addLine("Elaborado por:", 10, true)
  addLine("NeurAudit AI", 14, true, [168, 85, 247])
  addLine("Motor de Inteligencia Anticorrupción", 10)
  addLine(`Fecha de generación: ${exp.fecha}`, 9, false, [100, 100, 100])
  addLine("Este informe se basa exclusivamente en datos públicos consultados en la fecha indicada.", 8, false, [120, 120, 120])

  return doc.output("arraybuffer") as unknown as Uint8Array
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get("q") || ""
  if (!query) return NextResponse.json({ error: "Se requiere parámetro q" }, { status: 400 })

  try {
    let result = getCachedInvestigation(query)
    if (!result) {
      result = await runInvestigation(query)
      setCachedInvestigation(query, result)
    }

    let analysis = result.analisisIA
    if (!analysis) {
      try {
        analysis = await generateAnalysis(result)
      } catch {
        analysis = buildDerivedAnalysis(result)
      }
    }

    const fullResult = { ...result, analisisIA: analysis }
    const expediente = buildExpediente(fullResult)
    const pdfBytes = generatePdf(expediente)
    const filename = `expediente-neuraudit-${query.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}.pdf`

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error("[Expediente PDF]", err)
    return NextResponse.json({ error: "Error generando expediente PDF" }, { status: 500 })
  }
}

#!/usr/bin/env node
/**
 * Validación técnica Fase 22 — ejecución real, sin asumir.
 * Uso: node scripts/phase22-validate.mjs [--base http://127.0.0.1:3000]
 */
import { writeFileSync } from "fs"

const BASE = process.argv.find((a) => a.startsWith("--base="))?.split("=")[1] || "http://127.0.0.1:3000"
const ENTITIES = ["UNGRD", "ICBF", "Ministerio de Salud", "Alcaldía de Bogotá"]

async function timedFetch(url, opts = {}) {
  const start = performance.now()
  const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(300000) })
  const ms = Math.round(performance.now() - start)
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    json = { _raw: text.slice(0, 500) }
  }
  return { ok: res.ok, status: res.status, ms, json }
}

async function testDatosGovPagination() {
  const url =
    "https://www.datos.gov.co/resource/jbjy-vk9h.json?$limit=500&$offset=0&$where=" +
    encodeURIComponent("upper(nombre_entidad) like '%ICBF%'")
  const r = await timedFetch(url)
  const records = Array.isArray(r.json) ? r.json.length : 0
  const page2url =
    "https://www.datos.gov.co/resource/jbjy-vk9h.json?$limit=500&$offset=500&$where=" +
    encodeURIComponent("upper(nombre_entidad) like '%ICBF%'")
  const r2 = await timedFetch(page2url)
  const records2 = Array.isArray(r2.json) ? r2.json.length : 0
  return {
    test: "datos.gov.co_pagination",
    page1: { records, ms: r.ms, ok: r.ok },
    page2: { records: records2, ms: r2.ms, ok: r2.ok },
    paginationWorks: r.ok && records > 0,
  }
}

async function investigateEntity(q, nocache = false) {
  const url = `${BASE}/api/agent/search?q=${encodeURIComponent(q)}${nocache ? "&nocache=true" : ""}`
  const r = await timedFetch(url)
  const d = r.json
  return {
    query: q,
    nocache,
    httpStatus: r.status,
    ms: r.ms,
    ok: r.ok,
    score: d?.riesgo?.score,
    nivel: d?.riesgo?.nivel,
    totalRegistros: d?.fuentes?.total,
    fuentes: d?.fuentes,
    meta: d?.meta,
    cached: d?.meta?.cached ?? false,
    fuentesTraceCount: d?.fuentesTrace?.length ?? 0,
    fuentesTraceSummary: (d?.fuentesTrace || []).map((t) => ({
      id: t.id,
      status: t.status,
      records: t.records,
      pages: t.pages,
      durationMs: t.durationMs,
    })),
    scoreExplainability: d?.scoreExplainability
      ? {
          scoreFinal: d.scoreExplainability.scoreFinal,
          reglasActivas: d.scoreExplainability.reglasActivas,
          totalReglas: d.scoreExplainability.totalReglas,
          sumaPuntos: d.scoreExplainability.sumaPuntos,
          factoresAplicados: d.scoreExplainability.factoresAplicados?.map((f) => f.factor),
        }
      : null,
    trazabilidadLines: d?.interpretacion?.trazabilidad?.length ?? 0,
  }
}

async function testAnalysis(q, label) {
  const search = await timedFetch(`${BASE}/api/agent/search?q=${encodeURIComponent(q)}`)
  if (!search.ok) return { label, error: "search failed", status: search.status }
  const r = await timedFetch(`${BASE}/api/agent/analysis`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(search.json),
  })
  return {
    label,
    ms: r.ms,
    source: r.json?.analisisIA?.source || r.json?.source,
    hasConclusion: !!(r.json?.conclusionIA || r.json?.analisisIA?.conclusion),
    engine: r.json?.analisisIA?.meta?.engine,
    geminiConnected: r.json?.analisisIA?.meta?.geminiConnected,
  }
}

async function main() {
  const report = {
    timestamp: new Date().toISOString(),
    base: BASE,
    tests: {},
  }

  console.log("=== Phase 22 Validation ===\n")

  // System status
  report.tests.systemStatus = await timedFetch(`${BASE}/api/system/status`)
  console.log("system/status:", report.tests.systemStatus.ms, "ms")

  // datos.gov.co direct
  report.tests.datosGov = await testDatosGovPagination()
  console.log("datos.gov.co pagination:", report.tests.datosGov)

  // Entity investigations (nocache first time)
  report.tests.entities = []
  for (const q of ENTITIES) {
    const r = await investigateEntity(q, true)
    report.tests.entities.push(r)
    console.log(`entity ${q}: ${r.ms}ms score=${r.score} records=${r.totalRegistros}`)
  }

  // Cache test with ICBF
  const cacheQuery = "ICBF"
  report.tests.cache = {}
  report.tests.cache.first = await investigateEntity(cacheQuery, true)
  report.tests.cache.second = await investigateEntity(cacheQuery, false)
  report.tests.cache.nocache = await investigateEntity(cacheQuery, true)
  report.tests.cache.speedup =
    report.tests.cache.first.ms > 0
      ? Math.round((1 - report.tests.cache.second.ms / report.tests.cache.first.ms) * 100)
      : 0
  console.log(
    `cache ICBF: first=${report.tests.cache.first.ms}ms second=${report.tests.cache.second.ms}ms cached=${report.tests.cache.second.cached}`
  )

  // Analysis pipeline (ADK expected if running)
  report.tests.analysis = await testAnalysis("ICBF", "adk_gemini_fallback")
  console.log("analysis:", report.tests.analysis)

  const outPath = new URL("../docs/phase22-validation-raw.json", import.meta.url).pathname
  writeFileSync(outPath, JSON.stringify(report, null, 2))
  console.log("\nRaw JSON:", outPath)
  return report
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

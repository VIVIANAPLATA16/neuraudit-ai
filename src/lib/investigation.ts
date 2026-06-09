import { fetchPaginatedSource } from "./datos-fetcher"
import type { SourceTraceEntry } from "./types"
import { calcularRiesgo } from "./risk-engine"
import { buildInterpretacion } from "./interpretation"
import { buildInvestigationAnalytics } from "./data-analytics"
import { buildScoreExplainability } from "./score-explainability"
import type { InvestigationMeta } from "./types"
import { normalizeSearchTerm, whereFromFields } from "./search-normalize"
import { getFetchConcurrency, runWithConcurrency } from "./fetch-pool"

interface SourceConfig {
  id: string
  name: string
  dataset: string
  baseUrl: string
  fields: string[]
}

const SOURCE_CONFIGS: SourceConfig[] = [
  {
    id: "secopII",
    name: "SECOP II Contratos",
    dataset: "jbjy-vk9h",
    baseUrl: "https://www.datos.gov.co/resource/jbjy-vk9h.json",
    fields: ["nombre_entidad", "proveedor_adjudicado"],
  },
  {
    id: "secopI",
    name: "SECOP I Contratos",
    dataset: "f789-7hwg",
    baseUrl: "https://www.datos.gov.co/resource/f789-7hwg.json",
    fields: ["nombre_entidad", "descripcion_del_proceso"],
  },
  {
    id: "secopIalt",
    name: "SECOP I Alternativo",
    dataset: "rpmr-utcd",
    baseUrl: "https://www.datos.gov.co/resource/rpmr-utcd.json",
    fields: ["nombre_de_la_entidad"],
  },
  {
    id: "procesos",
    name: "Procesos de Contratación",
    dataset: "p6dx-8zbt",
    baseUrl: "https://www.datos.gov.co/resource/p6dx-8zbt.json",
    fields: ["entidad", "nombre_del_proveedor"],
  },
  {
    id: "ejecucion",
    name: "Ejecución Contractual",
    dataset: "mfmm-jqmq",
    baseUrl: "https://www.datos.gov.co/resource/mfmm-jqmq.json",
    fields: ["proveedor_adjudicado", "nombre_entidad"],
  },
  {
    id: "cgr",
    name: "Responsabilidad Fiscal CGR",
    dataset: "jr8e-e8tu",
    baseUrl: "https://www.datos.gov.co/resource/jr8e-e8tu.json",
    fields: ["raz_n_social_de_la_entidad"],
  },
  {
    id: "sanciones",
    name: "Sanciones Contractuales",
    dataset: "4n4q-k399",
    baseUrl: "https://www.datos.gov.co/resource/4n4q-k399.json",
    fields: ["nombre_contratista", "nombre_entidad"],
  },
  {
    id: "contadores",
    name: "Contadores Sancionados",
    dataset: "fs36-azrv",
    baseUrl: "https://www.datos.gov.co/resource/fs36-azrv.json",
    fields: ["contador"],
  },
  {
    id: "procuraduria",
    name: "Relatoría Procuraduría",
    dataset: "rhun-uf37",
    baseUrl: "https://www.datos.gov.co/resource/rhun-uf37.json",
    fields: ["tema", "subtema"],
  },
  {
    id: "sgrGastos",
    name: "SGR Gastos",
    dataset: "wtyw-nhcv",
    baseUrl: "https://www.datos.gov.co/resource/wtyw-nhcv.json",
    fields: ["nombrechip"],
  },
  {
    id: "sgrProgGastos",
    name: "SGR Programación Gastos",
    dataset: "xr2w-9eg2",
    baseUrl: "https://www.datos.gov.co/resource/xr2w-9eg2.json",
    fields: ["nombre_entidad"],
  },
  {
    id: "sgrEjecIng",
    name: "SGR Ejecución Ingresos",
    dataset: "28y9-jj6s",
    baseUrl: "https://www.datos.gov.co/resource/28y9-jj6s.json",
    fields: ["nombre_entidad"],
  },
  {
    id: "sgrProgIng",
    name: "SGR Programación Ingresos",
    dataset: "5ka2-and2",
    baseUrl: "https://www.datos.gov.co/resource/5ka2-and2.json",
    fields: ["nombre_entidad"],
  },
]

function buildInvestigationMeta(
  trace: SourceTraceEntry[],
  durationMs: number,
  concurrency: number
): InvestigationMeta {
  return {
    fuentesConsultadas: trace.length,
    fuentesExitosas: trace.filter((t) => t.status === "success").length,
    fuentesConError: trace.filter((t) => t.status === "error").length,
    fuentesVacias: trace.filter((t) => t.status === "empty").length,
    fuentesTimeout: trace.filter((t) => t.status === "timeout").length,
    fuentesParciales: trace.filter((t) => t.status === "partial").length,
    fetchConcurrency: concurrency,
    duracionTotalMs: durationMs,
  }
}

export async function runInvestigation(query: string) {
  const start = Date.now()
  const variants = normalizeSearchTerm(query)
  const concurrency = getFetchConcurrency()

  const tasks = SOURCE_CONFIGS.map((cfg) => () => {
    const whereClause = whereFromFields(cfg.fields, variants)
    return fetchPaginatedSource(cfg.id, cfg.name, cfg.dataset, cfg.baseUrl, whereClause)
  })

  const results = await runWithConcurrency(tasks, concurrency)

  const byId = Object.fromEntries(SOURCE_CONFIGS.map((cfg, i) => [cfg.id, results[i]]))
  const fuentesTrace = results.map((r) => r.trace)

  const secopII = byId.secopII.data
  const secopI = byId.secopI.data
  const secopIalt = byId.secopIalt.data
  const procesos = byId.procesos.data
  const ejecucion = byId.ejecucion.data
  const cgr = byId.cgr.data
  const sanciones = byId.sanciones.data
  const contadores = byId.contadores.data
  const procuraduria = byId.procuraduria.data
  const sgr = [
    ...byId.sgrGastos.data,
    ...byId.sgrProgGastos.data,
    ...byId.sgrEjecIng.data,
    ...byId.sgrProgIng.data,
  ]

  const contratos = [...secopII, ...secopI, ...secopIalt]
  const riesgo = calcularRiesgo({ contratos, procesos, cgr, sanciones, contadores, procuraduria, sgr })
  const scoreExplainability = buildScoreExplainability(riesgo)
  const totalRegistros = fuentesTrace.reduce((acc, t) => acc + t.records, 0)

  const payload = {
    query,
    timestamp: new Date().toISOString(),
    fuentes: {
      secopII: secopII.length,
      secopI: secopI.length + secopIalt.length,
      procesos: procesos.length,
      ejecucion: ejecucion.length,
      cgr: cgr.length,
      sanciones: sanciones.length,
      contadores: contadores.length,
      procuraduria: procuraduria.length,
      sgr: sgr.length,
      total: totalRegistros,
    },
    fuentesTrace,
    scoreExplainability,
    meta: buildInvestigationMeta(fuentesTrace, Date.now() - start, concurrency),
    riesgo,
    contratos: contratos.slice(0, 20),
    procesosLicitacion: procesos.slice(0, 10),
    ejecucionContratos: ejecucion.slice(0, 10),
    fallosResponsabilidadFiscal: cgr,
    sancionesContractuales: sanciones,
    sancionesProfesionales: contadores,
    registrosProcuraduria: procuraduria,
    regaliasSGR: sgr.slice(0, 10),
  }

  const interpretacion = buildInterpretacion({
    query,
    riesgo,
    fuentes: payload.fuentes,
    fuentesTrace,
    contratos,
    timestamp: payload.timestamp,
  })

  return {
    ...payload,
    interpretacion,
    analytics: buildInvestigationAnalytics({ ...payload, interpretacion }) as unknown as Record<string, unknown>,
  }
}

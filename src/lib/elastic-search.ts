import { Client } from "@elastic/elasticsearch"
import type { ElasticContractHit, ElasticInsights, HallazgoEnriquecido, SourceTraceEntry } from "./types"
import { formatCOP } from "./utils"

const INDEX = "secop-contratos"
const REQUEST_TIMEOUT_MS = 8000

let cachedClient: Client | null = null

export function isElasticConfigured(): boolean {
  return !!(process.env.ELASTIC_ENDPOINT?.trim() && process.env.ELASTIC_API_KEY?.trim())
}

function getElasticClient(): Client | null {
  if (!isElasticConfigured()) return null
  if (!cachedClient) {
    cachedClient = new Client({
      node: process.env.ELASTIC_ENDPOINT!.trim(),
      auth: { apiKey: process.env.ELASTIC_API_KEY!.trim() },
      requestTimeout: REQUEST_TIMEOUT_MS,
    })
  }
  return cachedClient
}

function buildElasticAlertas(hits: ElasticContractHit[], totalHits: number): string[] {
  const alertas: string[] = []
  if (totalHits === 0) return alertas

  alertas.push(
    `${totalHits} contrato(s) SECOP indexados coinciden semánticamente con la consulta (índice ${INDEX}).`
  )

  const highValue = hits.filter((h) => h.valor >= 1_000_000_000)
  if (highValue.length > 0) {
    alertas.push(
      `${highValue.length} contrato(s) indexado(s) superan $1.000 millones COP según búsqueda semántica Elastic.`
    )
  }

  const byContractor = new Map<string, number>()
  for (const hit of hits) {
    if (hit.contratista) {
      byContractor.set(hit.contratista, (byContractor.get(hit.contratista) || 0) + 1)
    }
  }
  const recurrent = [...byContractor.entries()].filter(([, count]) => count >= 2)
  if (recurrent.length > 0) {
    alertas.push(
      `Elastic detecta contratistas recurrentes en top hits: ${recurrent
        .map(([name, count]) => `${name} (${count})`)
        .join(", ")}.`
    )
  }

  return alertas
}

function mapHit(hit: { _source?: unknown; _score?: number | null }): ElasticContractHit {
  const src = (hit._source || {}) as Record<string, unknown>
  return {
    entidad: String(src.entidad || ""),
    contratista: String(src.contratista || ""),
    objeto: String(src.objeto || ""),
    valor: Number(src.valor) || 0,
    modalidad: String(src.modalidad || ""),
    fechaFirma: src.fecha_firma ? String(src.fecha_firma) : null,
    estado: String(src.estado || ""),
    departamento: String(src.departamento || ""),
    score: hit._score ?? 0,
  }
}

export async function searchElasticSecop(
  query: string,
  searchTerms: string[]
): Promise<ElasticInsights> {
  const start = Date.now()
  const empty: ElasticInsights = {
    status: "skipped",
    index: INDEX,
    query,
    totalHits: 0,
    durationMs: 0,
    topContratos: [],
    alertas: [],
    valorTotalIndexado: 0,
  }

  const { isElasticMcpConfigured, searchViaElasticMcp } = await import("./elastic-mcp-client")
  if (isElasticMcpConfigured()) {
    const mcpResult = await searchViaElasticMcp(query, searchTerms)
    if (mcpResult?.status === "ok") return mcpResult
    if (mcpResult?.status === "error") {
      console.warn("[Elastic] MCP failed, falling back to SDK:", mcpResult.message)
    }
  }

  const client = getElasticClient()
  if (!client) {
    return {
      ...empty,
      message: "Elastic no configurado (ELASTIC_ENDPOINT / ELASTIC_API_KEY ausentes)",
      durationMs: Date.now() - start,
    }
  }

  try {
    const terms = [...new Set([query, ...searchTerms].map((t) => t.trim()).filter(Boolean))]

    const response = await client.search({
      index: INDEX,
      size: 20,
      timeout: "5s",
      query: {
        bool: {
          should: terms.map((term) => ({
            multi_match: {
              query: term,
              fields: ["entidad^3", "contratista^2", "objeto", "texto_completo"],
              type: "best_fields",
              fuzziness: "AUTO",
            },
          })),
          minimum_should_match: 1,
        },
      },
    })

    const hits = response.hits.hits
    const totalHits =
      typeof response.hits.total === "number"
        ? response.hits.total
        : (response.hits.total?.value ?? 0)

    const topContratos = hits.map(mapHit)
    const valorTotalIndexado = topContratos.reduce((sum, c) => sum + c.valor, 0)
    const alertas = buildElasticAlertas(topContratos, totalHits)

    return {
      status: "ok",
      index: INDEX,
      query,
      totalHits,
      durationMs: Date.now() - start,
      topContratos,
      alertas,
      valorTotalIndexado,
      retrievalMethod: "elasticsearch-sdk",
    }
  } catch (err) {
    console.error("[Elastic] search error:", err)
    return {
      ...empty,
      status: "error",
      message: err instanceof Error ? err.message : "Error consultando Elasticsearch",
      durationMs: Date.now() - start,
    }
  }
}

export function elasticInsightsToHallazgos(insights: ElasticInsights): HallazgoEnriquecido[] {
  if (insights.status !== "ok" || insights.totalHits === 0) return []

  const hallazgos: HallazgoEnriquecido[] = [
    {
      titulo: "Búsqueda semántica Elasticsearch (SECOP)",
      descripcion: `El índice ${insights.index} devolvió ${insights.totalHits} contrato(s) relacionados con "${insights.query}". Valor agregado en top hits: ${formatCOP(insights.valorTotalIndexado)}.`,
      impactoPotencial: [
        "Cruce semántico de texto libre en contratos SECOP",
        "Detección de patrones no capturados solo por filtros exactos",
      ],
      prioridad: insights.totalHits > 10 ? "Alta" : "Media",
    },
  ]

  const top = insights.topContratos[0]
  if (top?.entidad) {
    hallazgos.push({
      titulo: `Contrato destacado (Elastic): ${top.entidad}`,
      descripcion: `${top.contratista || "Contratista no identificado"} — ${top.objeto.slice(0, 280) || "Sin objeto"}. Valor indexado: ${formatCOP(top.valor)}. Modalidad: ${top.modalidad || "N/D"}.`,
      impactoPotencial: ["Priorización de revisión documental", "Validación de modalidad y competencia"],
      prioridad: top.valor >= 500_000_000 ? "Alta" : "Media",
    })
  }

  for (const alerta of insights.alertas.slice(0, 2)) {
    hallazgos.push({
      titulo: "Alerta Elasticsearch",
      descripcion: alerta,
      impactoPotencial: ["Señal complementaria de riesgo contractual"],
      prioridad: "Media",
    })
  }

  return hallazgos
}

export function buildElasticTrace(insights: ElasticInsights): SourceTraceEntry {
  let status: SourceTraceEntry["status"] = "error"
  if (insights.status === "ok") {
    status = insights.totalHits > 0 ? "success" : "empty"
  } else if (insights.status === "skipped") {
    status = "empty"
  }

  return {
    id: "elastic",
    name: "Elasticsearch SECOP",
    dataset: INDEX,
    status,
    records: insights.totalHits,
    pages: 1,
    durationMs: insights.durationMs,
    message: insights.message,
  }
}

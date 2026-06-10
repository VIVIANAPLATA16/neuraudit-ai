import type { ElasticContractHit, ElasticInsights } from "./types"

const REQUEST_TIMEOUT_MS = 10000

export function resolveElasticMcpUrl(): string | null {
  const explicit = process.env.ELASTIC_MCP_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, "")

  const kibana = process.env.ELASTIC_KIBANA_URL?.trim().replace(/\/$/, "")
  if (kibana) return `${kibana}/api/agent_builder/mcp`

  return null
}

export function resolveElasticMcpApiKey(): string | null {
  const key =
    process.env.ELASTIC_MCP_API_KEY?.trim() ||
    process.env.ELASTIC_API_KEY?.trim() ||
    ""
  return key || null
}

export function isElasticMcpConfigured(): boolean {
  return !!(resolveElasticMcpUrl() && resolveElasticMcpApiKey())
}

async function mcpRequest<T>(
  method: string,
  params: Record<string, unknown> = {}
): Promise<T | null> {
  const url = resolveElasticMcpUrl()
  const apiKey = resolveElasticMcpApiKey()
  if (!url || !apiKey) return null

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `ApiKey ${apiKey}`,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    })
    if (!res.ok) return null
    const data = (await res.json()) as { result?: T; error?: { message?: string } }
    if (data.error) return null
    return data.result ?? null
  } catch {
    return null
  }
}

export async function listElasticMcpTools(): Promise<string[]> {
  const result = await mcpRequest<{ tools?: { name?: string }[] }>("tools/list", {})
  if (!result?.tools) return []
  return result.tools.map((t) => t.name || "").filter(Boolean)
}

export async function probeElasticMcp(): Promise<{
  configured: boolean
  reachable: boolean
  tools: string[]
}> {
  if (!isElasticMcpConfigured()) {
    return { configured: false, reachable: false, tools: [] }
  }
  const tools = await listElasticMcpTools()
  return { configured: true, reachable: tools.length > 0, tools }
}

function parseMcpSearchText(text: string): { hits: ElasticContractHit[]; totalHits: number } {
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>
    const hitsRaw = (parsed.hits as { hits?: unknown[] })?.hits || parsed.results || []
    if (!Array.isArray(hitsRaw)) return { hits: [], totalHits: 0 }

    const hits: ElasticContractHit[] = hitsRaw.slice(0, 20).map((h) => {
      const row = h as { _source?: Record<string, unknown>; _score?: number }
      const src = row._source || {}
      return {
        entidad: String(src.entidad || ""),
        contratista: String(src.contratista || ""),
        objeto: String(src.objeto || ""),
        valor: Number(src.valor) || 0,
        modalidad: String(src.modalidad || ""),
        fechaFirma: src.fecha_firma ? String(src.fecha_firma) : null,
        estado: String(src.estado || ""),
        departamento: String(src.departamento || ""),
        score: row._score ?? 0,
      }
    })
    const total =
      typeof (parsed.hits as { total?: { value?: number } | number })?.total === "object"
        ? ((parsed.hits as { total?: { value?: number } }).total?.value ?? hits.length)
        : Number((parsed.hits as { total?: number })?.total) || hits.length
    return { hits, totalHits: total }
  } catch {
    return { hits: [], totalHits: text.length > 50 ? 1 : 0 }
  }
}

export async function searchViaElasticMcp(
  query: string,
  searchTerms: string[]
): Promise<ElasticInsights | null> {
  const start = Date.now()
  const url = resolveElasticMcpUrl()
  if (!url) return null

  const tools = await listElasticMcpTools()
  const searchTool =
    tools.find((t) => /search|semantic/i.test(t)) ||
    tools.find((t) => t === "search") ||
    tools[0]

  if (!searchTool) {
    return {
      status: "error",
      index: "elastic-mcp",
      query,
      totalHits: 0,
      durationMs: Date.now() - start,
      topContratos: [],
      alertas: [],
      valorTotalIndexado: 0,
      retrievalMethod: "elastic-agent-builder-mcp",
      mcpTool: null,
      message: "Elastic MCP reachable but no tools listed",
    }
  }

  const terms = [...new Set([query, ...searchTerms].filter(Boolean))]
  const result = await mcpRequest<{ content?: { type: string; text?: string }[] }>("tools/call", {
    name: searchTool,
    arguments: {
      query: terms.join(" "),
      index: process.env.ELASTIC_MCP_INDEX || "secop-contratos",
      q: terms.join(" "),
    },
  })

  const text = result?.content?.find((c) => c.type === "text")?.text || ""
  const { hits, totalHits } = parseMcpSearchText(text)
  const valorTotalIndexado = hits.reduce((s, h) => s + h.valor, 0)

  return {
    status: totalHits > 0 || text.length > 0 ? "ok" : "error",
    index: process.env.ELASTIC_MCP_INDEX || "secop-contratos",
    query,
    totalHits: totalHits || (text ? 1 : 0),
    durationMs: Date.now() - start,
    topContratos: hits,
    alertas:
      totalHits > 0
        ? [`Elastic MCP (${searchTool}): ${totalHits} resultado(s) para "${query}".`]
        : [],
    valorTotalIndexado,
    retrievalMethod: "elastic-agent-builder-mcp",
    mcpTool: searchTool,
    message: totalHits > 0 ? undefined : "Elastic MCP tool returned no structured hits",
  }
}

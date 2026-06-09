/**
 * Cliente Socrata (datos.gov.co) con paginación, reintentos y estado por fuente.
 * F22.2 + F22.3 — sin cambios de UI.
 */

import type { SourceStatus, SourceTraceEntry } from "./types"

export type { SourceStatus, SourceTraceEntry }

export interface SourceFetchResult {
  data: Record<string, unknown>[]
  trace: SourceTraceEntry
}

const PAGE_SIZE = 500
const MAX_RECORDS = 10_000
const FETCH_TIMEOUT_MS = 20_000
const MAX_RETRIES = 3
const RETRY_BASE_MS = 800

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function backoffWithJitter(attempt: number): number {
  const exp = RETRY_BASE_MS * Math.pow(2, attempt)
  const jitter = Math.random() * RETRY_BASE_MS
  return Math.min(exp + jitter, 15_000)
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 503 || status === 502 || status >= 500
}

function finalizeStatus(
  rawStatus: SourceStatus,
  recordCount: number,
  message?: string
): { status: SourceStatus; message?: string } {
  if (rawStatus === "timeout" && recordCount > 0) {
    return {
      status: "partial",
      message: message || `Datos parciales: ${recordCount} registro(s) antes de timeout`,
    }
  }
  if (rawStatus === "error" && recordCount > 0) {
    return {
      status: "partial",
      message: message || `Datos parciales: ${recordCount} registro(s) antes de error`,
    }
  }
  if (rawStatus === "success" && recordCount === 0) {
    return { status: "empty", message: "Consulta exitosa sin registros coincidentes" }
  }
  return { status: rawStatus, message }
}

async function fetchPage(url: string): Promise<{
  ok: boolean
  data?: Record<string, unknown>[]
  errorStatus?: SourceStatus
  message?: string
  retryable?: boolean
}> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (!res.ok) {
      return {
        ok: false,
        errorStatus: "error",
        message: `HTTP ${res.status} ${res.statusText}`,
        retryable: isRetryableStatus(res.status),
      }
    }

    const page = (await res.json()) as Record<string, unknown>[]
    return { ok: true, data: Array.isArray(page) ? page : [] }
  } catch (err) {
    clearTimeout(timer)
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, errorStatus: "timeout", message: `Timeout tras ${FETCH_TIMEOUT_MS}ms` }
    }
    return {
      ok: false,
      errorStatus: "error",
      message: err instanceof Error ? err.message : "Error de red",
      retryable: true,
    }
  }
}

async function fetchPageWithRetry(url: string): Promise<{
  ok: boolean
  data?: Record<string, unknown>[]
  errorStatus?: SourceStatus
  message?: string
}> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const result = await fetchPage(url)
    if (result.ok) return result

    if (result.retryable && attempt < MAX_RETRIES) {
      await sleep(backoffWithJitter(attempt))
      continue
    }
    return result
  }
  return { ok: false, errorStatus: "error", message: "Reintentos agotados" }
}

export async function fetchPaginatedSource(
  id: string,
  name: string,
  dataset: string,
  baseUrl: string,
  whereClause: string
): Promise<SourceFetchResult> {
  const start = Date.now()
  const all: Record<string, unknown>[] = []
  let offset = 0
  let pages = 0
  let rawStatus: SourceStatus = "success"
  let message: string | undefined

  try {
    while (offset < MAX_RECORDS) {
      const url =
        `${baseUrl}?$limit=${PAGE_SIZE}&$offset=${offset}&$where=${encodeURIComponent(whereClause)}`

      const pageResult = await fetchPageWithRetry(url)

      if (!pageResult.ok) {
        rawStatus = pageResult.errorStatus || "error"
        message =
          pages > 0
            ? `${pageResult.message} (página ${pages + 1}, ${all.length} registro(s) acumulados)`
            : pageResult.message
        break
      }

      const page = pageResult.data || []
      pages++

      if (page.length === 0) break

      all.push(...page)
      offset += page.length

      if (page.length < PAGE_SIZE) break
    }
  } catch (err) {
    rawStatus = "error"
    message = err instanceof Error ? err.message : "Error desconocido"
  }

  const { status, message: finalMessage } = finalizeStatus(rawStatus, all.length, message)

  return {
    data: all,
    trace: {
      id,
      name,
      dataset,
      status,
      records: all.length,
      pages,
      durationMs: Date.now() - start,
      message: finalMessage,
    },
  }
}

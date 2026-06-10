export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"

const AWS_CSV_API_BASE = (
  process.env.AWS_CSV_API_URL || "https://pqcu3eipqg.execute-api.us-east-1.amazonaws.com"
).replace(/\/$/, "")

const ALLOWED_ACTIONS = new Set(["preview", "filter"])
const UPSTREAM_TIMEOUT_MS = 8000

type DegradedPayload = {
  rows: []
  total_rows: number
  total_matches?: number
  limit: number
  offset: number
  column?: string
  value?: string
  mode?: string
  proxyStatus: "degraded"
  message: string
}

function parseLimit(searchParams: URLSearchParams, fallback = 12): number {
  const raw = Number(searchParams.get("limit") || String(fallback))
  return Number.isFinite(raw) && raw > 0 ? Math.min(raw, 500) : fallback
}

function parseOffset(searchParams: URLSearchParams): number {
  const raw = Number(searchParams.get("offset") || "0")
  return Number.isFinite(raw) && raw >= 0 ? raw : 0
}

function buildDegradedResponse(
  action: string,
  searchParams: URLSearchParams,
  reason: string
): DegradedPayload {
  const limit = parseLimit(searchParams)
  const offset = parseOffset(searchParams)
  const message =
    reason.includes("timeout") || reason.includes("8s")
      ? "La API CSV en AWS tardó más de 8 segundos. Intente de nuevo o use un filtro más específico."
      : `No se pudo consultar la API CSV en AWS (${reason}). Intente de nuevo en unos segundos.`

  const base: DegradedPayload = {
    rows: [],
    total_rows: 0,
    limit,
    offset,
    proxyStatus: "degraded",
    message,
  }

  if (action === "filter") {
    return {
      ...base,
      total_matches: 0,
      column: searchParams.get("column") ?? undefined,
      value: searchParams.get("value") ?? undefined,
      mode: searchParams.get("mode") ?? undefined,
    }
  }

  return base
}

function normalizeSuccessPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const rows = Array.isArray(payload.rows) ? payload.rows : []
  return {
    ...payload,
    rows,
    total_rows: typeof payload.total_rows === "number" ? payload.total_rows : rows.length,
    total_matches:
      typeof payload.total_matches === "number" ? payload.total_matches : undefined,
    proxyStatus: "ok",
  }
}

async function fetchUpstream(
  targetUrl: string,
  signal: AbortSignal
): Promise<{ ok: true; payload: Record<string, unknown> } | { ok: false; reason: string }> {
  const upstream = await fetch(targetUrl, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal,
  })

  const rawText = await upstream.text().catch(() => "")

  let parsed: unknown = null
  if (rawText) {
    try {
      parsed = JSON.parse(rawText)
    } catch {
      return { ok: false, reason: "respuesta JSON inválida desde AWS" }
    }
  }

  if (!upstream.ok) {
    const detail =
      parsed && typeof parsed === "object" && parsed !== null
        ? String((parsed as Record<string, unknown>).detail || (parsed as Record<string, unknown>).message || "")
        : ""
    return {
      ok: false,
      reason: detail ? `HTTP ${upstream.status}: ${detail}` : `HTTP ${upstream.status}`,
    }
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, reason: "formato de respuesta inesperado" }
  }

  const record = parsed as Record<string, unknown>
  if (record.rows !== undefined && !Array.isArray(record.rows)) {
    return { ok: false, reason: "campo rows inválido en respuesta AWS" }
  }

  return { ok: true, payload: normalizeSuccessPayload(record) }
}

export async function GET(
  req: Request,
  context: { params: Promise<{ action: string }> }
) {
  try {
    const { action } = await context.params

    if (!ALLOWED_ACTIONS.has(action)) {
      return NextResponse.json({ error: "Ruta CSV no soportada" }, { status: 404 })
    }

    const { searchParams } = new URL(req.url)
    const targetUrl = `${AWS_CSV_API_BASE}/csv/${action}?${searchParams.toString()}`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)

    try {
      const result = await fetchUpstream(targetUrl, controller.signal)
      clearTimeout(timeoutId)

      if (!result.ok) {
        console.warn("[csv-aws proxy]", action, result.reason, targetUrl)
        return NextResponse.json(
          buildDegradedResponse(action, searchParams, result.reason),
          { status: 200 }
        )
      }

      return NextResponse.json(result.payload, { status: 200 })
    } catch (err) {
      clearTimeout(timeoutId)

      const reason =
        err instanceof DOMException && err.name === "AbortError"
          ? "timeout (8s)"
          : err instanceof Error
            ? err.message
            : "error de red"

      console.warn("[csv-aws proxy]", action, reason, targetUrl)
      return NextResponse.json(buildDegradedResponse(action, searchParams, reason), {
        status: 200,
      })
    }
  } catch (err) {
    console.error("[csv-aws proxy] unexpected", err)
    const { searchParams } = new URL(req.url)
    const action = (await context.params).action
    return NextResponse.json(
      buildDegradedResponse(
        action,
        searchParams,
        err instanceof Error ? err.message : "error interno del proxy"
      ),
      { status: 200 }
    )
  }
}

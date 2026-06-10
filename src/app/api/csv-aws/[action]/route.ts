export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"

const AWS_CSV_API_BASE = (
  process.env.AWS_CSV_API_URL || "https://pqcu3eipqg.execute-api.us-east-1.amazonaws.com"
).replace(/\/$/, "")

const ALLOWED_ACTIONS = new Set(["preview", "filter"])

export async function GET(
  req: Request,
  context: { params: Promise<{ action: string }> }
) {
  const { action } = await context.params

  if (!ALLOWED_ACTIONS.has(action)) {
    return NextResponse.json({ error: "Ruta CSV no soportada" }, { status: 404 })
  }

  const { searchParams } = new URL(req.url)
  const targetUrl = `${AWS_CSV_API_BASE}/csv/${action}?${searchParams.toString()}`

  try {
    const upstream = await fetch(targetUrl, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    })

    const payload = await upstream.json().catch(() => null)

    if (!upstream.ok) {
      return NextResponse.json(
        payload ?? { error: "Error consultando API CSV en AWS" },
        { status: upstream.status }
      )
    }

    return NextResponse.json(payload)
  } catch (err) {
    console.error("[csv-aws proxy]", action, err)
    return NextResponse.json(
      {
        error: "Proxy CSV AWS no disponible",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 502 }
    )
  }
}

export const maxDuration = 120
export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { invokeAdkAgentChat, shouldSkipAdkAgent } from "@/lib/adk-agent-client"

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { message?: string; user_id?: string }
    const message = body.message?.trim()
    if (!message) {
      return NextResponse.json({ error: "message required" }, { status: 400 })
    }

    if (shouldSkipAdkAgent()) {
      return NextResponse.json(
        {
          error: "ADK agent not configured for this deployment",
          hint: "Set NEURAUDIT_ADK_AGENT_URL to Cloud Run ADK agent URL",
        },
        { status: 503 }
      )
    }

    const result = await invokeAdkAgentChat(message, body.user_id || "user")
    if (!result) {
      return NextResponse.json({ error: "ADK agent unavailable" }, { status: 502 })
    }

    return NextResponse.json({
      response: result.text,
      session_id: result.sessionId,
      engine: "adk",
      durationMs: result.durationMs,
    })
  } catch (err) {
    console.error("[ADK Chat API]", err)
    return NextResponse.json({ error: "ADK chat failed" }, { status: 500 })
  }
}

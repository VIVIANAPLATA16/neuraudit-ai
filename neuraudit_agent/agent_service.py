"""
NeurAudit ADK Agent — production FastAPI service (Cloud Run / local :8080).

Flow: User message → ADK Agent (Gemini) → Elastic MCP + NeurAudit tools → response
"""
from __future__ import annotations

import os
import uuid
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

load_dotenv()
load_dotenv(".env.local")

from neuraudit_agent.elastic_mcp import is_elastic_mcp_configured, probe_elastic_mcp

APP_NAME = "neuraudit_agent"
NEURAUDIT_GEMINI_MODEL = os.environ.get("NEURAUDIT_GEMINI_MODEL", "gemini-2.5-flash")

app = FastAPI(title="NeurAudit ADK Agent", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str
    user_id: str = "user"
    session_id: str | None = None


class ChatResponse(BaseModel):
    response: str
    session_id: str
    engine: str = "adk"
    model: str = NEURAUDIT_GEMINI_MODEL


def _gemini_configured() -> bool:
    return bool(os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"))


_runner = None
_session_service = None


def _get_runner():
    global _runner, _session_service
    if _runner is not None and _session_service is not None:
        return _runner, _session_service

    from google.adk.runners import Runner
    from google.adk.sessions import InMemorySessionService
    from neuraudit_agent.agent import root_agent

    _session_service = InMemorySessionService()
    _runner = Runner(
        app_name=APP_NAME,
        agent=root_agent,
        session_service=_session_service,
    )
    return _runner, _session_service


@app.get("/health")
async def health():
    elastic = await probe_elastic_mcp()
    return {
        "status": "ok",
        "service": "neuraudit-adk-agent",
        "geminiConfigured": _gemini_configured(),
        "model": NEURAUDIT_GEMINI_MODEL,
        "elasticMcp": elastic.get("reachable", False),
        "elasticMcpConfigured": is_elastic_mcp_configured(),
        "elasticMcpTools": elastic.get("tools", []),
    }


@app.get("/compliance")
async def compliance():
    elastic = await probe_elastic_mcp()
    gemini = _gemini_configured()
    elastic_mcp = bool(elastic.get("reachable"))
    adk = gemini
    return {
        "gemini": gemini,
        "agentBuilder": adk and elastic_mcp,
        "elasticMcp": elastic_mcp,
        "adkAgent": adk,
        "details": {
            "elasticMcpConfigured": is_elastic_mcp_configured(),
            "elasticMcpTools": elastic.get("tools", []),
            "model": NEURAUDIT_GEMINI_MODEL,
        },
    }


@app.post("/chat", response_model=ChatResponse)
async def chat(body: ChatRequest):
    if not _gemini_configured():
        return ChatResponse(
            response="Gemini API key not configured (GEMINI_API_KEY or GOOGLE_API_KEY).",
            session_id=body.session_id or str(uuid.uuid4()),
            engine="adk",
        )

    from google.genai import types

    runner, session_service = _get_runner()
    user_id = body.user_id or "user"
    session_id = body.session_id

    if not session_id:
        session = await session_service.create_session(app_name=APP_NAME, user_id=user_id)
        session_id = session.id

    content = types.Content(
        role="user",
        parts=[types.Part(text=body.message)],
    )

    text_parts: list[str] = []
    async for event in runner.run_async(
        user_id=user_id,
        session_id=session_id,
        new_message=content,
    ):
        if event.content and event.content.parts:
            for part in event.content.parts:
                if getattr(part, "text", None):
                    text_parts.append(part.text)

    return ChatResponse(
        response="".join(text_parts) or "Sin respuesta del agente.",
        session_id=session_id,
        engine="adk",
        model=NEURAUDIT_GEMINI_MODEL,
    )


@app.post("/investigate")
async def investigate(body: dict[str, Any]):
    """Shortcut: investigate entity via ADK agent orchestration."""
    query = str(body.get("query", "")).strip()
    if not query:
        return {"error": "query required"}
    chat_body = ChatRequest(
        message=f"Investiga la entidad pública colombiana: {query}. Usa search_contracts y herramientas Elastic MCP si están disponibles. Responde en español con score de riesgo.",
        user_id=str(body.get("user_id", "user")),
    )
    result = await chat(chat_body)
    return result.model_dump()

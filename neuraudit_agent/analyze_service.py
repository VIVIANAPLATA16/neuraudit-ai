"""
Servicio interno de análisis NeurAudit ADK.
Ejecutar: uvicorn neuraudit_agent.analyze_service:app --host 127.0.0.1 --port 8001
Next.js consume vía NEURAUDIT_ADK_ANALYZE_URL (nunca expuesto al usuario final).
"""
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from neuraudit_agent.analyze import generate_deep_analysis, NEURAUDIT_GEMINI_MODEL

SERVICE_VERSION = "22.1.0"

# Cargar variables desde raíz del repo (.env primero, .env.local sobrescribe)
_root = Path(__file__).resolve().parent.parent
load_dotenv(_root / ".env")
load_dotenv(_root / ".env.local", override=True)

app = FastAPI(title="NeurAudit ADK Analysis Service", docs_url=None, redoc_url=None)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://nextjs:3000",
    ],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    query: str
    payload: dict
    compareWith: dict | None = None


def _gemini_config() -> dict:
    google_key = os.environ.get("GOOGLE_API_KEY")
    gemini_key = os.environ.get("GEMINI_API_KEY")
    api_key = google_key or gemini_key
    model = os.environ.get("NEURAUDIT_GEMINI_MODEL", NEURAUDIT_GEMINI_MODEL)
    key_source = None
    if google_key:
        key_source = "GOOGLE_API_KEY"
    elif gemini_key:
        key_source = "GEMINI_API_KEY"
    return {
        "geminiConfigured": bool(api_key),
        "model": model,
        "geminiKeySource": key_source,
    }


@app.on_event("startup")
def log_startup_config():
    cfg = _gemini_config()
    print(f"[NeurAudit ADK] version={SERVICE_VERSION} model={cfg['model']}")
    print(
        f"[NeurAudit ADK] GOOGLE_API_KEY detectada: {bool(os.environ.get('GOOGLE_API_KEY'))}"
    )
    print(
        f"[NeurAudit ADK] GEMINI_API_KEY detectada: {bool(os.environ.get('GEMINI_API_KEY'))}"
    )
    print(f"[NeurAudit ADK] Gemini configurado: {cfg['geminiConfigured']}")


@app.get("/health")
def health():
    cfg = _gemini_config()
    return {
        "status": "ok",
        "service": "neuraudit-adk-analyze",
        "geminiConfigured": cfg["geminiConfigured"],
        "model": cfg["model"],
        "version": SERVICE_VERSION,
        "geminiKeySource": cfg["geminiKeySource"],
    }


@app.post("/analyze")
def analyze(req: AnalyzeRequest):
    result = generate_deep_analysis(req.payload, req.compareWith)
    return {"query": req.query, "analysis": result, "engine": "neuraudit_agent"}

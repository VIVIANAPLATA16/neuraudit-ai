"""
Motor de análisis profundo NeurAudit — comparte modelo Gemini con agent.py (root_agent).
Invocado vía analyze_service.py; Next.js lo consume como cerebro ADK interno.
"""
import json
import os
import re

NEURAUDIT_GEMINI_MODEL = os.environ.get("NEURAUDIT_GEMINI_MODEL", "gemini-2.5-flash")

ANALYST_SYSTEM_PROMPT = """Eres un analista anticorrupción senior especializado en contratación pública colombiana.
Redactas informes ejecutivos al nivel de firmas Big Four (Deloitte, PwC, KPMG, EY) y entes de control (Contraloría General).

Analiza ÚNICAMENTE la información suministrada.
No inventes contratos, sanciones, montos ni hallazgos.

Tono: auditor senior, institucional, técnico-jurídico colombiano.
NO escribas como chatbot."""

DEEP_ANALYSIS_KEYS = [
    "resumenEjecutivo",
    "evaluacionRiesgo",
    "hallazgosCriticos",
    "evaluacionContratacion",
    "riesgoConcentracion",
    "riesgoDisciplinario",
    "riesgoFiscal",
    "recomendaciones",
    "conclusion",
]

MIN_WORDS = {
    "resumenEjecutivo": 500,
    "evaluacionRiesgo": 500,
    "hallazgosCriticos": 500,
    "evaluacionContratacion": 500,
    "riesgoConcentracion": 300,
    "riesgoDisciplinario": 300,
    "riesgoFiscal": 300,
    "recomendaciones": 500,
    "conclusion": 500,
}


def _build_prompt(payload: dict, compare_with: dict | None = None) -> str:
    word_reqs = "\n".join(
        f'- "{k}": mínimo {MIN_WORDS[k]} palabras' for k in DEEP_ANALYSIS_KEYS
    )
    ctx = json.dumps(payload, ensure_ascii=False, indent=2)
    if compare_with:
        ctx_b = json.dumps(compare_with, ensure_ascii=False, indent=2)
        return f"""{ANALYST_SYSTEM_PROMPT}

Compara dos entidades. Responde SOLO JSON válido (sin markdown):
{{
  "entidadMayorRiesgo": "...",
  "diferenciasRelevantes": "...",
  "prioridadesAuditoria": "...",
  "conclusion": "...",
  "entidadAuditarPrimero": "...",
  "justificacionPrioridad": "..."
}}

Cada campo mínimo 400 palabras excepto entidadAuditarPrimero (nombre de entidad).

Entidad A:
{ctx}

Entidad B:
{ctx_b}"""

    return f"""{ANALYST_SYSTEM_PROMPT}

Genera un informe de auditoría completo. Responde SOLO JSON válido (sin markdown):
{{
  "resumenEjecutivo": "...",
  "evaluacionRiesgo": "...",
  "hallazgosCriticos": "...",
  "evaluacionContratacion": "...",
  "riesgoConcentracion": "...",
  "riesgoDisciplinario": "...",
  "riesgoFiscal": "...",
  "recomendaciones": "...",
  "conclusion": "..."
}}

Requisitos de extensión:
{word_reqs}

Datos de la investigación:
{ctx}"""


def _parse_json(text: str) -> dict | None:
    try:
        match = re.search(r"\{[\s\S]*\}", text)
        if not match:
            return None
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        return None


def invoke_gemini(prompt: str) -> tuple[str | None, int]:
    api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return None, 0

    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(NEURAUDIT_GEMINI_MODEL)
        response = model.generate_content(
            prompt,
            generation_config={"temperature": 0.35, "max_output_tokens": 16384},
        )
        text = response.text.strip() if response.text else None
        tokens = len(prompt.split()) + (len(text.split()) if text else 0)
        return text, tokens
    except ImportError:
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
            model = ChatGoogleGenerativeAI(
                model=NEURAUDIT_GEMINI_MODEL,
                google_api_key=api_key,
                temperature=0.35,
            )
            response = model.invoke(prompt)
            text = response.content if isinstance(response.content, str) else str(response.content)
            tokens = len(prompt.split()) + len(text.split())
            return text.strip(), tokens
        except Exception as e:
            print(f"[analyze.py] langchain error: {e}")
            return None, 0
    except Exception as e:
        print(f"[analyze.py] gemini error: {e}")
        return None, 0


def generate_deep_analysis(payload: dict, compare_with: dict | None = None) -> dict:
    prompt = _build_prompt(payload, compare_with)
    text, tokens = invoke_gemini(prompt)
    if text:
        parsed = _parse_json(text)
        if parsed:
            parsed["source"] = "adk"
            parsed["meta"] = {
                "model": NEURAUDIT_GEMINI_MODEL,
                "estimatedTokens": tokens,
                "geminiConnected": True,
            }
            return parsed
    return {"error": "gemini_unavailable", "source": "failed"}

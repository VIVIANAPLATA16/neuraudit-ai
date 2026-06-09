/**
 * Configuración Gemini compartida con neuraudit_agent/agent.py (root_agent).
 * Modelo: gemini-2.5-flash — mismo que Agent(model="gemini-2.5-flash", ...)
 * API Key: GOOGLE_API_KEY o GEMINI_API_KEY (estándar ADK / Google GenAI)
 */
export const NEURAUDIT_GEMINI_MODEL =
  process.env.NEURAUDIT_GEMINI_MODEL || "gemini-2.5-flash"

export function getGeminiApiKey(): string | undefined {
  return process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY
}

export const ANALYST_SYSTEM_PROMPT = `Eres un analista anticorrupción especializado en contratación pública colombiana.

Analiza únicamente la información suministrada.

No inventes contratos.
No inventes sanciones.
No inventes montos.
No inventes hallazgos.

Genera:

1. Resumen Ejecutivo
2. Riesgos Relevantes
3. Recomendaciones de Auditoría
4. Conclusión

La respuesta debe ser profesional, ejecutiva y apta para Contralorías, Auditorías, Compliance y Veedurías.`

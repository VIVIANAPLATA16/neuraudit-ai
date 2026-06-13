# NeurAudit — API Reference (Hackathon)

Base URL producción: `https://neuraudit-web-986541948066.us-central1.run.app`

Legacy URL: `https://neuraudit.vercel.app`

---

## APIs activas (usar estas)

| Endpoint | Método | Consumidor | Descripción |
|----------|--------|------------|-------------|
| `/api/agent/search` | GET | UI, ADK agent | Investigación completa (`?q=`, `?nocache=true`, `?insights=true`) |
| `/api/agent/analysis` | POST | UI panel IA | Análisis profundo `{ query, result }` |
| `/api/agent/compare` | GET | UI comparar | `?a=&b=` comparación entidades |
| `/api/agent/summary` | GET | **MCP**, Agent Builder | Resumen compacto `?q=` |
| `/api/system/status` | GET | UI config | Health Gemini/ADK/caché |
| `/api/expediente/pdf` | POST | UI PDF | Genera expediente PDF |
| `/api/mcp` | POST | Agent Builder | JSON-RPC MCP core |
| `/api/mcp/message` | POST | Agent Builder | Alias MCP (mismo handler) |
| `/api/mcp/sse` | GET/POST | Agent Builder | SSE + MCP |

---

## APIs legacy (mantenidas por compatibilidad)

| Endpoint | Estado | Notas |
|----------|--------|-------|
| `/api/agent/insights` | **Deprecated** | Usar `/api/agent/analysis` |
| `/api/analyze` | Legacy | Análisis texto contrato (Anthropic/OpenAI) — sin UI |
| `/api/secop` | Proxy | Dataset SECOP II directo |
| `/api/soda2` | Proxy | Proxy Socrata genérico |
| `/api/paco` | Proxy | CSV PACO responsabilidades fiscales |

---

## Flujo recomendado

```
1. GET  /api/agent/search?q=ENTIDAD
2. POST /api/agent/analysis  { query, result: <paso 1> }
```

## MCP (Agent Builder)

```json
POST /api/mcp
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "search_contracts",
    "arguments": { "query": "ICBF" }
  }
}
```

---

## Códigos de respuesta

| Código | Significado |
|--------|-------------|
| 200 | OK |
| 400 | Parámetros faltantes |
| 405 | Método incorrecto (ej. GET en `/analysis`) |
| 500 | Error interno |

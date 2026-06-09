# NeurAudit AI — Devpost Submission

**Google Cloud Rapid Agent Hackathon 2026**

---

## Elevator pitch (30 segundos)

**NeurAudit AI** es un agente de inteligencia anticorrupción para la contratación pública colombiana. Cruza en segundos datos reales de SECOP, Contraloría, Procuraduría y sanciones; calcula un score de riesgo explicable; y genera informes de auditoría con Gemini — ayudando a detectar concentración, contratación directa, fraccionamiento y antecedentes disciplinarios.

---

## Problema

Colombia publica millones de registros contractuales en datos abiertos, pero:

- Un auditor tarda **días** cruzando fuentes manualmente
- No hay score unificado de riesgo por entidad
- La corrupción se esconde en patrones (fraccionamiento, único oferente, proveedor recurrente)
- Las herramientas existentes no integran IA generativa con datos oficiales en tiempo real

---

## Solución

NeurAudit automatiza la investigación:

1. **Buscar** entidad (ICBF, UNGRD, Alcaldía de Bogotá…)
2. **Cruzar** 13 fuentes oficiales con paginación real
3. **Puntuar** riesgo 0–100 con 10 reglas documentadas
4. **Explicar** factores y trazabilidad por fuente
5. **Informar** con IA (Gemini) o fallback derivado institucional

---

## Demo steps (para video / live)

### Demo 1 — Investigación web (2 min)

1. Abrir https://neuraudit.vercel.app
2. Buscar **"ICBF"** o **"UNGRD"**
3. Mostrar: score, fuentes consultadas, contratos, hallazgos
4. Abrir panel **Analista IA** → informe ejecutivo
5. Exportar **PDF expediente**

### Demo 2 — Comparación (1 min)

1. Ir a `/comparar`
2. Comparar **UNGRD** vs **ICBF**
3. Mostrar diferencia de score y análisis comparativo

### Demo 3 — Agente MCP / Agent Builder (1 min)

1. Mostrar `POST https://neuraudit.vercel.app/api/mcp` con `tools/call`
2. O demo local ADK dev-ui en `:8000`
3. Agente invoca herramienta `search_contracts` → datos reales

### Demo 4 — Arquitectura (30 seg)

Mostrar diagrama en `docs/ARCHITECTURE.md`: Vercel + Gemini + datos.gov.co

---

## Arquitectura (simple)

```
Usuario → Next.js (Vercel) → datos.gov.co (13 fuentes)
                ↓
         Motor de riesgo + score explicable
                ↓
         ADK Analyze (Cloud Run) → Gemini 2.5 Flash
                ↓
         Informe de auditoría anticorrupción
```

**MCP Server** en Vercel integra con **Google Cloud Agent Builder**.

---

## Tecnologías

| Tecnología | Uso |
|------------|-----|
| **Google Gemini 2.5 Flash** | Análisis narrativo profundo |
| **Google ADK** | Agente con herramientas (`agent.py`) |
| **Google Agent Builder / MCP** | Integración estándar JSON-RPC |
| **Next.js 16** | Frontend + API serverless |
| **Vercel** | Deploy producción |
| **FastAPI** | Servicio ADK Analyze |
| **datos.gov.co (Socrata)** | 13 datasets oficiales SECOP/CGR/Procuraduría |
| **Docker / Cloud Run** | Deploy del agente Python |

---

## Impacto potencial

- **Contraloría / Procuraduría:** priorización de auditorías por score
- **Medios / sociedad civil:** investigación periodística en minutos
- **Entidades estatales:** autocontrol preventivo de contratación
- **Hackathon → producto:** arquitectura lista para piloto institucional

**Mercado:** ~$50B COP/año en contratación pública colombiana.

---

## Por qué es escalable

| Dimensión | Cómo escala |
|-----------|-------------|
| Datos | APIs públicas sin licencia; paginación hasta 10K/fuente |
| IA | Gemini serverless; fallback sin downtime |
| Deploy | Vercel auto-scale; ADK en Cloud Run |
| Integración | MCP estándar → cualquier agente Google Cloud |
| Geo | Mismo patrón aplicable a otros países con datos abiertos |

---

## Estado MVP hackathon

| Feature | Estado |
|---------|--------|
| UI web producción | ✅ Vercel |
| 13 fuentes datos.gov.co | ✅ |
| Score + explainability | ✅ |
| Informe IA | ✅ (Gemini o fallback) |
| MCP Agent Builder | ✅ |
| ADK dev-ui local | ✅ |
| ADK Analyze cloud | 📋 Documentado (Cloud Run) |
| PostgreSQL | ❌ No requerido MVP |

---

## Links

| Recurso | URL |
|---------|-----|
| **Demo live** | https://neuraudit.vercel.app |
| **Repo** | https://github.com/VIVIANAPLATA16/neuraudit-ai |
| **Arquitectura** | `docs/ARCHITECTURE.md` |
| **Deploy agente** | `docs/AGENT_DEPLOYMENT.md` |

---

## Team & attribution

Built for **Google Cloud Rapid Agent Hackathon 2026** — Elastic Track / Agent Builder integration.

*Datos 100% públicos del Gobierno de Colombia (datos.gov.co).*

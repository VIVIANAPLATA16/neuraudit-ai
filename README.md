# 🛡️ NeurAudit AI

> **Anti-corruption intelligence agent for Colombian public procurement**
> **Agente de inteligencia anti-corrupción para contratación pública colombiana**

[![Demo](https://img.shields.io/badge/demo-live-green)](https://neuraudit-web-986541948066.us-central1.run.app)
[![datos.gov.co](https://img.shields.io/badge/datos-datos.gov.co-blue)](https://datos.gov.co)
[![License](https://img.shields.io/badge/license-MIT-yellow)](LICENSE)

---

## 🌐 Live Demo / Demo en vivo

**👉 https://neuraudit-web-986541948066.us-central1.run.app**

---

# 🇬🇧 ENGLISH

## What it is

NeurAudit AI cross-references 13 official government datasets (SECOP, Comptroller General, Attorney General, royalty funds, sanctions) and delivers, in seconds:

- A 0–100 risk score with formal explainability
- Per-source traceability (success / partial / error / timeout / empty)
- Deep audit reports powered by Gemini 2.5 Flash
- PDF case files and side-by-side entity comparison
- MCP integration for Google Cloud Agent Builder

## Tech stack

| Layer | Technology | Role |
|-------|-----------|------|
| Frontend & BFF | Next.js 16, React 19, Tailwind CSS 4 | UI + serverless API routes |
| Live government data | datos.gov.co (Socrata) | 13 datasets, paginated fetch with backoff |
| Hybrid search | Elasticsearch on GCP | Semantic SECOP contract search |
| Risk engine | TypeScript (risk-engine.ts) | 10-rule deterministic scoring |
| Generative AI | Gemini 2.5 Flash | Deep audit reports |
| AI orchestration | ADK → Gemini → derived fallback | Never leaves user without response |
| Deployment | Google Cloud Run + Vercel | Scalable production |

## Architecture

    User query
         │
         ├─► datos.gov.co (13 sources) ──┐
         └─► Elasticsearch GCP (hybrid) ─┤
                                           ▼
                                   Risk engine + explainability
                                           ▼
                          ADK Analyze → Gemini 2.5 Flash → fallback
                                           ▼
                          UI · PDF · Compare · MCP · Agent Builder

## Local setup

    git clone https://github.com/VIVIANAPLATA16/neuraudit-ai.git
    cd neuraudit-ai
    npm install

Create `.env.local`:

    GEMINI_API_KEY=your_google_ai_studio_key
    ELASTIC_ENDPOINT=https://your-deployment.es.us-central1.gcp.cloud.es.io
    ELASTIC_API_KEY=your_elastic_api_key

Run:

    npm run dev

Open http://localhost:3000

## Core API

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/agent/search?q= | GET | Full investigation (13 sources + Elastic) |
| /api/agent/analysis | POST | Deep AI audit report |
| /api/agent/compare?a=&b= | GET | Compare two entities |
| /api/expediente/pdf?q= | GET | PDF case file |
| /api/system/status | GET | System diagnostics |
| /api/mcp | POST | MCP JSON-RPC (Agent Builder) |

## Use cases

| User | Use case |
|------|----------|
| Auditor / Comptroller | Prioritize entities by explainable risk score |
| Journalist | Cross-source procurement investigation in minutes |
| Civil society | Transparency on state entities and contractors |

---

# 🇨🇴 ESPAÑOL

## ¿Qué es NeurAudit AI?

NeurAudit AI es un agente de inteligencia artificial que cruza 13 fuentes oficiales de datos abiertos del gobierno colombiano para detectar riesgos de corrupción en contratos públicos en segundos.

El sistema entrega:
- Puntaje de riesgo 0–100 con explicabilidad formal
- Trazabilidad por fuente (éxito / parcial / error / timeout / vacío)
- Informes de auditoría profunda con Gemini 2.5 Flash
- Expedientes en PDF y comparación de entidades
- Integración con agentes de IA vía MCP

## 🎯 Problema que resuelve

Colombia pierde aproximadamente **$50 billones de pesos anuales** en corrupción en contratación pública. Las herramientas actuales son:

- ❌ Reactivas — detectan el problema después del daño
- ❌ Fragmentadas — no cruzan fuentes de datos
- ❌ Lentas — auditorías que toman semanas
- ❌ Inaccesibles — solo para grandes entidades

**NeurAudit AI resuelve esto** cruzando 13 fuentes de datos abiertos en segundos con IA generativa.

## Stack tecnológico

| Capa | Tecnología | Rol |
|------|-----------|-----|
| Frontend | Next.js 16, React 19, Tailwind CSS 4 | UI + API serverless |
| Datos en vivo | datos.gov.co (Socrata) | 13 datasets en tiempo real |
| Búsqueda híbrida | Elasticsearch en GCP | Búsqueda semántica SECOP |
| Motor de riesgo | TypeScript (risk-engine.ts) | 10 reglas determinísticas |
| IA Generativa | Gemini 2.5 Flash | Informes de auditoría profunda |
| Orquestación IA | ADK → Gemini → fallback | Sin respuesta vacía al usuario |
| Despliegue | Google Cloud Run + Vercel | Producción escalable |

## Arquitectura

    Consulta del usuario
         │
         ├─► datos.gov.co (13 fuentes) ──┐
         └─► Elasticsearch GCP (híbrido) ─┤
                                           ▼
                                Motor de riesgo + explicabilidad
                                           ▼
                              ADK Analyze → Gemini 2.5 Flash → fallback
                                           ▼
                          UI · PDF · Comparar · MCP · Agent Builder

## Instalación local

    git clone https://github.com/VIVIANAPLATA16/neuraudit-ai.git
    cd neuraudit-ai
    npm install

Crea `.env.local`:

    GEMINI_API_KEY=tu_api_key_de_google_ai_studio

Ejecutar:

    npm run dev

Abre http://localhost:3000

## API principal

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| /api/agent/search?q= | GET | Investigación completa (13 fuentes + Elastic) |
| /api/agent/analysis | POST | Informe de auditoría profunda con IA |
| /api/agent/compare?a=&b= | GET | Comparar dos entidades |
| /api/expediente/pdf?q= | GET | Expediente en PDF |
| /api/system/status | GET | Diagnóstico del sistema |
| /api/mcp | POST | MCP JSON-RPC (Agent Builder) |

## Casos de uso

| Usuario | Caso de uso |
|---------|-------------|
| Auditor / Contraloría | Priorizar entidades por puntaje de riesgo explicable |
| Periodista | Investigación de contratación en minutos |
| Ciudadano | Transparencia sobre entidades públicas |
| Entidad pública | Autoauditoría preventiva |

---

## 🇨🇴 Concurso Datos al Ecosistema 2026: IA para Colombia

Proyecto presentado al **Concurso Datos al Ecosistema 2026: IA para Colombia**, organizado por el Ministerio TIC y el portal [datos.gov.co](https://www.datos.gov.co).

**Categoría:** Gobernanza y transparencia
**Nivel:** Avanzado
**Reto:** Detección de anomalías en contratación pública mediante IA

### Datasets de datos.gov.co utilizados

| Dataset | Uso en NeurAudit AI |
|---------|-------------------|
| SECOP II — Contratos públicos | Fuente principal de contratos y procesos |
| SECOP II — Procesos de contratación | Análisis de irregularidades en licitaciones |
| Contraloría General — Hallazgos fiscales | Detección de sanciones fiscales |
| Procuraduría — Sanciones disciplinarias | Verificación de contratistas sancionados |
| Regalías — SMSCE | Monitoreo de fondos de regalías |
| SECOP I — Contratos legacy | Historial contractual de entidades |
| Inhabilidades e incompatibilidades | Lista de inhabilitados para contratar |

### Criterios del concurso

| Criterio | Cómo NeurAudit AI lo cumple |
|----------|----------------------------|
| Innovación y creatividad | Motor de riesgo con 10 reglas + IA generativa única en Colombia |
| Uso de datos abiertos | 13 datasets de datos.gov.co en tiempo real |
| Análisis y rigor técnico | Puntuación determinística + explicabilidad formal por fuente |
| Uso de IA | Gemini 2.5 Flash + ADK + detección de anomalías |
| Impacto y escalabilidad | Aplicable a todas las entidades públicas colombianas |
| Diseño y usabilidad | UI intuitiva, PDF exportable, comparación de entidades |

### Impacto esperado
- Reducción del tiempo de auditoría de semanas a segundos
- Acceso ciudadano a inteligencia anti-corrupción basada en datos abiertos
- Escalable a todas las entidades públicas colombianas
- Potencial de adopción por Contraloría General y Procuraduría

---

## 📄 Licencia / License

MIT © 2026 Viviana Plata

---

*Concurso Datos al Ecosistema 2026: IA para Colombia — MinTIC · datos.gov.co*

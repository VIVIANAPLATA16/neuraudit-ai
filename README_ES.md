# 🛡️ NeurAudit AI

> **Agente de inteligencia anti-corrupción para contratación pública colombiana**

[![Demo](https://img.shields.io/badge/demo-en%20vivo-green)](https://neuraudit-web-986541948066.us-central1.run.app)
[![datos.gov.co](https://img.shields.io/badge/datos-datos.gov.co-blue)](https://datos.gov.co)
[![Licencia](https://img.shields.io/badge/licencia-MIT-yellow)](LICENSE)

---

## 🌐 Demo en vivo

**👉 https://neuraudit-web-986541948066.us-central1.run.app**

---

## 🧠 ¿Qué es NeurAudit AI?

NeurAudit AI es un agente de inteligencia artificial que cruza 13 fuentes oficiales de datos abiertos del gobierno colombiano para detectar riesgos de corrupción en contratos públicos en segundos.

El sistema entrega:
- Puntaje de riesgo 0–100 con explicabilidad formal
- Trazabilidad por fuente (éxito / parcial / error / timeout / vacío)
- Informes de auditoría profunda con Gemini 2.5 Flash
- Expedientes en PDF y comparación de entidades
- Integración con agentes de IA vía MCP

---

## 🎯 Problema que resuelve

Colombia pierde aproximadamente **$50 billones de pesos anuales** en corrupción en contratación pública. Las herramientas actuales son:

- ❌ Reactivas — detectan el problema después del daño
- ❌ Fragmentadas — no cruzan fuentes de datos
- ❌ Lentas — auditorías que toman semanas
- ❌ Inaccesibles — solo para grandes entidades gubernamentales

**NeurAudit AI resuelve esto** cruzando 13 fuentes de datos abiertos en segundos con IA generativa.

---

## 🇨🇴 Datos Abiertos Colombia — Concurso Datos al Ecosistema 2026

Proyecto desarrollado para el **Concurso Datos al Ecosistema 2026: IA para Colombia**, organizado por el Ministerio TIC y el portal [datos.gov.co](https://www.datos.gov.co).

**Categoría:** Gobernanza y transparencia
**Nivel:** Avanzado
**Reto:** Detección de anomalías en contratación pública mediante IA

### Datasets de datos.gov.co utilizados

| Dataset | Endpoint | Uso en NeurAudit |
|---------|----------|-----------------|
| SECOP II — Contratos | datos.gov.co/resource/jbjy-vk9h | Fuente principal de contratos públicos |
| SECOP II — Procesos | datos.gov.co/resource/p6dx-8zbt | Análisis de procesos de licitación |
| SECOP I — Contratos legacy | datos.gov.co/resource/xvdy-vvsk | Historial contractual de entidades |
| Contraloría — Hallazgos fiscales | datos.gov.co/resource/2idx-25gg | Detección de sanciones fiscales |
| Procuraduría — Sanciones | datos.gov.co/resource/qr89-k2gh | Verificación de contratistas sancionados |
| Regalías — SMSCE | datos.gov.co/resource/iqfr-4v5b | Monitoreo de fondos de regalías |
| Inhabilidades | datos.gov.co/resource/vzzt-h3uz | Lista de inhabilitados para contratar |

---

## 🏗️ Arquitectura

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

---

## 🛠️ Stack tecnológico

| Capa | Tecnología | Rol |
|------|-----------|-----|
| Frontend | Next.js 16, React 19, Tailwind CSS 4 | UI + API serverless |
| Datos en vivo | datos.gov.co (Socrata) | 13 datasets con paginación |
| Búsqueda híbrida | Elasticsearch en GCP | Búsqueda semántica SECOP |
| Motor de riesgo | TypeScript (risk-engine.ts) | 10 reglas determinísticas |
| IA Generativa | Gemini 2.5 Flash | Informes de auditoría profunda |
| Orquestación IA | ADK → Gemini → fallback | Sin respuesta vacía al usuario |
| Despliegue | Google Cloud Run + Vercel | Producción escalable |

---

## ⚙️ Instalación local

### Requisitos
- Node.js 20+
- Python 3.11+
- GEMINI_API_KEY (Google AI Studio)

### Pasos

    git clone https://github.com/VIVIANAPLATA16/neuraudit-ai.git
    cd neuraudit-ai
    npm install

Crea `.env.local`:

    GEMINI_API_KEY=tu_api_key_de_google_ai_studio

Ejecutar:

    npm run dev

Abre http://localhost:3000

---

## 📊 Casos de uso

| Usuario | Caso de uso |
|---------|-------------|
| Auditor / Contraloría | Priorizar entidades por puntaje de riesgo explicable |
| Periodista | Investigación de contratación en minutos |
| Ciudadano | Transparencia sobre entidades públicas |
| Entidad pública | Autoauditoría preventiva |

---

## 🎯 Criterios del concurso

| Criterio | Cómo NeurAudit AI lo cumple |
|----------|----------------------------|
| Innovación y creatividad | Motor de riesgo con 10 reglas + IA generativa única en Colombia |
| Uso de datos abiertos | 13 datasets de datos.gov.co en tiempo real |
| Análisis y rigor técnico | Puntuación determinística + explicabilidad formal por fuente |
| Uso de IA | Gemini 2.5 Flash + ADK + detección de anomalías |
| Impacto y escalabilidad | Aplicable a todas las entidades públicas colombianas |
| Diseño y usabilidad | UI intuitiva, PDF exportable, comparación de entidades |

---

## 📄 Licencia

MIT © 2026 Viviana Plata

---

*Concurso Datos al Ecosistema 2026: IA para Colombia — MinTIC · datos.gov.co*

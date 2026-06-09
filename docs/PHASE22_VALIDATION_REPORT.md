# FASE 22 — Informe de Validación Técnica

**Proyecto:** NeurAudit AI  
**Fecha:** 9 de junio de 2026  
**Tipo:** Validación en ejecución real (no revisión de código)  
**Entorno:** Linux, Next.js dev `:3000`, ADK Analyze `python3 -m uvicorn` `:8001`  
**Evidencia cruda:** `docs/phase22-validation-raw.json`  
**Script de prueba:** `scripts/phase22-validate.mjs`

---

## Resumen ejecutivo

Fase 22 **funciona en ejecución** para los componentes de datos y arquitectura backend: paginación real, `fuentesTrace`, `scoreExplainability`, caché y fallback derivado están operativos y verificados con APIs reales.

**No funciona end-to-end el camino ADK → Gemini** en este entorno por dos causas independientes:

1. **ADK sin variables de entorno** al arrancar manualmente (`gemini_unavailable` en Python).
2. **Gemini API 429** — créditos prepago agotados (log Next.js).

El **fallback derivado sí responde** correctamente con informes completos (~3.800 caracteres) cuando ADK está apagado o Gemini falla.

**Docker Compose no fue ejecutado** en esta sesión (comando rechazado en el entorno de validación). Se realizó revisión estática de manifiestos.

| Componente | Resultado |
|------------|-----------|
| Paginación datos.gov.co | ✅ Verificado (500 reg/página, 20 páginas ICBF) |
| `fuentesTrace` (13 fuentes) | ✅ Verificado |
| `scoreExplainability` | ✅ Verificado |
| Caché TTL | ✅ Verificado (54 ms vs ~31 s) |
| Fallback derivado | ✅ Verificado (ADK apagado) |
| ADK health | ✅ `/health` 200 |
| ADK → Gemini análisis | ❌ `gemini_unavailable` (sin API key en proceso) |
| Next.js → Gemini directo | ❌ HTTP 429 billing |
| Docker `compose up --build` | ⚠️ No ejecutado |

---

## 1. Pruebas realizadas

### 1.1 Paginación datos.gov.co

**Prueba directa** (sin NeurAudit):

```
GET https://www.datos.gov.co/resource/jbjy-vk9h.json
  ?$limit=500&$offset=0&$where=upper(nombre_entidad) like '%ICBF%'
→ 500 registros en 798 ms

GET ...&$offset=500
→ 500 registros en 358 ms
```

**Prueba vía NeurAudit** (ICBF, `nocache=true`):

| Fuente | Páginas | Registros | Estado |
|--------|---------|-----------|--------|
| secopII | 20 | 10.000 (cap) | success |
| secopIalt | 20 | 10.000 (cap) | success |
| procesos | 20 | 10.000 (cap) | success |

**Conclusión:** La paginación real funciona. El tope de 10.000 registros/fuente se alcanza en entidades con alto volumen.

---

### 1.2 `fuentesTrace` y estados por fuente

Todas las investigaciones devolvieron **13 entradas** en `fuentesTrace`.

**Ejemplo UNGRD** (`meta`):

```json
{
  "fuentesConsultadas": 13,
  "fuentesExitosas": 3,
  "fuentesConError": 2,
  "fuentesVacias": 7,
  "fuentesTimeout": 1,
  "duracionTotalMs": 29455
}
```

**Distribución de estados observada:**

| Estado | Comportamiento real |
|--------|---------------------|
| `success` | Datos paginados correctamente |
| `empty` | HTTP 200, 0 registros |
| `error` | HTTP no-OK o fallo de red (~500–600 ms) |
| `timeout` | Abort tras 20.000 ms |

**Defecto detectado (Fase 22):** En *Ministerio de Salud*, `secopIalt` reporta `status: "timeout"` pero entrega **2.500 registros** parciales. El motor de riesgo usa esos datos, pero el estado es inconsistente.

---

### 1.3 `scoreExplainability`

Presente en todas las respuestas de `/api/agent/search`. Ejemplo UNGRD:

```json
{
  "scoreFinal": 90,
  "reglasActivas": 5,
  "totalReglas": 10,
  "sumaPuntos": 90,
  "factoresAplicados": [
    "Contratación directa",
    "Registros Procuraduría",
    "Baja competencia",
    "Volumen contractual elevado",
    "Posible fraccionamiento"
  ]
}
```

**Conclusión:** Explicabilidad formal operativa y alineada con `risk-engine.ts`.

---

### 1.4 Caché de investigaciones

Prueba con query `ICBF`:

| Consulta | Tiempo | `meta.cached` | Registros |
|----------|--------|---------------|-----------|
| 1ª (`nocache=true`) | **30.985 ms** | `false` | 30.137 |
| 2ª (caché) | **54 ms** | `true` | 30.137 |
| 3ª (`nocache=true`) | **39.051 ms** | `false` | 20.637 |

**Speedup caché:** ~99,8 % (574× más rápido).

**Log Next.js (evidencia):**

```
GET /api/agent/search?q=ICBF&nocache=true 200 in 31.0s
GET /api/agent/search?q=ICBF              200 in 37ms   ← caché
GET /api/agent/search?q=ICBF&nocache=true 200 in 39.0s
```

**Limitación:** Caché en memoria del proceso Node. Se pierde al reiniciar el servidor o en despliegues multi-instancia.

---

### 1.5 Pipeline IA: ADK → Gemini → Fallback

#### Con ADK activo (`/health` → 200)

**POST `/api/agent/analysis`** (payload correcto `{ query, result }`):

```json
{
  "status": 200,
  "ms": 3687,
  "source": "derived",
  "engine": "derived",
  "geminiConnected": false,
  "conclusionLen": 3798
}
```

**POST ADK directo** `http://127.0.0.1:8001/analyze`:

```json
{
  "status": 200,
  "ms": 137,
  "source": "failed",
  "error": "gemini_unavailable"
}
```

**Causa:** El proceso uvicorn se inició **sin** exportar `GEMINI_API_KEY` desde `.env.local`. El healthcheck pasa, pero el análisis falla.

#### Gemini directo (Next.js)

**Log del servidor Next.js:**

```
[Analysis] Gemini direct error: Error: [GoogleGenerativeAI Error]:
  [429 Too Many Requests] Your prepayment credits are depleted.
  Please go to AI Studio at https://ai.studio/projects ...
```

**Causa:** Cuota/billing de Gemini agotada. No es defecto de código.

#### Con ADK apagado (resiliencia)

```
kill uvicorn → ADK_after_kill:000

POST /api/agent/analysis → {
  "ms": 3020,
  "source": "derived",
  "engine": "derived",
  "conclusionLen": 3797
}
```

**Conclusión:** La cadena de degradación **funciona** — el usuario recibe análisis derivado. ADK y Gemini no aportan valor adicional en este entorno por configuración/billing, no por ausencia de implementación.

#### `GET /api/agent/search?insights=true`

```
UNGRD + insights → source: "derived", gemini: false, conclusionLen: 3797
```

Flujo unificado confirmado; termina en fallback por 429.

#### `GET /api/agent/compare?a=UNGRD&b=ICBF`

```json
{
  "ms": 3963,
  "mayorRiesgo": "UNGRD",
  "source": "derived",
  "scoreA": 90,
  "scoreB": 90,
  "hasAnalisisIA": true
}
```

Compare usa `generateComparativeAnalysis` (no `insights.ts` legado). Fallback derivado confirmado.

---

### 1.6 Docker Compose

**Estado:** No ejecutado (`docker compose up --build` rechazado en el entorno).

**Revisión estática:**

| Elemento | Estado |
|----------|--------|
| `docker-compose.yml` | 2 servicios, healthcheck ADK, `depends_on` |
| `Dockerfile` (Next.js) | Multi-stage, `output: standalone` |
| `neuraudit_agent/Dockerfile` | Python 3.11 + uvicorn |
| Variables en compose | `GOOGLE_API_KEY`, `GEMINI_API_KEY`, `NEURAUDIT_ADK_ANALYZE_URL` |
| Comunicación interna | `http://adk-analyze:8001/analyze` |

**Riesgo:** Sin prueba de build real no se puede confirmar tiempos de build, tamaño de imagen ni conectividad inter-contenedor.

---

### 1.7 `/api/system/status`

| Métrica | Valor |
|---------|-------|
| Primera llamada (durante carga) | **139.484 ms** |
| Segunda llamada (caché caliente) | **35 ms** |
| `gemini.connected` | `true` (key presente en Next.js) |
| `adk.connected` | `true` |
| `cache.entries` | 5 (tras pruebas) |

**Defecto menor:** La primera llamada dispara `search?q=health` internamente y puede tardar minutos si coincide con investigaciones pesadas en paralelo.

---

## 2. Pruebas de carga ligera — 4 entidades

| Entidad | Tiempo | Score | Nivel | Registros | Fuentes exitosas | Fuentes error | Timeout |
|---------|--------|-------|-------|-----------|------------------|---------------|---------|
| **UNGRD** | 30,5 s | 90 | ALTO | 2.071 | 3/13 | 2 | 1 |
| **ICBF** | 23,9 s | 50* | MEDIO | 10.000* | 1/13 | 12 | 0 |
| **Ministerio de Salud** | 52,0 s | 25 | BAJO | 2.604 | 3/13 | 2 | 1 |
| **Alcaldía de Bogotá** | 20,0 s | 25 | BAJO | **1** | 1/13 | 2 | 1 |

\* Primera corrida ICBF limitada por rate-limit de datos.gov.co (12 fuentes en `error` mientras SECOP II paginaba). Re-ejecución posterior obtuvo 30.137 registros y score 90.

### Detalle por entidad

**UNGRD** — Fuentes con datos: SECOP II (850, 2 págs), Procesos (1.212, 3 págs), Procuraduría (9). Score alto por contratación directa, baja competencia, fraccionamiento.

**ICBF** — Volumen masivo; 3 fuentes alcanzan cap de 10.000 en re-ejecución. Consumo aproximado: ~30 s CPU red, ~30k registros JSON.

**Ministerio de Salud** — SECOP I alt (2.500, timeout parcial), Procuraduría (91). Score bajo (solo Procuraduría activa en explainability).

**Alcaldía de Bogotá** — **Fallo de cobertura:** solo 1 registro (Procuraduría). SECOP vacío porque la búsqueda `LIKE '%ALCALDÍA DE BOGOTÁ%'` no coincide con nombres en bases (tildes/razón social). **No es demo — es limitación de query.**

### Consumo aproximado por investigación

| Recurso | Rango observado |
|---------|-----------------|
| Tiempo respuesta | 20–52 s (sin caché) |
| Llamadas HTTP a datos.gov.co | 13 paralelas + N páginas |
| Payload JSON respuesta | 50 KB – varios MB (entidades grandes) |
| Tokens Gemini | 0 (429 / unavailable) |

---

## 3. Errores encontrados

| ID | Severidad | Descripción | ¿Defecto Fase 22? |
|----|-----------|-------------|-------------------|
| E1 | Alta | Gemini 429 — créditos agotados | No (billing externo) |
| E2 | Alta | ADK manual sin `GEMINI_API_KEY` en proceso | Sí (ops/DX — README no exige export) |
| E3 | Media | `timeout` con datos parciales usados en scoring | Sí (`datos-fetcher.ts`) |
| E4 | Media | Rate-limit datos.gov.co bajo 13 fetches paralelos | Sí (arquitectura paralela) |
| E5 | Media | Alcaldía de Bogotá → 1 registro | Sí (query por texto, no NIT) |
| E6 | Baja | `/api/system/status` lento en primera llamada | Sí (diseño health probe) |
| E7 | Info | Docker no validado en ejecución | N/A (entorno) |
| E8 | Info | Caché volátil (memoria proceso) | Diseño documentado |

---

## 4. Auditoría de producto (con evidencia)

### ¿Qué sigue siendo demo?

| Área | Evidencia |
|------|-----------|
| **IA generativa real** | Siempre `source: "derived"` en pruebas; Gemini 429; ADK sin key |
| **Historial / configuración** | `localStorage` cliente — sin persistencia servidor |
| **Autenticación / multi-usuario** | No existe |
| **Elastic / búsqueda semántica** | No en runtime (solo script offline) |
| **Alcaldía de Bogotá** | 1 registro — resultado no usable para auditoría |
| **Docker producción** | No verificado en ejecución |

### ¿Qué ya es piloto institucional?

| Área | Evidencia |
|------|-----------|
| **Datos oficiales reales** | 2.071–30.137 registros de datos.gov.co en pruebas |
| **13 fuentes integradas** | `fuentesTrace` completo en cada respuesta |
| **Paginación real** | 20 páginas × 500 en ICBF |
| **Motor de riesgo + explainability** | Scores 25–90 con 10 reglas documentadas |
| **Trazabilidad** | 17–20 líneas narrativas + trace estructurado |
| **Caché funcional** | 54 ms vs 31 s |
| **Resiliencia** | Fallback con ADK apagado y Gemini 429 |
| **Compare unificado** | API migrada, no usa `insights.ts` |

### ¿Qué impediría vender NeurAudit hoy?

1. **Sin SLA ni tiempos garantizados** — 20–52 s por consulta sin caché.
2. **Sin autenticación ni trazabilidad de usuarios** — requisito institucional básico.
3. **Sin persistencia server-side** — historial y auditoría de consultas no exportables.
4. **IA generativa no operativa** — billing Gemini; informes son plantillas derivadas.
5. **Cobertura irregular por entidad** — búsqueda por texto frágil (Alcaldía falló).
6. **Rate limits datos.gov.co** — hasta 12/13 fuentes en error bajo carga.
7. **Docker sin validar** — despliegue reproducible no demostrado.
8. **Sin facturación / planes** — no comercializable como SaaS.

---

## 5. Riesgos

| Riesgo | Impacto | Probabilidad |
|--------|---------|--------------|
| Agotamiento cuota Gemini | Informes siempre derivados | Alta (confirmado) |
| Rate-limit Socrata | Investigaciones incompletas | Alta (confirmado en ICBF) |
| Timeout 20 s/fuente | Datos parciales con estado incorrecto | Media |
| Caché volátil | UX inconsistente post-reinicio | Media |
| Query por texto | Falsos negativos (Alcaldía) | Alta |
| 13 fetches paralelos | Contención y errores en cascada | Alta |

---

## 6. Recomendaciones (sin implementar — Fase 23 pendiente)

### Correcciones Fase 22 sugeridas (pequeñas)

1. **`datos-fetcher.ts`:** Si hay registros parciales tras timeout → estado `success` con `message: "parcial (timeout)"` o nuevo estado `partial`.
2. **`analyze_service.py`:** Cargar `.env.local` con `python-dotenv` al arrancar manualmente.
3. **README:** Documentar `export $(grep ... .env.local)` antes de uvicorn.

### Siguiente fase recomendada (Fase 23)

Prioridad sugerida:

1. **Resolver billing Gemini** — desbloquea valor del pipeline ADK ya construido.
2. **Cola async + backoff** — serializar/limitar fetches a datos.gov.co; reducir errores E4.
3. **Búsqueda por NIT/razón social normalizada** — corregir Alcaldía y entidades similares.
4. **Validar Docker en CI** — `docker compose up --build` automatizado.
5. **PostgreSQL** — historial, caché persistente, auditoría (cuando se apruebe Fase 23).

---

## 7. Logs relevantes (extractos)

### Next.js — Gemini 429

```
[Analysis] Gemini direct error: Error: [GoogleGenerativeAI Error]: Error fetching from
https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent:
[429 Too Many Requests] Your prepayment credits are depleted.
POST /api/agent/analysis 200 in 3.7s
```

### Next.js — Caché

```
GET /api/agent/search?q=ICBF&nocache=true 200 in 31.0s
GET /api/agent/search?q=ICBF              200 in 37ms
```

### ADK — Sin Gemini

```
POST http://127.0.0.1:8001/analyze →
{"analysis":{"error":"gemini_unavailable","source":"failed"},"engine":"neuraudit_agent"}
```

### Resiliencia — ADK apagado

```
ADK_after_kill:000
POST /api/agent/analysis → source:"derived", conclusionLen:3797, ms:3020
```

---

## 8. Matriz de validación final

| Requisito Fase 22 | Código existe | Funciona en ejecución |
|-------------------|---------------|----------------------|
| Paginación real | ✅ | ✅ |
| Estados por fuente | ✅ | ✅ (con defecto timeout+parcial) |
| Trazabilidad completa | ✅ | ✅ |
| Caché investigaciones | ✅ | ✅ |
| scoreExplainability | ✅ | ✅ |
| IA ADK → Gemini → Fallback | ✅ | ⚠️ Solo Fallback operativo |
| Compare unificado | ✅ | ✅ (derived) |
| docker-compose | ✅ | ⚠️ No ejecutado |
| README arquitectura | ✅ | ✅ |

---

## Recomendación de siguiente fase

**Aprobar inicio de Fase 23** con foco en:

1. Recarga de créditos Gemini + validación end-to-end ADK → Gemini.
2. Ejecución y CI de Docker Compose.
3. Cola de investigación async con backoff para datos.gov.co.
4. Resolución de entidades por NIT (no solo `LIKE`).

**No iniciar Fase 23** hasta decisión explícita del equipo. Esta validación no modificó código de producto.

---

*Generado tras ejecución real de `scripts/phase22-validate.mjs` y pruebas manuales complementarias. Evidencia JSON en `docs/phase22-validation-raw.json`.*

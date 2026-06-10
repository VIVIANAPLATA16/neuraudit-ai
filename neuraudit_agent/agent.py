import httpx
import os
from google.adk.agents.llm_agent import Agent
from google.adk.tools import FunctionTool

from neuraudit_agent.elastic_mcp import get_elastic_mcp_toolset, is_elastic_mcp_configured

NEURAUDIT_API = os.environ.get(
    "NEURAUDIT_API",
    "http://127.0.0.1:3000/api/agent/search",
)

def search_contracts(query: str) -> dict:
    """
    Busca contratos públicos colombianos en 13 fuentes simultáneas:
    SECOP I, SECOP II, CGR fallos fiscales, sanciones contractuales,
    Procuraduría, SGR Regalías (4 datasets), ejecución de contratos
    y contadores sancionados.
    
    Args:
        query: Nombre de entidad pública, contratista o NIT a investigar.
               Ejemplos: UNGRD, ICBF, Ministerio Salud, 900123456
    
    Returns:
        Diccionario con score de riesgo, alertas, fuentes consultadas
        y datos económicos del análisis.
    """
    try:
        with httpx.Client(timeout=60) as client:
            response = client.get(
                NEURAUDIT_API,
                params={"q": query}
            )
            if response.status_code != 200:
                return {
                    "error": f"API respondió con código {response.status_code}",
                    "query": query,
                }
            data = response.json()
            if data.get("error"):
                return {"error": data["error"], "query": query}

            riesgo = data.get("riesgo", {})
            fuentes = data.get("fuentes", {})

            if not riesgo and not fuentes.get("total"):
                return {
                    "query": query,
                    "score": 0,
                    "nivel": "SIN DATOS",
                    "alertas": [],
                    "total_registros": 0,
                    "mensaje": "No se encontraron registros en las fuentes consultadas.",
                }

            return {
                "query": query,
                "score": riesgo.get("score", 0),
                "nivel": riesgo.get("nivel", "DESCONOCIDO"),
                "alertas": riesgo.get("alertas", []),
                "score_breakdown": riesgo.get("scoreBreakdown", []),
                "hallazgos": riesgo.get("hallazgos", []),
                "recomendaciones": riesgo.get("recomendaciones", []),
                "total_registros": fuentes.get("total", 0),
                "fuentes": {
                    "secop_ii": fuentes.get("secopII", 0),
                    "secop_i": fuentes.get("secopI", 0),
                    "procesos_licitacion": fuentes.get("procesos", 0),
                    "ejecucion": fuentes.get("ejecucion", 0),
                    "cgr_fallos": fuentes.get("cgr", 0),
                    "sanciones": fuentes.get("sanciones", 0),
                    "contadores": fuentes.get("contadores", 0),
                    "procuraduria": fuentes.get("procuraduria", 0),
                    "sgr_regalias": fuentes.get("sgr", 0),
                },
                "datos_economicos": {
                    "total_contratos": riesgo.get("totalContratos", 0),
                    "entidades_unicas": riesgo.get("entidadesUnicas", 0),
                    "contratos_directos": riesgo.get("directos", 0),
                    "fraccionados": riesgo.get("fraccionados", 0),
                    "valor_total_cop": riesgo.get("valorTotal", 0),
                    "multas_cgr_cop": riesgo.get("montoCGR", 0),
                    "sanciones_cop": riesgo.get("montoSanc", 0),
                    "recursos_sgr_cop": riesgo.get("totalSGR", 0),
                    "sin_competencia": riesgo.get("sinCompetencia", 0),
                },
                "fallos_contraloria": len(data.get("fallosResponsabilidadFiscal", [])),
                "sanciones_contractuales": len(data.get("sancionesContractuales", [])),
                "registros_procuraduria": len(data.get("registrosProcuraduria", [])),
                "timestamp": data.get("timestamp", ""),
            }
    except httpx.TimeoutException:
        return {"error": "Timeout: la API no respondió en 60 segundos", "query": query}
    except httpx.ConnectError:
        return {"error": "No se pudo conectar con NeurAudit API", "query": query}
    except Exception as e:
        return {"error": str(e), "query": query}


def compare_entities(entity1: str, entity2: str, entity3: str = "") -> dict:
    """
    Compara el riesgo de corrupción entre 2 o 3 entidades públicas colombianas.
    
    Args:
        entity1: Primera entidad a comparar. Ejemplo: UNGRD
        entity2: Segunda entidad a comparar. Ejemplo: ICBF  
        entity3: Tercera entidad (opcional). Ejemplo: MinSalud
    
    Returns:
        Comparación de scores y métricas de riesgo entre las entidades.
    """
    entities = [e for e in [entity1, entity2, entity3] if e.strip()]
    results = []
    
    for entity in entities:
        try:
            with httpx.Client(timeout=30) as client:
                response = client.get(NEURAUDIT_API, params={"q": entity})
                data = response.json()
                riesgo = data.get("riesgo", {})
                fuentes = data.get("fuentes", {})
                results.append({
                    "entidad": entity,
                    "score": riesgo.get("score", 0),
                    "nivel": riesgo.get("nivel", "DESCONOCIDO"),
                    "total_registros": fuentes.get("total", 0),
                    "valor_total_cop": riesgo.get("valorTotal", 0),
                    "alertas_count": len(riesgo.get("alertas", [])),
                    "alertas": riesgo.get("alertas", []),
                })
        except Exception as e:
            results.append({"entidad": entity, "error": str(e)})
    
    results.sort(key=lambda x: x.get("score", 0), reverse=True)
    
    return {
        "comparacion": results,
        "entidad_mayor_riesgo": results[0].get("entidad") if results else "",
        "entidad_menor_riesgo": results[-1].get("entidad") if results else "",
    }


def generate_fiscal_report(query: str, include_recommendations: bool = True) -> dict:
    """
    Genera un expediente digital completo listo para enviar a entes de control
    colombianos (Contraloría, Procuraduría, Fiscalía).
    
    Args:
        query: Nombre de entidad o contratista a investigar
        include_recommendations: Si incluir acciones recomendadas (default: True)
    
    Returns:
        Expediente digital estructurado con hallazgos y recomendaciones.
    """
    try:
        with httpx.Client(timeout=30) as client:
            response = client.get(NEURAUDIT_API, params={"q": query})
            data = response.json()
            
        riesgo = data.get("riesgo", {})
        score = riesgo.get("score", 0)
        nivel = riesgo.get("nivel", "BAJO")
        alertas = riesgo.get("alertas", [])
        valor = riesgo.get("valorTotal", 0)
        
        # Determinar ente de control prioritario
        if score >= 75:
            ente_prioritario = "Contraloría General de la República"
            urgencia = "INMEDIATA"
        elif score >= 50:
            ente_prioritario = "Procuraduría General de la Nación"
            urgencia = "ALTA"
        else:
            ente_prioritario = "Veeduría Ciudadana"
            urgencia = "MEDIA"
        
        recommendations = []
        if include_recommendations:
            if score >= 75:
                recommendations = [
                    f"Iniciar auditoría especial en Contraloría sobre {query} — Art. 267 Constitución Política",
                    f"Verificar cumplimiento Ley 1474/2011 Art. 82 — responsabilidad fiscal por ${ valor/1e9:.2f}B COP",
                    "Solicitar acceso al expediente contractual completo en SECOP II",
                    "Cruzar NITs de contratistas con Boletín de Responsables Fiscales CGR",
                    "Remitir hallazgos a Fiscalía si se detectan elementos de tipo penal",
                ]
            elif score >= 50:
                recommendations = [
                    f"Apertura de indagación preliminar en Procuraduría sobre {query}",
                    "Verificar inhabilidades e incompatibilidades de contratistas — Ley 80/1993 Art. 8",
                    "Solicitar declaración de competencia en procesos sin concurrencia de oferentes",
                    "Revisar estudios previos y análisis de mercado en SECOP II",
                ]
            else:
                recommendations = [
                    "Monitoreo periódico en SECOP II — ninguna señal crítica detectada",
                    "Verificar publicación oportuna de contratos según Ley 1712/2014",
                    "Consultar datos actualizados en datos.gov.co para seguimiento",
                ]
        
        return {
            "expediente": {
                "titulo": f"EXPEDIENTE DIGITAL — {query.upper()}",
                "fecha": data.get("timestamp", ""),
                "entidad_investigada": query,
                "score_riesgo": score,
                "nivel_riesgo": nivel,
                "urgencia": urgencia,
                "ente_control_prioritario": ente_prioritario,
            },
            "hallazgos": {
                "total_registros_analizados": data.get("fuentes", {}).get("total", 0),
                "fuentes_consultadas": 13,
                "alertas_detectadas": alertas,
                "valor_bajo_analisis_cop": valor,
                "fallos_contraloria": len(data.get("fallosResponsabilidadFiscal", [])),
                "sanciones": len(data.get("sancionesContractuales", [])),
                "registros_procuraduria": len(data.get("registrosProcuraduria", [])),
                "contratos_sin_competencia": riesgo.get("sinCompetencia", 0),
                "posible_fraccionamiento": riesgo.get("fraccionados", 0),
            },
            "normativa_aplicable": [
                "Ley 80 de 1993 — Estatuto General de Contratación",
                "Ley 1150 de 2007 — Eficiencia y transparencia",
                "Ley 1474 de 2011 — Estatuto Anticorrupción",
                "Decreto 1082 de 2015 — Régimen reglamentario EGCAP",
                "Ley 1712 de 2014 — Transparencia y acceso a información",
            ],
            "acciones_recomendadas": recommendations,
            "fuentes_datos": [
                "SECOP II — datos.gov.co/resource/jbjy-vk9h",
                "SECOP I — datos.gov.co/resource/f789-7hwg",
                "CGR Fallos — datos.gov.co/resource/jr8e-e8tu",
                "Sanciones — datos.gov.co/resource/4n4q-k399",
                "SGR Regalías — datos.gov.co",
                "Procuraduría — datos.gov.co/resource/rhun-uf37",
                "Elastic Search — NeurAudit AI Index",
            ],
        }
    except Exception as e:
        return {"error": str(e), "query": query}


NEURAUDIT_GEMINI_MODEL = os.environ.get("NEURAUDIT_GEMINI_MODEL", "gemini-2.5-flash")


def _build_agent_tools():
    tools = [
        FunctionTool(search_contracts),
        FunctionTool(compare_entities),
        FunctionTool(generate_fiscal_report),
    ]
    elastic_mcp = get_elastic_mcp_toolset()
    if elastic_mcp is not None:
        tools.append(elastic_mcp)
    return tools


_elastic_mcp_note = (
    "4. Herramientas Elastic Agent Builder MCP — búsqueda semántica en índices Elasticsearch\n"
    if is_elastic_mcp_configured()
    else ""
)

_AGENT_INSTRUCTION = """Eres NeurAudit AI, el primer agente de inteligencia anticorrupción para contratación pública colombiana.

Tu misión: proteger los recursos públicos colombianos usando inteligencia artificial y datos abiertos del Estado.

## HERRAMIENTAS DISPONIBLES
1. search_contracts(query) — Busca en 13 fuentes simultáneas y retorna score de riesgo
2. compare_entities(entity1, entity2, entity3) — Compara riesgo entre entidades
3. generate_fiscal_report(query) — Genera expediente digital completo
{elastic_mcp_note}
## REGLAS ABSOLUTAS
1. SIEMPRE usa search_contracts antes de analizar cualquier entidad
2. Usa herramientas Elastic MCP para búsqueda semántica cuando estén disponibles
3. NUNCA inventes datos — todo debe venir de las herramientas
4. Responde SIEMPRE en español
5. Muestra el razonamiento paso a paso

## FORMATO DE RESPUESTA

🎯 SCORE DE RIESGO: [X]/100 — [ALTO🔴 / MEDIO🟡 / BAJO🟢]

📊 INTELIGENCIA RECOPILADA ([X] registros de 13 fuentes):
• SECOP II: X | SECOP I: X | Procesos: X | CGR: X | Sanciones: X
• Procuraduría: X | SGR Regalías: X | Contadores: X

⚠️ ALERTAS CRÍTICAS:
[lista de alertas]

💰 IMPACTO ECONÓMICO:
• Valor total: $X COP
• Multas CGR: $X COP
• Sin competencia: X procesos

📋 EXPEDIENTE DIGITAL:
[análisis con contexto colombiano y normativa]

🏛️ ACCIONES RECOMENDADAS:
[para Contraloría, Procuraduría y ciudadanos]

⚖️ NORMATIVA: Ley 80/1993, Ley 1150/2007, Ley 1474/2011

## EJEMPLOS DE CONSULTAS
- "Investiga la UNGRD" → usa search_contracts("UNGRD") luego generate_fiscal_report("UNGRD")
- "Compara UNGRD e ICBF" → usa compare_entities("UNGRD", "ICBF")
- "Genera expediente para Contraloría sobre MinSalud" → usa generate_fiscal_report("MinSalud")
"""

root_agent = Agent(
    model=NEURAUDIT_GEMINI_MODEL,
    name="NeurAudit_AI",
    description="Agente de inteligencia anticorrupción para contratos públicos colombianos. Analiza datos reales de SECOP I+II, CGR, Procuraduría, SGR Regalías y 13 fuentes simultáneas para detectar riesgos de corrupción.",
    instruction=_AGENT_INSTRUCTION.format(elastic_mcp_note=_elastic_mcp_note),
    tools=_build_agent_tools(),
)

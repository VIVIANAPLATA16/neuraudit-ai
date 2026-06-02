export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

// MCP Protocol handler para Google Cloud Agent Builder
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const method = body.method;

    // MCP: listar herramientas disponibles
    if (method === "tools/list") {
      return NextResponse.json({
        tools: [
          {
            name: "search_contracts",
            description: "Busca contratos públicos colombianos en 13 fuentes simultáneas: SECOP I+II, CGR, Sanciones, Procuraduría, SGR Regalías. Detecta riesgos de corrupción, fraccionamiento, concentración e inhabilidades.",
            inputSchema: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "Nombre de entidad, contratista o NIT a investigar. Ejemplos: UNGRD, ICBF, Ministerio Salud, 900123456",
                },
              },
              required: ["query"],
            },
          },
          {
            name: "compare_entities",
            description: "Compara el riesgo de corrupción entre múltiples entidades públicas colombianas",
            inputSchema: {
              type: "object",
              properties: {
                entities: {
                  type: "array",
                  items: { type: "string" },
                  description: "Lista de entidades a comparar. Ejemplo: [UNGRD, ICBF, MinSalud]",
                },
              },
              required: ["entities"],
            },
          },
        ],
      });
    }

    // MCP: ejecutar herramienta
    if (method === "tools/call") {
      const toolName = body.params?.name;
      const toolArgs = body.params?.arguments || {};

      if (toolName === "search_contracts") {
        const query = toolArgs.query || "";
        if (!query) {
          return NextResponse.json({
            content: [{ type: "text", text: "Error: se requiere un término de búsqueda" }],
            isError: true,
          });
        }

        const apiUrl = `https://neuraudit.vercel.app/api/agent/search?q=${encodeURIComponent(query)}`;
        const res = await fetch(apiUrl, { signal: AbortSignal.timeout(25000) });
        const data = await res.json();

        const riesgo = data.riesgo || {};
        const fuentes = data.fuentes || {};
        const alertas = (riesgo.alertas || []).join("\n- ");

        const report = `
INVESTIGACIÓN: ${query.toUpperCase()}
Score de riesgo: ${riesgo.score}/100 — Nivel: ${riesgo.nivel}
Timestamp: ${data.timestamp}

REGISTROS ENCONTRADOS (${fuentes.total} total):
- SECOP II: ${fuentes.secopII} contratos
- SECOP I: ${fuentes.secopI} contratos  
- Procesos licitación: ${fuentes.procesos}
- Ejecución contratos: ${fuentes.ejecucion}
- CGR fallos fiscales: ${fuentes.cgr}
- Sanciones contractuales: ${fuentes.sanciones}
- Contadores sancionados: ${fuentes.contadores}
- Procuraduría: ${fuentes.procuraduria}
- SGR Regalías: ${fuentes.sgr}

ALERTAS DETECTADAS:
- ${alertas || "Sin alertas críticas detectadas"}

DATOS ECONÓMICOS:
- Total contratos: ${riesgo.totalContratos}
- Entidades únicas: ${riesgo.entidadesUnicas}
- Contratos directos: ${riesgo.directos}
- Fraccionados: ${riesgo.fraccionados}
- Valor total: $${(riesgo.valorTotal || 0).toLocaleString("es-CO")} COP
- Multas CGR: $${(riesgo.montoCGR || 0).toLocaleString("es-CO")} COP
- Sanciones: $${(riesgo.montoSanc || 0).toLocaleString("es-CO")} COP
- Recursos SGR: $${(riesgo.totalSGR || 0).toLocaleString("es-CO")} COP
- Sin competencia: ${riesgo.sinCompetencia} procesos

FALLOS CONTRALORÍA: ${(data.fallosResponsabilidadFiscal || []).length} registros
SANCIONES CONTRACTUALES: ${(data.sancionesContractuales || []).length} registros
PROCURADURÍA: ${(data.registrosProcuraduria || []).length} registros
REGALÍAS SGR: ${(data.regaliasSGR || []).length} registros
`.trim();

        return NextResponse.json({
          content: [{ type: "text", text: report }],
        });
      }

      if (toolName === "compare_entities") {
        const entities: string[] = toolArgs.entities || [];
        if (!entities.length) {
          return NextResponse.json({
            content: [{ type: "text", text: "Error: se requiere al menos una entidad" }],
            isError: true,
          });
        }

        const results = await Promise.allSettled(
          entities.map(async (entity) => {
            const res = await fetch(
              `https://neuraudit.vercel.app/api/agent/search?q=${encodeURIComponent(entity)}`,
              { signal: AbortSignal.timeout(20000) }
            );
            return { entity, data: await res.json() };
          })
        );

        const comparison = results
          .map((r) => {
            if (r.status === "fulfilled") {
              const { entity, data } = r.value;
              return `${entity}: Score ${data.riesgo?.score}/100 (${data.riesgo?.nivel}) — ${data.fuentes?.total} registros — $${((data.riesgo?.valorTotal || 0) / 1e9).toFixed(2)}B COP`;
            }
            return "Error al consultar entidad";
          })
          .join("\n");

        return NextResponse.json({
          content: [{ type: "text", text: `COMPARACIÓN DE RIESGO:\n${comparison}` }],
        });
      }

      return NextResponse.json({
        content: [{ type: "text", text: `Herramienta desconocida: ${toolName}` }],
        isError: true,
      });
    }

    // MCP: initialize
    if (method === "initialize") {
      return NextResponse.json({
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: {
          name: "neuraudit-mcp",
          version: "1.0.0",
        },
      });
    }

    return NextResponse.json({ error: "Method not found" }, { status: 404 });
  } catch (err) {
    console.error("MCP error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    name: "NeurAudit AI MCP Server",
    version: "1.0.0",
    description: "Anti-corruption intelligence for Colombian public contracts",
    tools: ["search_contracts", "compare_entities"],
  });
}

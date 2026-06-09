export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

const TOOLS = [
  {
    name: "investigar_entidad",
    description: "Investiga riesgos de corrupción de una entidad pública o contratista colombiano cruzando 8 fuentes de datos públicos: SECOP I+II, Contraloría, Procuraduría, Sanciones contractuales. Retorna score de riesgo, alertas y expediente.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Nombre de entidad pública, contratista o NIT. Ejemplos: UNGRD, ICBF, Ministerio Salud"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "comparar_entidades",
    description: "Compara el score de riesgo de corrupción entre múltiples entidades colombianas simultáneamente.",
    inputSchema: {
      type: "object",
      properties: {
        entidades: {
          type: "array",
          items: { type: "string" },
          description: "Lista de entidades a comparar. Máximo 4. Ejemplos: [UNGRD, ICBF, MinSalud]"
        }
      },
      required: ["entidades"]
    }
  }
];

async function investigarEntidad(query: string, origin: string) {
  const res = await fetch(
    `${origin}/api/agent/summary?q=${encodeURIComponent(query)}`,
    { signal: AbortSignal.timeout(60000), cache: "no-store" }
  );
  return await res.json();
}

async function compararEntidades(entidades: string[], origin: string) {
  const results = await Promise.allSettled(
    entidades.slice(0, 4).map(e => investigarEntidad(e, origin))
  );
  return results.map((r, i) => ({
    entidad: entidades[i],
    ...(r.status === "fulfilled" ? r.value : { error: true })
  }));
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { method, params } = body;
    const origin = new URL(req.url).origin;

    // MCP initialize
    if (method === "initialize") {
      return NextResponse.json({
        jsonrpc: "2.0",
        id: body.id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "neuraudit-mcp", version: "1.0.0" }
        }
      });
    }

    // MCP tools/list
    if (method === "tools/list") {
      return NextResponse.json({
        jsonrpc: "2.0",
        id: body.id,
        result: { tools: TOOLS }
      });
    }

    // MCP tools/call
    if (method === "tools/call") {
      const { name, arguments: args } = params;
      let result;

      if (name === "investigar_entidad") {
        result = await investigarEntidad(args.query, origin);
      } else if (name === "comparar_entidades") {
        result = await compararEntidades(args.entidades, origin);
      } else {
        return NextResponse.json({
          jsonrpc: "2.0",
          id: body.id,
          error: { code: -32601, message: `Tool not found: ${name}` }
        });
      }

      return NextResponse.json({
        jsonrpc: "2.0",
        id: body.id,
        result: {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        }
      });
    }

    return NextResponse.json({
      jsonrpc: "2.0",
      id: body.id,
      error: { code: -32601, message: `Method not found: ${method}` }
    });

  } catch (err: any) {
    return NextResponse.json({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32603, message: err.message }
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    name: "NeurAudit MCP Server",
    version: "1.0.0",
    description: "Sistema de inteligencia anticorrupción — contratación pública colombiana",
    tools: TOOLS.map(t => ({ name: t.name, description: t.description }))
  });
}

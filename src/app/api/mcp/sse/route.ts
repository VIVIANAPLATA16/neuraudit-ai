export const dynamic = "force-dynamic";

const TOOLS = [
  {
    name: "investigar_entidad",
    description: "Investiga riesgos de corrupción de una entidad pública colombiana cruzando 8 fuentes: SECOP I+II, Contraloría CGR, Procuraduría, Sanciones contractuales.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Nombre de entidad o NIT. Ejemplo: UNGRD, ICBF" }
      },
      required: ["query"]
    }
  },
  {
    name: "comparar_entidades",
    description: "Compara score de riesgo de corrupción entre múltiples entidades colombianas.",
    inputSchema: {
      type: "object",
      properties: {
        entidades: { type: "array", items: { type: "string" }, description: "Lista de entidades. Máximo 4." }
      },
      required: ["entidades"]
    }
  }
];

async function investigar(query: string, origin: string) {
  const res = await fetch(
    `${origin}/api/agent/summary?q=${encodeURIComponent(query)}`,
    { signal: AbortSignal.timeout(60000), cache: "no-store" }
  );
  return await res.json();
}

async function comparar(entidades: string[], origin: string) {
  const results = await Promise.allSettled(entidades.slice(0, 4).map(e => investigar(e, origin)));
  return results.map((r, i) => ({
    entidad: entidades[i],
    ...(r.status === "fulfilled" ? r.value : { error: true })
  }));
}

function sendEvent(controller: ReadableStreamDefaultController, event: string, data: any) {
  const encoder = new TextEncoder();
  controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId") || crypto.randomUUID();

  const stream = new ReadableStream({
    async start(controller) {
      // Send endpoint event for MCP over SSE
      sendEvent(controller, "endpoint", {
        uri: `${url.origin}/api/mcp/message?sessionId=${sessionId}`
      });
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    }
  });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { method, params, id } = body;
  const origin = new URL(req.url).origin;

  const respond = (result: any) => Response.json({ jsonrpc: "2.0", id, result });
  const error = (code: number, message: string) =>
    Response.json({ jsonrpc: "2.0", id, error: { code, message } });

  if (method === "initialize") {
    return respond({
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "neuraudit-mcp", version: "1.0.0" }
    });
  }

  if (method === "tools/list") {
    return respond({ tools: TOOLS });
  }

  if (method === "tools/call") {
    const { name, arguments: args } = params;
    let result;
    if (name === "investigar_entidad") result = await investigar(args.query, origin);
    else if (name === "comparar_entidades") result = await comparar(args.entidades, origin);
    else return error(-32601, `Tool not found: ${name}`);
    return respond({ content: [{ type: "text", text: JSON.stringify(result) }] });
  }

  return error(-32601, `Method not found: ${method}`);
}

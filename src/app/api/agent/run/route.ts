export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { tool } from "@langchain/core/tools";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { z } from "zod";

// HERRAMIENTA 1: Buscar contratos en 13 fuentes
const searchContracts = tool(
  async ({ query }: { query: string }) => {
    const res = await fetch(
      `https://neuraudit.vercel.app/api/agent/search?q=${encodeURIComponent(query)}`,
      { signal: AbortSignal.timeout(25000) }
    );
    const data = await res.json();
    const r = data.riesgo || {};
    const f = data.fuentes || {};
    return JSON.stringify({
      score: r.score,
      nivel: r.nivel,
      alertas: r.alertas,
      fuentes: f,
      totalContratos: r.totalContratos,
      entidadesUnicas: r.entidadesUnicas,
      directos: r.directos,
      fraccionados: r.fraccionados,
      valorTotal: r.valorTotal,
      montoCGR: r.montoCGR,
      montoSanc: r.montoSanc,
      totalSGR: r.totalSGR,
      sinCompetencia: r.sinCompetencia,
      fallosCGR: data.fallosResponsabilidadFiscal?.length || 0,
      sanciones: data.sancionesContractuales?.length || 0,
      procuraduria: data.registrosProcuraduria?.length || 0,
    });
  },
  {
    name: "search_contracts",
    description:
      "Busca contratos públicos colombianos en 13 fuentes simultáneas: SECOP I+II, CGR fallos fiscales, sanciones contractuales, Procuraduría, SGR Regalías. Detecta riesgos de corrupción, fraccionamiento, concentración e inhabilidades. Úsala SIEMPRE antes de analizar una entidad.",
    schema: z.object({
      query: z
        .string()
        .describe(
          "Nombre de entidad pública, contratista o NIT. Ejemplos: UNGRD, ICBF, Ministerio Salud, 900123456"
        ),
    }),
  }
);

// HERRAMIENTA 2: Comparar múltiples entidades
const compareEntities = tool(
  async ({ entities }: { entities: string[] }) => {
    const results = await Promise.allSettled(
      entities.map(async (entity) => {
        const res = await fetch(
          `https://neuraudit.vercel.app/api/agent/search?q=${encodeURIComponent(entity)}`,
          { signal: AbortSignal.timeout(20000) }
        );
        const data = await res.json();
        return {
          entity,
          score: data.riesgo?.score,
          nivel: data.riesgo?.nivel,
          total: data.fuentes?.total,
          valorTotal: data.riesgo?.valorTotal,
          alertas: data.riesgo?.alertas?.length,
        };
      })
    );
    return JSON.stringify(
      results.map((r) => (r.status === "fulfilled" ? r.value : { error: true }))
    );
  },
  {
    name: "compare_entities",
    description:
      "Compara el nivel de riesgo de corrupción entre múltiples entidades públicas colombianas simultáneamente.",
    schema: z.object({
      entities: z
        .array(z.string())
        .describe("Lista de entidades a comparar. Máximo 4."),
    }),
  }
);

// HERRAMIENTA 3: Buscar en SECOP II directamente por NIT
const searchByNit = tool(
  async ({ nit }: { nit: string }) => {
    const url = `https://www.datos.gov.co/resource/jbjy-vk9h.json?$limit=20&$where=nit_entidad='${nit}' OR documento_proveedor='${nit}'`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const data = await res.json();
    return JSON.stringify({
      contratos: data.length,
      muestra: data.slice(0, 5).map((c: any) => ({
        objeto: c.objeto_del_contrato?.substring(0, 100),
        entidad: c.nombre_entidad,
        valor: c.valor_del_contrato,
        modalidad: c.modalidad_de_contratacion,
        fecha: c.fecha_de_firma,
      })),
    });
  },
  {
    name: "search_by_nit",
    description:
      "Busca contratos en SECOP II usando el NIT específico de una entidad o contratista.",
    schema: z.object({
      nit: z.string().describe("NIT sin puntos ni guiones. Ejemplo: 899999239"),
    }),
  }
);

export async function POST(req: Request) {
  try {
    const { message } = await req.json();
    if (!message) {
      return NextResponse.json({ error: "Se requiere message" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY no configurada" },
        { status: 500 }
      );
    }

    const llm = new ChatGoogleGenerativeAI({
      model: "gemini-1.5-flash",
      apiKey,
      temperature: 0.1,
    });

    const agent = await createReactAgent({
      llm,
      tools: [searchContracts, compareEntities, searchByNit],
      messageModifier: `Eres NeurAudit AI, el primer agente de inteligencia anticorrupción para contratación pública colombiana.

Tu misión: detectar riesgos de corrupción en contratos del Estado colombiano usando datos reales de 13 fuentes públicas.

REGLAS ABSOLUTAS:
1. SIEMPRE usa search_contracts antes de analizar cualquier entidad
2. NUNCA inventes datos — todo debe venir de las herramientas
3. Responde en español
4. Muestra el razonamiento paso a paso

FORMATO DE RESPUESTA:
🎯 SCORE DE RIESGO: [X]/100 — [ALTO🔴 / MEDIO🟡 / BAJO🟢]

📊 REGISTROS ENCONTRADOS ([X] de 13 fuentes):
[detallar por fuente]

⚠️ ALERTAS CRÍTICAS:
[lista de alertas]

💰 IMPACTO ECONÓMICO:
[cifras exactas]

📋 EXPEDIENTE DIGITAL:
[análisis con contexto colombiano]

🏛️ ACCIONES RECOMENDADAS:
[para Contraloría, Procuraduría, ciudadanos]

⚖️ NORMATIVA: Ley 80/1993, Ley 1150/2007, Ley 1474/2011`,
    });

    const steps: string[] = [];
    const result = await agent.invoke(
      { messages: [{ role: "user", content: message }] },
      {
        callbacks: [
          {
            handleAgentAction(action: any) {
              steps.push(`🔍 Usando herramienta: ${action.tool} con "${JSON.stringify(action.toolInput)}"`);
            },
            handleToolEnd(output: string) {
              try {
                const data = JSON.parse(output);
                if (data.score !== undefined) {
                  steps.push(`📊 Resultado: Score ${data.score}/100, ${data.fuentes?.total} registros encontrados`);
                }
              } catch {
                steps.push(`✅ Herramienta completada`);
              }
            },
          },
        ],
      }
    );

    const lastMessage = result.messages[result.messages.length - 1];
    const response = typeof lastMessage.content === "string"
      ? lastMessage.content
      : JSON.stringify(lastMessage.content);

    return NextResponse.json({
      response,
      steps,
      model: "gemini-1.5-flash",
      tools_used: steps.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Agent error:", err);
    return NextResponse.json(
      { error: err.message || "Error del agente" },
      { status: 500 }
    );
  }
}

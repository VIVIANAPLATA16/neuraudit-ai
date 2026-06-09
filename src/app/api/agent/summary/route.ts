export const maxDuration = 300
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") || "";
  if (!query) return NextResponse.json({ error: "Se requiere q" }, { status: 400 });

  const origin = new URL(req.url).origin;
  const res = await fetch(
    `${origin}/api/agent/search?q=${encodeURIComponent(query)}`,
    { signal: AbortSignal.timeout(60000), cache: "no-store" }
  );

  if (!res.ok) {
    return NextResponse.json({ error: "Error en búsqueda" }, { status: res.status });
  }

  const data = await res.json();
  const r = data.riesgo || {};
  const f = data.fuentes || {};

  return NextResponse.json({
    entidad: query,
    score: r.score,
    nivel: r.nivel,
    alertas: r.alertas || [],
    score_breakdown: r.scoreBreakdown || [],
    hallazgos: r.hallazgos || [],
    recomendaciones: r.recomendaciones || [],
    fuentes_consultadas: f.total || 0,
    contratos_encontrados: r.totalContratos || 0,
    valor_total_cop: r.valorTotal || 0,
    fallos_cgr: f.cgr || 0,
    sanciones: f.sanciones || 0,
    sin_competencia: r.sinCompetencia || 0,
    contratacion_directa_pct:
      r.totalContratos > 0 ? Math.round((r.directos / r.totalContratos) * 100) : 0,
    impacto_fiscal_cgr_cop: r.montoCGR || 0,
    timestamp: data.timestamp || new Date().toISOString(),
  });
}

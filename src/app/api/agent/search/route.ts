export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

async function searchSecop(query: string) {
  const q = query.toUpperCase();
  const url = `https://www.datos.gov.co/resource/jbjy-vk9h.json?$limit=50&$where=upper(nombre_entidad) like '%25${q}%25' OR upper(proveedor_adjudicado) like '%25${q}%25'`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000), cache: "no-store" });
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) { console.error("SECOP error:", e); return []; }
}

async function searchContraloria(query: string) {
  const q = query.toUpperCase();
  // jr8e-e8tu — Responsabilidad Fiscal CGR — campo: raz_n_social_de_la_entidad
  const url = `https://www.datos.gov.co/resource/jr8e-e8tu.json?$limit=20&$where=upper(raz_n_social_de_la_entidad) like '%25${q}%25'`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000), cache: "no-store" });
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) { console.error("Contraloria error:", e); return []; }
}

async function searchSecopI(query: string) {
  const q = query.toUpperCase();
  const url = `https://www.datos.gov.co/resource/f789-7hwg.json?$limit=30&$where=upper(nombre_entidad) like '%25${q}%25' OR upper(descripcion_del_proceso) like '%25${q}%25'`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000), cache: "no-store" });
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) { console.error("SECOP I error:", e); return []; }
}

function calcularRiesgo(contratos: any[], contraloria: any[]) {
  const alertas: string[] = [];
  let score = 0;
  const total = contratos.length;
  const entidades = new Set(contratos.map((c) => c.nombre_entidad)).size;
  const directos = contratos.filter((c) =>
    (c.modalidad_de_contratacion || "").toLowerCase().includes("directa")
  ).length;
  const valorTotal = contratos.reduce((acc, c) => acc + (parseFloat(c.valor_del_contrato) || 0), 0);
  const montoContraloria = contraloria.reduce((acc, c) => {
    const m = parseFloat((c.monto_de_la_multa_o_sanci || "0").replace(/[$,\s]/g, ""));
    return acc + (isNaN(m) ? 0 : m);
  }, 0);

  if (total > 10 && entidades < 3) { score += 25; alertas.push(`Concentración: ${total} contratos en solo ${entidades} entidades`); }
  if (total > 0 && directos / total > 0.6) { score += 20; alertas.push(`${directos} de ${total} contratos por contratación directa (${Math.round(directos/total*100)}%)`); }
  if (contraloria.length > 0) {
    score += 35;
    alertas.push(`CRÍTICO: ${contraloria.length} fallo(s) de responsabilidad fiscal — impacto estimado $${(montoContraloria/1e9).toFixed(1)}B COP`);
  }
  if (valorTotal > 1_000_000_000) { score += 10; alertas.push(`Valor total contratado supera $${(valorTotal/1e9).toFixed(1)}B COP`); }

  return { score: Math.min(100, score), alertas, totalContratos: total, entidadesUnicas: entidades, directos, valorTotal, montoContraloria };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") || "";
  console.log(">>> query:", query);
  if (!query) return NextResponse.json({ error: "Se requiere parámetro q" }, { status: 400 });

  const [r1, r2, r3] = await Promise.allSettled([
    searchSecop(query),
    searchSecopI(query),
    searchContraloria(query),
  ]);

  const secopII    = r1.status === "fulfilled" ? r1.value : [];
  const secopI     = r2.status === "fulfilled" ? r2.value : [];
  const contraloria = r3.status === "fulfilled" ? r3.value : [];
  const contratos  = [...secopII, ...secopI];
  const riesgo = calcularRiesgo(contratos, contraloria);

  console.log(">>> resultados SECOP II:", secopII.length, "SECOP I:", secopI.length, "Contraloria:", contraloria.length);

  return NextResponse.json({
    query,
    fuentes: { secopII: secopII.length, secopI: secopI.length, contraloria: contraloria.length },
    riesgo,
    contratos: contratos.slice(0, 20),
    fallosResponsabilidadFiscal: contraloria,
    timestamp: new Date().toISOString(),
  });
}

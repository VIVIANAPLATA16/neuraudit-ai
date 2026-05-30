export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

const fetcher = async (url: string) => {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000), cache: "no-store" });
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch { return []; }
};

const q = (s: string) => s.toUpperCase();

const searchSecop    = (query: string) => fetcher(`https://www.datos.gov.co/resource/jbjy-vk9h.json?$limit=50&$where=upper(nombre_entidad) like '%25${q(query)}%25' OR upper(proveedor_adjudicado) like '%25${q(query)}%25'`);
const searchSecopI   = (query: string) => fetcher(`https://www.datos.gov.co/resource/f789-7hwg.json?$limit=30&$where=upper(nombre_entidad) like '%25${q(query)}%25' OR upper(descripcion_del_proceso) like '%25${q(query)}%25'`);
const searchProcesos = (query: string) => fetcher(`https://www.datos.gov.co/resource/p6dx-8zbt.json?$limit=20&$where=upper(entidad) like '%25${q(query)}%25' OR upper(nombre_del_proveedor) like '%25${q(query)}%25'`);
const searchEjecucion= (query: string) => fetcher(`https://www.datos.gov.co/resource/mfmm-jqmq.json?$limit=20&$where=upper(proveedor_adjudicado) like '%25${q(query)}%25' OR upper(nombre_entidad) like '%25${q(query)}%25'`);
const searchCGR      = (query: string) => fetcher(`https://www.datos.gov.co/resource/jr8e-e8tu.json?$limit=20&$where=upper(raz_n_social_de_la_entidad) like '%25${q(query)}%25'`);
const searchSanciones= (query: string) => fetcher(`https://www.datos.gov.co/resource/4n4q-k399.json?$limit=20&$where=upper(nombre_contratista) like '%25${q(query)}%25' OR upper(nombre_entidad) like '%25${q(query)}%25'`);

function calcularRiesgo(contratos: any[], procesos: any[], cgr: any[], sanciones: any[], ejecucion: any[]) {
  const alertas: string[] = [];
  let score = 0;
  const total = contratos.length;
  const entidades = new Set(contratos.map((c) => c.nombre_entidad)).size;
  const directos = contratos.filter((c) => (c.modalidad_de_contratacion || "").toLowerCase().includes("directa")).length;
  const valorTotal = contratos.reduce((acc, c) => acc + (parseFloat(c.valor_del_contrato) || 0), 0);
  const montoCGR = cgr.reduce((acc, c) => { const m = parseFloat((c.monto_de_la_multa_o_sanci || "0").replace(/[$,\s]/g, "")); return acc + (isNaN(m) ? 0 : m); }, 0);
  const montoSanc = sanciones.reduce((acc, c) => acc + (parseFloat(c.valor_sancion) || 0), 0);

  // Proveedor único en licitaciones
  const sinCompetencia = procesos.filter((p) => parseInt(p.proveedores_que_manifestaron || "0") <= 1).length;

  if (total > 10 && entidades < 3) { score += 25; alertas.push(`Concentración: ${total} contratos en ${entidades} entidades`); }
  if (total > 0 && directos / total > 0.6) { score += 20; alertas.push(`${directos}/${total} contratos por contratación directa (${Math.round(directos/total*100)}%)`); }
  if (cgr.length > 0) { score += 35; alertas.push(`CRÍTICO: ${cgr.length} fallo(s) fiscal(es) CGR — $${(montoCGR/1e9).toFixed(1)}B COP`); }
  if (sanciones.length > 0) { score += 20; alertas.push(`${sanciones.length} sanción(es) contractual(es) — $${(montoSanc/1e6).toFixed(0)}M COP`); }
  if (sinCompetencia > 2) { score += 15; alertas.push(`${sinCompetencia} proceso(s) adjudicados sin competencia real (≤1 proponente)`); }
  if (valorTotal > 1_000_000_000) { score += 10; alertas.push(`Valor total: $${(valorTotal/1e9).toFixed(1)}B COP`); }

  return { score: Math.min(100, score), alertas, totalContratos: total, entidadesUnicas: entidades, directos, valorTotal, montoCGR, montoSanc, sinCompetencia };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") || "";
  if (!query) return NextResponse.json({ error: "Se requiere parámetro q" }, { status: 400 });

  const [r1, r2, r3, r4, r5, r6] = await Promise.allSettled([
    searchSecop(query), searchSecopI(query), searchProcesos(query),
    searchEjecucion(query), searchCGR(query), searchSanciones(query),
  ]);

  const secopII   = r1.status === "fulfilled" ? r1.value : [];
  const secopI    = r2.status === "fulfilled" ? r2.value : [];
  const procesos  = r3.status === "fulfilled" ? r3.value : [];
  const ejecucion = r4.status === "fulfilled" ? r4.value : [];
  const cgr       = r5.status === "fulfilled" ? r5.value : [];
  const sanciones = r6.status === "fulfilled" ? r6.value : [];
  const contratos = [...secopII, ...secopI];
  const riesgo = calcularRiesgo(contratos, procesos, cgr, sanciones, ejecucion);

  console.log(`SECOP II:${secopII.length} I:${secopI.length} Proc:${procesos.length} Ejec:${ejecucion.length} CGR:${cgr.length} Sanc:${sanciones.length}`);

  return NextResponse.json({
    query,
    fuentes: { secopII: secopII.length, secopI: secopI.length, procesos: procesos.length, ejecucion: ejecucion.length, cgr: cgr.length, sanciones: sanciones.length },
    riesgo,
    contratos: contratos.slice(0, 20),
    procesosLicitacion: procesos.slice(0, 10),
    fallosResponsabilidadFiscal: cgr,
    sancionesContractuales: sanciones,
    timestamp: new Date().toISOString(),
  });
}

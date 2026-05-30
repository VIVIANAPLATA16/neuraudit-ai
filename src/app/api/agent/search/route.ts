export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

const fetcher = async (url: string) => {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000), cache: "no-store" });
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch { return []; }
};

const Q = (s: string) => s.toUpperCase();

const sources = {
  secopII:    (q: string) => fetcher(`https://www.datos.gov.co/resource/jbjy-vk9h.json?$limit=50&$where=upper(nombre_entidad) like '%25${Q(q)}%25' OR upper(proveedor_adjudicado) like '%25${Q(q)}%25'`),
  secopI:     (q: string) => fetcher(`https://www.datos.gov.co/resource/f789-7hwg.json?$limit=30&$where=upper(nombre_entidad) like '%25${Q(q)}%25' OR upper(descripcion_del_proceso) like '%25${Q(q)}%25'`),
  secopIalt:  (q: string) => fetcher(`https://www.datos.gov.co/resource/rpmr-utcd.json?$limit=20&$where=upper(nombre_de_la_entidad) like '%25${Q(q)}%25'`),
  procesos:   (q: string) => fetcher(`https://www.datos.gov.co/resource/p6dx-8zbt.json?$limit=20&$where=upper(entidad) like '%25${Q(q)}%25' OR upper(nombre_del_proveedor) like '%25${Q(q)}%25'`),
  ejecucion:  (q: string) => fetcher(`https://www.datos.gov.co/resource/mfmm-jqmq.json?$limit=20&$where=upper(proveedor_adjudicado) like '%25${Q(q)}%25' OR upper(nombre_entidad) like '%25${Q(q)}%25'`),
  cgr:        (q: string) => fetcher(`https://www.datos.gov.co/resource/jr8e-e8tu.json?$limit=20&$where=upper(raz_n_social_de_la_entidad) like '%25${Q(q)}%25'`),
  sanciones:  (q: string) => fetcher(`https://www.datos.gov.co/resource/4n4q-k399.json?$limit=20&$where=upper(nombre_contratista) like '%25${Q(q)}%25' OR upper(nombre_entidad) like '%25${Q(q)}%25'`),
  contadores: (q: string) => fetcher(`https://www.datos.gov.co/resource/fs36-azrv.json?$limit=20&$where=upper(contador) like '%25${Q(q)}%25'`),
};

function calcularRiesgo(contratos: any[], procesos: any[], cgr: any[], sanciones: any[], contadores: any[]) {
  const alertas: string[] = [];
  let score = 0;

  const total = contratos.length;
  const entidades = new Set(contratos.map((c) => c.nombre_entidad || c.nombre_de_la_entidad)).size;
  const directos = contratos.filter((c) => (c.modalidad_de_contratacion || "").toLowerCase().includes("directa")).length;
  const valorTotal = contratos.reduce((acc, c) => acc + (parseFloat(c.valor_del_contrato) || 0), 0);
  const montoCGR = cgr.reduce((acc, c) => { const m = parseFloat((c.monto_de_la_multa_o_sanci || "0").replace(/[$,\s]/g, "")); return acc + (isNaN(m) ? 0 : m); }, 0);
  const montoSanc = sanciones.reduce((acc, c) => acc + (parseFloat(c.valor_sancion) || 0), 0);
  const sinCompetencia = procesos.filter((p) => parseInt(p.proveedores_que_manifestaron || "0") <= 1).length;

  if (total > 10 && entidades < 3) { score += 25; alertas.push(`Concentración: ${total} contratos en ${entidades} entidades`); }
  if (total > 0 && directos / total > 0.6) { score += 20; alertas.push(`${directos}/${total} contratos por contratación directa (${Math.round(directos/total*100)}%)`); }
  if (cgr.length > 0) { score += 35; alertas.push(`CRÍTICO: ${cgr.length} fallo(s) CGR — $${(montoCGR/1e9).toFixed(1)}B COP en responsabilidad fiscal`); }
  if (sanciones.length > 0) { score += 20; alertas.push(`${sanciones.length} sanción(es) contractual(es) — $${(montoSanc/1e6).toFixed(0)}M COP`); }
  if (sinCompetencia > 2) { score += 15; alertas.push(`${sinCompetencia} proceso(s) sin competencia real (≤1 proponente)`); }
  if (contadores.length > 0) { score += 10; alertas.push(`${contadores.length} sanción(es) disciplinaria(s) a contador(es) vinculado(s)`); }
  if (valorTotal > 1_000_000_000) { score += 10; alertas.push(`Valor total contratado: $${(valorTotal/1e9).toFixed(1)}B COP`); }

  return { score: Math.min(100, score), alertas, totalContratos: total, entidadesUnicas: entidades, directos, valorTotal, montoCGR, montoSanc, sinCompetencia };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") || "";
  if (!query) return NextResponse.json({ error: "Se requiere parámetro q" }, { status: 400 });

  const results = await Promise.allSettled(Object.values(sources).map(fn => fn(query)));
  const [secopII, secopI, secopIalt, procesos, ejecucion, cgr, sanciones, contadores] =
    results.map(r => r.status === "fulfilled" ? r.value : []);

  const contratos = [...secopII, ...secopI, ...secopIalt];
  const riesgo = calcularRiesgo(contratos, procesos, cgr, sanciones, contadores);

  console.log(`[${query}] SECOP:${secopII.length}+${secopI.length}+${secopIalt.length} Proc:${procesos.length} Ejec:${ejecucion.length} CGR:${cgr.length} Sanc:${sanciones.length} Cont:${contadores.length}`);

  return NextResponse.json({
    query,
    fuentes: {
      secopII: secopII.length,
      secopI: secopI.length + secopIalt.length,
      procesos: procesos.length,
      ejecucion: ejecucion.length,
      cgr: cgr.length,
      sanciones: sanciones.length,
      contadores: contadores.length,
      total: secopII.length + secopI.length + secopIalt.length + procesos.length + ejecucion.length + cgr.length + sanciones.length + contadores.length,
    },
    riesgo,
    contratos: contratos.slice(0, 20),
    procesosLicitacion: procesos.slice(0, 10),
    fallosResponsabilidadFiscal: cgr,
    sancionesContractuales: sanciones,
    sancionesProfesionales: contadores,
    timestamp: new Date().toISOString(),
  });
}

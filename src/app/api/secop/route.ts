import { NextResponse } from "next/server";

export const dynamic = "force-static";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const encoded = encodeURIComponent(q.toUpperCase().replace(/'/g, "''"));
  const where =
    "upper(nombre_entidad)+like+%27%25" +
    encoded +
    "%25%27+OR+upper(descripcion_del_proceso)+like+%27%25" +
    encoded +
    "%25%27+OR+upper(proveedor_adjudicado)+like+%27%25" +
    encoded +
    "%25%27+OR+upper(objeto_del_contrato)+like+%27%25" +
    encoded +
    "%25%27";
  const url =
    "https://www.datos.gov.co/resource/jbjy-vk9h.json?$limit=200&$where=" +
    where;

  try {
    const res = await fetch(url, { headers: { "Accept": "application/json" } });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}

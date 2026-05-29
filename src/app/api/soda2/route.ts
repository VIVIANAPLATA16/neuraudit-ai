import { NextResponse } from "next/server";

export const dynamic = "force-static";

type DatasetConfig = {
  id: string;
  searchableFields: string[];
};

const DATASETS: Record<string, DatasetConfig> = {
  "jbjy-vk9h": {
    id: "jbjy-vk9h",
    searchableFields: [
      "nombre_entidad",
      "descripcion_del_proceso",
      "objeto_del_contrato",
      "proveedor_adjudicado",
      "modalidad_de_contratacion",
      "estado_contrato",
    ],
  },
  "dmgg-8hin": {
    id: "dmgg-8hin",
    searchableFields: [
      "nombre_entidad",
      "nombre_proceso",
      "descripcion_del_proceso",
      "nombre_archivo",
      "estado_proceso",
    ],
  },
  "3skv-9na7": {
    id: "3skv-9na7",
    searchableFields: [
      "nombre_entidad",
      "nombre_proceso",
      "descripcion_del_proceso",
      "nombre_archivo",
      "estado_proceso",
    ],
  },
};

function escapeForSocrataLike(input: string): string {
  return input.replace(/'/g, "''").trim();
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const dataset = searchParams.get("dataset") || "";
    const q = (searchParams.get("q") || "").trim();
    const limitRaw = Number(searchParams.get("limit") || "20");
    const limit = Math.min(100, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 20));

    const cfg = DATASETS[dataset];
    if (!cfg) {
      return NextResponse.json({ error: "dataset no soportado" }, { status: 400 });
    }

    let url = "https://www.datos.gov.co/resource/" + cfg.id + ".json?$limit=" + String(limit);
    if (q) {
      const safe = escapeForSocrataLike(q.toUpperCase());
      const clauses = cfg.searchableFields.map((f) => "upper(" + f + ") like '%" + safe + "%'");
      const where = clauses.join(" OR ");
      url += "&$where=" + encodeURIComponent(where);
    }

    const appToken = process.env.SOCRATA_APP_TOKEN;
    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (appToken) {
      headers["X-App-Token"] = appToken;
    }

    const response = await fetch(url, {
      headers,
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: "error consultando soda2", status: response.status, details: text.slice(0, 500) },
        { status: 502 },
      );
    }

    const data = await response.json();
    return NextResponse.json({ dataset, count: Array.isArray(data) ? data.length : 0, data });
  } catch (err) {
    return NextResponse.json(
      { error: "fallo interno en proxy soda2", details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

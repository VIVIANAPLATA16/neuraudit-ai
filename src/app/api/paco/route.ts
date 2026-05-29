import { NextResponse } from "next/server";

export const dynamic = "force-static";

const PACO_URL =
  "https://paco7public7info7prod.blob.core.windows.net/paco-pulic-info/responsabilidades_fiscales.csv";

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "\"") {
      if (inQuotes && line[i + 1] === "\"") {
        current += "\"";
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  out.push(current.trim());
  return out.map((v) => v.replace(/^"(.*)"$/, "$1").trim());
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim().toUpperCase();
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || "20")));
  if (!q) {
    return NextResponse.json({ rows: [], count: 0 });
  }

  try {
    const res = await fetch(PACO_URL, { headers: { Accept: "text/csv" } });
    if (!res.ok) {
      return NextResponse.json({ error: "No se pudo leer PACO CSV" }, { status: 502 });
    }
    const text = await res.text();
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    if (!lines.length) {
      return NextResponse.json({ rows: [], count: 0 });
    }
    const header = parseCsvLine(lines[0]);
    const matches: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvLine(lines[i]);
      const row: Record<string, string> = {};
      header.forEach((h, idx) => {
        row[h] = values[idx] || "";
      });
      const haystack = Object.values(row).join(" ").toUpperCase();
      if (haystack.includes(q)) {
        matches.push(row);
        if (matches.length >= limit) break;
      }
    }
    return NextResponse.json({ rows: matches, count: matches.length });
  } catch {
    return NextResponse.json({ error: "Error consultando PACO CSV" }, { status: 500 });
  }
}

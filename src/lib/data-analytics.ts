import type { SearchResult } from "./types"
import { formatCOP } from "./utils"

export interface ProveedorStats {
  nombre: string
  contratos: number
  valor: number
  valorFmt: string
  participacionPct: number
}

export interface EntidadRelacionada {
  nombre: string
  contratos: number
  valor: number
}

export interface ModalidadStats {
  modalidad: string
  count: number
  valor: number
}

export interface InvestigationAnalytics {
  topProveedores: ProveedorStats[]
  top10Proveedores: ProveedorStats[]
  topContratos: { entidad: string; proveedor: string; valor: number; valorFmt: string; modalidad: string }[]
  entidadesRelacionadas: EntidadRelacionada[]
  concentracionTop5Pct: number
  concentracionTop10Pct: number
  distribucionProveedores: ProveedorStats[]
  contratosRepetitivos: { proveedor: string; apariciones: number; valor: number }[]
  fraccionamiento: { count: number; contratos: string[] }
  riesgoPorModalidad: ModalidadStats[]
  riesgoCompetencia: { sinCompetencia: number; conCompetencia: number; pctSinCompetencia: number }
  riesgoPorMonto: { bajo: number; medio: number; alto: number; umbrales: string }
  riesgoRecurrencia: { proveedoresRecurrentes: number; maxRecurrencia: number }
  valorTotal: number
  valorTotalFmt: string
  totalContratos: number
}

function parseValor(c: Record<string, unknown>): number {
  return parseFloat(String(c.valor_del_contrato || c.valor || 0)) || 0
}

function parseProveedor(c: Record<string, unknown>): string {
  return String(c.proveedor_adjudicado || c.nombre_del_proveedor || "").trim()
}

function parseEntidad(c: Record<string, unknown>): string {
  return String(c.nombre_entidad || c.nombre_de_la_entidad || c.entidad || "").trim()
}

function parseModalidad(c: Record<string, unknown>): string {
  return String(c.modalidad_de_contratacion || c.modalidad || "No especificada").trim()
}

export function buildInvestigationAnalytics(result: SearchResult): InvestigationAnalytics {
  const contratos = result.contratos || []
  const valorTotal = result.riesgo.valorTotal || contratos.reduce((s, c) => s + parseValor(c), 0)

  const provMap = new Map<string, { count: number; valor: number }>()
  const entMap = new Map<string, { count: number; valor: number }>()
  const modMap = new Map<string, { count: number; valor: number }>()
  const fraccionados: string[] = []

  contratos.forEach((c) => {
    const val = parseValor(c)
    const prov = parseProveedor(c)
    const ent = parseEntidad(c)
    const mod = parseModalidad(c)

    if (prov) {
      const cur = provMap.get(prov) || { count: 0, valor: 0 }
      provMap.set(prov, { count: cur.count + 1, valor: cur.valor + val })
    }
    if (ent) {
      const cur = entMap.get(ent) || { count: 0, valor: 0 }
      entMap.set(ent, { count: cur.count + 1, valor: cur.valor + val })
    }
    const mcur = modMap.get(mod) || { count: 0, valor: 0 }
    modMap.set(mod, { count: mcur.count + 1, valor: mcur.valor + val })

    if (val > 0 && val < 130000000 && val > 120000000) {
      fraccionados.push(`${prov || ent} — ${formatCOP(val)}`)
    }
  })

  const toStats = (entries: [string, { count: number; valor: number }][]): ProveedorStats[] =>
    entries
      .sort((a, b) => b[1].valor - a[1].valor)
      .map(([nombre, { count, valor }]) => ({
        nombre,
        contratos: count,
        valor,
        valorFmt: formatCOP(valor),
        participacionPct: valorTotal > 0 ? Math.round((valor / valorTotal) * 100) : 0,
      }))

  const allProv = toStats([...provMap.entries()])
  const top5Val = allProv.slice(0, 5).reduce((s, p) => s + p.valor, 0)
  const top10Val = allProv.slice(0, 10).reduce((s, p) => s + p.valor, 0)

  const topContratos = [...contratos]
    .map((c) => ({
      entidad: parseEntidad(c),
      proveedor: parseProveedor(c),
      valor: parseValor(c),
      valorFmt: formatCOP(parseValor(c)),
      modalidad: parseModalidad(c),
    }))
    .filter((c) => c.valor > 0)
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 10)

  const entidadesRelacionadas = [...entMap.entries()]
    .sort((a, b) => b[1].valor - a[1].valor)
    .slice(0, 10)
    .map(([nombre, { count, valor }]) => ({ nombre, contratos: count, valor }))

  const riesgoPorModalidad = [...modMap.entries()]
    .map(([modalidad, { count, valor }]) => ({ modalidad, count, valor }))
    .sort((a, b) => b.valor - a.valor)

  const sinComp = result.riesgo.sinCompetencia
  const procTotal = result.fuentes.procesos || sinComp
  const conComp = Math.max(0, procTotal - sinComp)

  const montos = contratos.map(parseValor).filter((v) => v > 0)
  const bajo = montos.filter((v) => v < 100_000_000).length
  const medio = montos.filter((v) => v >= 100_000_000 && v < 500_000_000).length
  const alto = montos.filter((v) => v >= 500_000_000).length

  const recurrentes = allProv.filter((p) => p.contratos >= 2)
  const maxRec = recurrentes.length > 0 ? Math.max(...recurrentes.map((p) => p.contratos)) : 0

  return {
    topProveedores: allProv.slice(0, 5),
    top10Proveedores: allProv.slice(0, 10),
    topContratos,
    entidadesRelacionadas,
    concentracionTop5Pct: valorTotal > 0 ? Math.round((top5Val / valorTotal) * 100) : 0,
    concentracionTop10Pct: valorTotal > 0 ? Math.round((top10Val / valorTotal) * 100) : 0,
    distribucionProveedores: allProv.slice(0, 15),
    contratosRepetitivos: recurrentes.map((p) => ({
      proveedor: p.nombre,
      apariciones: p.contratos,
      valor: p.valor,
    })),
    fraccionamiento: { count: result.riesgo.fraccionados || fraccionados.length, contratos: fraccionados.slice(0, 5) },
    riesgoPorModalidad,
    riesgoCompetencia: {
      sinCompetencia: sinComp,
      conCompetencia: conComp,
      pctSinCompetencia: procTotal > 0 ? Math.round((sinComp / procTotal) * 100) : 0,
    },
    riesgoPorMonto: {
      bajo,
      medio,
      alto,
      umbrales: "<$100M bajo · $100M-$500M medio · >$500M alto",
    },
    riesgoRecurrencia: { proveedoresRecurrentes: recurrentes.length, maxRecurrencia: maxRec },
    valorTotal,
    valorTotalFmt: formatCOP(valorTotal),
    totalContratos: result.riesgo.totalContratos,
  }
}

export function analyticsToPromptContext(analytics: InvestigationAnalytics, result: SearchResult): string {
  return JSON.stringify(
    {
      entidad: result.query,
      score: result.riesgo,
      fuentes: result.fuentes,
      interpretacion: result.interpretacion,
      analytics,
      muestraContratos: result.contratos?.slice(0, 25),
      fallosCGR: result.fallosResponsabilidadFiscal?.length,
      procuraduria: result.registrosProcuraduria?.length,
      sanciones: result.sancionesContractuales?.length,
    },
    null,
    2
  )
}

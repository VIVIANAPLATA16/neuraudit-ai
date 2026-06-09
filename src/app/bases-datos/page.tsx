"use client";

import { useEffect, useMemo, useState } from "react";
import { Database, RefreshCcw, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";

type DatabaseItem = {
  id: string;
  nombre: string;
  descripcion: string;
  estado: string;
  fuente: string;
  apiSoda2: string;
  datasetId: string;
  sourceType: "soda2" | "csvApi";
  filterColumn?: string;
  filterColumns?: string[];
  docsUrl?: string;
  usoSugerido: string[];
};

const SEARCH_FIELDS_BY_DATASET: Record<string, string[]> = {
  "jbjy-vk9h": [
    "nombre_entidad",
    "descripcion_del_proceso",
    "objeto_del_contrato",
    "proveedor_adjudicado",
    "modalidad_de_contratacion",
    "estado_contrato",
  ],
  "dmgg-8hin": [
    "nombre_entidad",
    "nombre_proceso",
    "descripcion_del_proceso",
    "nombre_archivo",
    "estado_proceso",
  ],
  "3skv-9na7": [
    "nombre_entidad",
    "nombre_proceso",
    "descripcion_del_proceso",
    "nombre_archivo",
    "estado_proceso",
  ],
};

const API3_FILTER_COLUMNS = [
  "nombre_entidad",
  "nit_entidad",
  "departamento",
  "ciudad",
  "localizaci_n",
  "orden",
  "sector",
  "rama",
  "entidad_centralizada",
  "proceso_de_compra",
  "id_contrato",
  "referencia_del_contrato",
  "estado_contrato",
  "codigo_de_categoria_principal",
  "descripcion_del_proceso",
  "tipo_de_contrato",
  "modalidad_de_contratacion",
  "justificacion_modalidad_de_contratacion",
  "fecha_de_firma",
  "fecha_de_inicio_del_contrato",
  "fecha_de_fin_del_contrato",
  "condiciones_de_entrega",
  "tipodocproveedor",
  "documento_proveedor",
  "proveedor_adjudicado",
  "es_grupo",
  "es_pyme",
  "habilita_pago_adelantado",
  "liquidaci_n",
  "obligaci_n_ambiental",
  "obligaciones_postconsumo",
  "reversion",
  "origen_de_los_recursos",
  "destino_gasto",
  "valor_del_contrato",
  "valor_de_pago_adelantado",
  "valor_facturado",
  "valor_pendiente_de_pago",
  "valor_pagado",
  "valor_amortizado",
  "valor_pendiente_de_amortizacion",
  "valor_pendiente_de_ejecucion",
  "saldo_cdp",
  "saldo_vigencia",
  "espostconflicto",
  "dias_adicionados",
  "puntos_del_acuerdo",
  "pilares_del_acuerdo",
  "urlproceso",
  "nombre_representante_legal",
  "nacionalidad_representante_legal",
  "domicilio_representante_legal",
  "tipo_de_identificaci_n_representante_legal",
  "identificaci_n_representante_legal",
  "g_nero_representante_legal",
  "presupuesto_general_de_la_nacion_pgn",
  "sistema_general_de_participaciones",
  "sistema_general_de_regal_as",
  "recursos_propios_alcald_as_gobernaciones_y_resguardos_ind_genas",
  "recursos_de_credito",
  "recursos_propios",
  "ultima_actualizacion",
  "codigo_entidad",
  "codigo_proveedor",
  "fecha_inicio_liquidacion",
  "fecha_fin_liquidacion",
  "objeto_del_contrato",
  "duraci_n_del_contrato",
  "nombre_del_banco",
  "tipo_de_cuenta",
  "n_mero_de_cuenta",
  "el_contrato_puede_ser_prorrogado",
  "fecha_de_notificaci_n_de_prorrogaci_n",
  "nombre_ordenador_del_gasto",
  "tipo_de_documento_ordenador_del_gasto",
  "n_mero_de_documento_ordenador_del_gasto",
  "nombre_supervisor",
  "tipo_de_documento_supervisor",
  "n_mero_de_documento_supervisor",
  "nombre_ordenador_de_pago",
  "tipo_de_documento_ordenador_de_pago",
  "n_mero_de_documento_ordenador_de_pago",
  "documentos_tipo",
  "descripcion_documentos_tipo",
];

const BASES_DATOS: DatabaseItem[] = [
  {
    id: "bd1",
    nombre: "SECOP II - Contratos Electrónicos",
    descripcion: "Contratos electrónicos y metadatos principales publicados en SECOP II.",
    estado: "Activa",
    fuente: "Datos Abiertos Colombia",
    apiSoda2: "https://www.datos.gov.co/resource/jbjy-vk9h.json",
    datasetId: "jbjy-vk9h",
    sourceType: "soda2",
    usoSugerido: [
      "Buscar contratos por entidad, modalidad y estado",
      "Cruzar objeto contractual con alertas de riesgo",
      "Construir métricas de transparencia y competencia",
    ],
  },
  {
    id: "bd2",
    nombre: "SECOP II - Archivos Descarga Desde 2025",
    descripcion: "Repositorio de archivos descargables y registros relacionados desde 2025.",
    estado: "Activa",
    fuente: "Datos Abiertos Colombia",
    apiSoda2: "https://www.datos.gov.co/resource/dmgg-8hin.json",
    datasetId: "dmgg-8hin",
    sourceType: "soda2",
    usoSugerido: [
      "Auditar documentos de soporte por proceso",
      "Verificar trazabilidad entre contrato y anexos",
      "Detectar vacíos documentales para control interno",
    ],
  },
  {
    id: "bd3",
    nombre: "API CSV S3 - Contratos Electrónicos (AWS)",
    descripcion: "API FastAPI desplegada en AWS Lambda para consultar CSV en S3 (preview + filtro).",
    estado: "Activa",
    fuente: "AWS API Gateway + S3",
    apiSoda2: "https://pqcu3eipqg.execute-api.us-east-1.amazonaws.com",
    datasetId: "api3-csv-s3",
    sourceType: "csvApi",
    filterColumn: "nombre_entidad",
    filterColumns: API3_FILTER_COLUMNS,
    docsUrl: "https://pqcu3eipqg.execute-api.us-east-1.amazonaws.com/docs",
    usoSugerido: [
      "Consultar preview del CSV alojado en S3",
      "Filtrar por columna (entidad, id_documento, proceso, etc.)",
      "Paginar resultados para análisis operativo en auditoría",
    ],
  },
];

export default function BasesDatosPage() {
  const [loadingById, setLoadingById] = useState<Record<string, boolean>>({});
  const [queryById, setQueryById] = useState<Record<string, string>>({});
  const [errorById, setErrorById] = useState<Record<string, string>>({});
  const [rowsById, setRowsById] = useState<Record<string, Record<string, unknown>[]>>({});
  const [countById, setCountById] = useState<Record<string, number>>({});
  const [lastFetchById, setLastFetchById] = useState<Record<string, string>>({});
  const [selectedFilterColumnById, setSelectedFilterColumnById] = useState<Record<string, string>>({});

  const initialHintById = useMemo(
    () =>
      BASES_DATOS.reduce<Record<string, string>>((acc, db) => {
        if (db.datasetId === "jbjy-vk9h") acc[db.id] = "Ej: ICBF, Invias, Bogotá";
        else if (db.datasetId === "dmgg-8hin") acc[db.id] = "Ej: pliego, adenda, contrato";
        else acc[db.id] = "Ej: hospital, 633838674, CO1.BDOS.0001";
        return acc;
      }, {}),
    [],
  );

  const fetchDataset = async (db: DatabaseItem, queryOverride?: string) => {
    const query = (queryOverride ?? queryById[db.id] ?? "").trim();
    setLoadingById((prev) => ({ ...prev, [db.id]: true }));
    setErrorById((prev) => ({ ...prev, [db.id]: "" }));
    try {
      if (db.sourceType === "csvApi") {
        const base = db.apiSoda2.replace(/\/$/, "");
        let url = base + "/csv/preview?limit=12";
        if (query) {
          const col = selectedFilterColumnById[db.id] || db.filterColumn || "entidad";
          url =
            base +
            "/csv/filter?column=" +
            encodeURIComponent(col) +
            "&value=" +
            encodeURIComponent(query) +
            "&mode=contains&limit=12&offset=0";
        }
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        const payload = await res.json();
        if (!res.ok) {
          throw new Error(payload?.detail || payload?.message || "No se pudo consultar API CSV");
        }
        const data = Array.isArray(payload?.rows) ? payload.rows : [];
        const total = typeof payload?.total_rows === "number"
          ? payload.total_rows
          : typeof payload?.total_matches === "number"
            ? payload.total_matches
            : data.length;
        setRowsById((prev) => ({ ...prev, [db.id]: data as Record<string, unknown>[] }));
        setCountById((prev) => ({ ...prev, [db.id]: total }));
      } else {
        let url =
          "https://www.datos.gov.co/resource/" +
          db.datasetId +
          ".json?$limit=12";
        if (query) {
          const safe = query.toUpperCase().replace(/'/g, "''");
          const fields = SEARCH_FIELDS_BY_DATASET[db.datasetId] || [];
          const where = fields.map((f) => "upper(" + f + ") like '%" + safe + "%'").join(" OR ");
          if (where) {
            url += "&$where=" + encodeURIComponent(where);
          }
        }
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        const payload = await res.json();
        if (!res.ok) {
          throw new Error(payload?.message || payload?.error || "No se pudo consultar la API Soda2");
        }
        const data = Array.isArray(payload) ? payload : [];
        setRowsById((prev) => ({ ...prev, [db.id]: data as Record<string, unknown>[] }));
        setCountById((prev) => ({ ...prev, [db.id]: data.length }));
      }
      setLastFetchById((prev) => ({ ...prev, [db.id]: new Date().toISOString() }));
    } catch (err) {
      setErrorById((prev) => ({
        ...prev,
        [db.id]: err instanceof Error ? err.message : "Error desconocido en la consulta",
      }));
    } finally {
      setLoadingById((prev) => ({ ...prev, [db.id]: false }));
    }
  };

  const getColumns = (rows: Record<string, unknown>[]) => {
    if (!rows.length) return [];
    return Object.keys(rows[0]).slice(0, 6);
  };

  const formatCell = (value: unknown) => {
    if (value === null || value === undefined || value === "") return "—";
    const str = String(value);
    return str.length > 90 ? str.slice(0, 90) + "..." : str;
  };

  const totalRegistros = BASES_DATOS.reduce((acc, db) => acc + (countById[db.id] || 0), 0);

  const entidadesAprox = useMemo(() => {
    const keys = ["nombre_entidad", "entidad", "nombre_de_la_entidad", "entidad_compradora"];
    const unique = new Set<string>();
    BASES_DATOS.forEach((db) => {
      const rows = rowsById[db.id] || [];
      rows.forEach((row) => {
        for (const key of keys) {
          const val = row[key];
          if (typeof val === "string" && val.trim()) {
            unique.add(val.trim().toUpperCase());
            break;
          }
        }
      });
    });
    return unique.size;
  }, [rowsById]);

  const ultimaActualizacionGlobal = useMemo(() => {
    const allDates = Object.values(lastFetchById)
      .map((d) => new Date(d))
      .filter((d) => !Number.isNaN(d.getTime()));
    if (!allDates.length) return "Sin actualización aún";
    const latest = allDates.sort((a, b) => b.getTime() - a.getTime())[0];
    return latest.toLocaleString("es-CO");
  }, [lastFetchById]);

  const datasetsActivos = BASES_DATOS.filter((db) => db.estado === "Activa").length;

  useEffect(() => {
    BASES_DATOS.forEach((db) => {
      fetchDataset(db, "");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppShell
      title="Fuentes de Datos"
      subtitle="Consulta directa a APIs Soda2 de datos.gov.co y AWS CSV"
    >
      {/* KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Registros visibles", value: totalRegistros.toLocaleString("es-CO") },
          { label: "Entidades únicas", value: entidadesAprox.toLocaleString("es-CO") },
          { label: "Última consulta", value: ultimaActualizacionGlobal, small: true },
          { label: "Datasets activos", value: String(datasetsActivos) },
        ].map((kpi) => (
          <div key={kpi.label} className="glass rounded-2xl p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">{kpi.label}</p>
            <p className={`font-bold text-foreground ${kpi.small ? "text-sm" : "text-3xl"}`}>{kpi.value}</p>
          </div>
        ))}
      </section>

      {/* Datasets */}
      <section className="grid gap-6 grid-cols-1 xl:grid-cols-2">
        {BASES_DATOS.map((db) => (
          <article key={db.id} className="glass rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-xs text-primary font-semibold uppercase tracking-wider">
              <Database className="size-4" />
              Base de datos
            </div>
            <h2 className="text-lg font-semibold text-foreground">{db.nombre}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{db.descripcion}</p>

            <div className="grid gap-2 text-sm">
              <div className="flex gap-2">
                <span className="text-muted-foreground">Estado:</span>
                <span className={db.estado === "Activa" ? "text-success" : "text-warning"}>{db.estado}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground">Fuente:</span>
                <span className="text-foreground">{db.fuente}</span>
              </div>
              <div>
                <span className="text-muted-foreground text-sm">
                  {db.sourceType === "csvApi" ? "API Base:" : "API Soda2:"}
                </span>
                <div className="mt-2 p-3 rounded-xl bg-muted/30 border border-border font-mono text-xs text-muted-foreground break-all">
                  {db.apiSoda2}
                </div>
              </div>
              {db.docsUrl && (
                <div>
                  <span className="text-muted-foreground">Docs: </span>
                  <a
                    href={db.docsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline font-medium"
                  >
                    Swagger /docs
                  </a>
                </div>
              )}
            </div>

            <div className="glass rounded-xl p-4 space-y-3">
              {db.sourceType === "csvApi" && (
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs text-muted-foreground font-medium">Columna filtro:</span>
                  <select
                    value={selectedFilterColumnById[db.id] || db.filterColumn || "entidad"}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSelectedFilterColumnById((prev) => ({ ...prev, [db.id]: value }));
                      fetchDataset(db, queryById[db.id] || "");
                    }}
                    className="glass rounded-lg px-3 py-2 text-xs text-foreground bg-transparent border border-border"
                  >
                    {(db.filterColumns || [db.filterColumn || "entidad"]).map((column) => (
                      <option key={column} value={column}>
                        {column}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-2">
                <input
                  value={queryById[db.id] || ""}
                  placeholder={initialHintById[db.id]}
                  onChange={(e) => setQueryById((prev) => ({ ...prev, [db.id]: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && fetchDataset(db)}
                  className="flex-1 glass rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground bg-transparent border border-border focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button
                  type="button"
                  onClick={() => fetchDataset(db)}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium flex items-center gap-1.5 hover:bg-primary/90 transition-colors"
                >
                  <Search className="size-3.5" />
                  Buscar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setQueryById((prev) => ({ ...prev, [db.id]: "" }));
                    fetchDataset(db, "");
                  }}
                  className="px-3 py-2 rounded-lg glass border border-border text-muted-foreground text-xs font-medium flex items-center gap-1.5 hover:text-foreground transition-colors"
                >
                  <RefreshCcw className="size-3.5" />
                  Reset
                </button>
              </div>

              <p className="text-xs text-muted-foreground">
                {loadingById[db.id]
                  ? "Consultando API..."
                  : `Registros: ${countById[db.id] || 0}${
                      lastFetchById[db.id]
                        ? ` · ${new Date(lastFetchById[db.id]).toLocaleTimeString("es-CO")}`
                        : ""
                    }`}
              </p>

              {errorById[db.id] && (
                <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                  {errorById[db.id]}
                </div>
              )}

              {!!rowsById[db.id]?.length && (
                <div className="rounded-xl border border-border overflow-auto max-h-64">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/30 text-muted-foreground">
                        {getColumns(rowsById[db.id] || []).map((col) => (
                          <th key={col} className="text-left p-2 whitespace-nowrap font-medium">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(rowsById[db.id] || []).map((row, idx) => (
                        <tr key={idx} className="border-t border-border/50">
                          {getColumns(rowsById[db.id] || []).map((col) => (
                            <td key={col} className="p-2 text-foreground align-top">
                              {formatCell(row[col])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Uso sugerido</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                {db.usoSugerido.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </section>
    </AppShell>
  );
}

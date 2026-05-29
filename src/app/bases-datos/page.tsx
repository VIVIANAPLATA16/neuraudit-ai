"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Database, RefreshCcw, Search } from "lucide-react";

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
    <main
      style={{
        minHeight: "100vh",
        background: "#EEF2F7",
        fontFamily: "Segoe UI, Arial, sans-serif",
        color: "#1D2B3A",
      }}
    >
      <header
        style={{
          background: "#003366",
          color: "#fff",
          padding: "16px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 18, letterSpacing: 0.4 }}>
            Fuentes de Datos para Auditoría
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "rgba(255,255,255,0.8)" }}>
            Versión productiva consumiendo directo APIs Soda2 de datos.gov.co
          </p>
        </div>
        <Link
          href="/"
          style={{
            background: "#F5A800",
            color: "#003366",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 700,
            fontSize: 12,
            padding: "8px 12px",
          }}
        >
          Volver al analizador
        </Link>
      </header>

      <section
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "24px 24px 12px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          <div
            style={{
              background: "#fff",
              border: "1px solid #DDE3EC",
              borderRadius: 10,
              padding: 14,
            }}
          >
            <div style={{ fontSize: 10, color: "#003366", fontWeight: 700, letterSpacing: 1.3 }}>
              KPI 01
            </div>
            <div style={{ marginTop: 4, fontSize: 28, color: "#003366", fontWeight: 800 }}>
              {totalRegistros.toLocaleString("es-CO")}
            </div>
            <div style={{ fontSize: 12, color: "#5B6E86" }}>Total registros visibles</div>
          </div>

          <div
            style={{
              background: "#fff",
              border: "1px solid #DDE3EC",
              borderRadius: 10,
              padding: 14,
            }}
          >
            <div style={{ fontSize: 10, color: "#003366", fontWeight: 700, letterSpacing: 1.3 }}>
              KPI 02
            </div>
            <div style={{ marginTop: 4, fontSize: 28, color: "#003366", fontWeight: 800 }}>
              {entidadesAprox.toLocaleString("es-CO")}
            </div>
            <div style={{ fontSize: 12, color: "#5B6E86" }}>Entidades únicas aproximadas</div>
          </div>

          <div
            style={{
              background: "#fff",
              border: "1px solid #DDE3EC",
              borderRadius: 10,
              padding: 14,
            }}
          >
            <div style={{ fontSize: 10, color: "#003366", fontWeight: 700, letterSpacing: 1.3 }}>
              KPI 03
            </div>
            <div style={{ marginTop: 7, fontSize: 15, color: "#003366", fontWeight: 800 }}>
              {ultimaActualizacionGlobal}
            </div>
            <div style={{ fontSize: 12, color: "#5B6E86", marginTop: 9 }}>
              Última actualización de consulta
            </div>
          </div>

          <div
            style={{
              background: "#fff",
              border: "1px solid #DDE3EC",
              borderRadius: 10,
              padding: 14,
            }}
          >
            <div style={{ fontSize: 10, color: "#003366", fontWeight: 700, letterSpacing: 1.3 }}>
              KPI 04
            </div>
            <div style={{ marginTop: 4, fontSize: 28, color: "#003366", fontWeight: 800 }}>
              {datasetsActivos}
            </div>
            <div style={{ fontSize: 12, color: "#5B6E86" }}>Datasets activos conectados</div>
          </div>
        </div>
      </section>

      <section
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 24px 24px",
          display: "grid",
          gap: 14,
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        }}
      >
        {BASES_DATOS.map((db) => (
          <article
            key={db.id}
            style={{
              background: "#fff",
              border: "1px solid #DDE3EC",
              borderRadius: 10,
              padding: 16,
              boxShadow: "0 4px 12px rgba(0, 51, 102, 0.07)",
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: "#003366", letterSpacing: 1.4 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Database size={13} />
                BASE DE DATOS
              </span>
            </div>
            <h2 style={{ margin: "8px 0 10px", color: "#003366", fontSize: 16 }}>{db.nombre}</h2>
            <p style={{ margin: "0 0 12px", fontSize: 13, lineHeight: 1.5 }}>{db.descripcion}</p>

            <div style={{ display: "grid", gap: 8, fontSize: 12 }}>
              <div>
                <strong>Estado:</strong>{" "}
                <span style={{ color: db.estado === "Activa" ? "#2E7D32" : "#E65100" }}>
                  {db.estado}
                </span>
              </div>
              <div>
                <strong>Fuente:</strong> {db.fuente}
              </div>
              <div>
                <strong>{db.sourceType === "csvApi" ? "API Base:" : "API Soda2:"}</strong>
                <div
                  style={{
                    marginTop: 6,
                    background: "#F5F7FA",
                    border: "1px dashed #B8C5D8",
                    borderRadius: 8,
                    padding: "7px 9px",
                    fontFamily: "monospace",
                    fontSize: 11,
                    wordBreak: "break-all",
                  }}
                >
                  {db.apiSoda2}
                </div>
              </div>
              {db.docsUrl && (
                <div>
                  <strong>Docs:</strong>{" "}
                  <a
                    href={db.docsUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "#003366", fontWeight: 700 }}
                  >
                    Swagger /docs
                  </a>
                </div>
              )}
            </div>

            <div
              style={{
                marginTop: 12,
                background: "#F8FAFD",
                border: "1px solid #DDE3EC",
                borderRadius: 10,
                padding: 10,
              }}
            >
              {db.sourceType === "csvApi" && (
                <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 11, color: "#003366", fontWeight: 700 }}>Columna filtro:</div>
                  <select
                    value={selectedFilterColumnById[db.id] || db.filterColumn || "entidad"}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSelectedFilterColumnById((prev) => ({ ...prev, [db.id]: value }));
                      fetchDataset(db, queryById[db.id] || "");
                    }}
                    style={{
                      border: "1px solid #DDE3EC",
                      borderRadius: 8,
                      padding: "6px 8px",
                      fontSize: 11,
                      color: "#003366",
                      background: "#fff",
                    }}
                  >
                    {(db.filterColumns || [db.filterColumn || "entidad"]).map((column) => (
                      <option key={column} value={column}>
                        {column}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={queryById[db.id] || ""}
                  placeholder={initialHintById[db.id]}
                  onChange={(e) => {
                    setQueryById((prev) => ({ ...prev, [db.id]: e.target.value }));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      fetchDataset(db);
                    }
                  }}
                  style={{
                    flex: 1,
                    border: "1px solid #DDE3EC",
                    borderRadius: 8,
                    padding: "8px 10px",
                    fontSize: 12,
                    outline: "none",
                    background: "#fff",
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    fetchDataset(db);
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#00264D";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#003366";
                  }}
                  style={{
                    border: "none",
                    borderRadius: 8,
                    padding: "8px 10px",
                    background: "#003366",
                    color: "#fff",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: 11,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Search size={14} />
                  Buscar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setQueryById((prev) => ({ ...prev, [db.id]: "" }));
                    fetchDataset(db, "");
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#E8EDF6";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#F5F7FA";
                  }}
                  style={{
                    border: "1px solid #DDE3EC",
                    borderRadius: 8,
                    padding: "8px 10px",
                    background: "#F5F7FA",
                    color: "#003366",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: 11,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <RefreshCcw size={13} />
                  Reset
                </button>
              </div>

              <div style={{ marginTop: 8, fontSize: 11, color: "#567", minHeight: 16 }}>
                {loadingById[db.id]
                  ? "Consultando API Soda2..."
                  : "Registros cargados: " +
                    String(countById[db.id] || 0) +
                    (lastFetchById[db.id]
                      ? " · actualizado " +
                        new Date(lastFetchById[db.id]).toLocaleTimeString("es-CO")
                      : "")}
              </div>
              {errorById[db.id] && (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 11,
                    color: "#C62828",
                    background: "#FFEBEE",
                    border: "1px solid #EF9A9A",
                    borderRadius: 8,
                    padding: "6px 8px",
                  }}
                >
                  {errorById[db.id]}
                </div>
              )}

              {!!rowsById[db.id]?.length && (
                <div
                  style={{
                    marginTop: 8,
                    border: "1px solid #DDE3EC",
                    borderRadius: 8,
                    overflow: "auto",
                    maxHeight: 260,
                    background: "#fff",
                  }}
                >
                  <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: "#EEF3FA" }}>
                        {getColumns(rowsById[db.id] || []).map((col) => (
                          <th
                            key={col}
                            style={{
                              borderBottom: "1px solid #DDE3EC",
                              textAlign: "left",
                              color: "#003366",
                              padding: "8px 9px",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(rowsById[db.id] || []).map((row, idx) => (
                        <tr key={idx}>
                          {getColumns(rowsById[db.id] || []).map((col) => (
                            <td
                              key={col}
                              style={{
                                borderBottom: "1px solid #EEF2F7",
                                padding: "7px 9px",
                                color: "#324A63",
                                verticalAlign: "top",
                              }}
                            >
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

            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#003366", marginBottom: 6 }}>
                Uso sugerido
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.6 }}>
                {db.usoSugerido.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

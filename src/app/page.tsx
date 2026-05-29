"use client";

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { AlertTriangle, CheckSquare, ExternalLink, Paperclip } from "lucide-react";
import {
  CONTRACT_CONFIDENCE_MIN,
  detectContractConfidence,
} from "@/lib/contractConfidence";
import mammoth from "mammoth";
import Link from "next/link";

type RiskBand = "ALTO" | "MEDIO" | "BAJO";
type Urgency = "INMEDIATA" | "ALTA" | "MEDIA" | "BAJA";

interface AnalysisResult {
  score: number;
  alerts: string[];
  explanation: string;
  prediction: {
    fiscal_impact_probability: number;
    estimated_fiscal_damage: string;
    fiscal_damage_reasoning: string;
    recommended_actions: string[];
    urgency: Urgency;
  };
  market_analysis: {
    price_deviation_percent: number;
    market_average_estimate: string;
    price_risk: RiskBand;
  };
  contractor_risk: {
    concentration_risk: RiskBand;
    experience_flag: boolean;
    risk_summary: string;
  };
  entity_pattern: {
    pattern_detected: boolean;
    pattern_description: string;
  };
  submetrics: {
    transparencia: number;
    competencia: number;
    legalidad: number;
    precio: number;
  };
}

interface SecopContract {
  descripcion_del_proceso?: string;
  objeto_del_contrato?: string;
  nombre_entidad?: string;
  valor_del_contrato?: string;
  modalidad_de_contratacion?: string;
  proveedor_adjudicado?: string;
  fecha_de_firma?: string;
  estado_contrato?: string;
  tipo_de_contrato?: string;
  departamento?: string;
  ciudad?: string;
  urlproceso?: string;
}

interface DeepInvestigationResult {
  contractorName: string;
  pidaQuery: string;
  contractorNit: string;
  entityName: string;
  secopNotice: string;
  totalContracts: number;
  totalValue: number;
  differentEntities: number;
  concentrationRisk: boolean;
  concentrationEntity: string;
  fraccionamientoRisk: boolean;
  fraccionamientoCount: number;
  valueTimeline: Array<{ label: string; value: number }>;
  contractDetails: Array<{
    objeto: string;
    entidad: string;
    valor: number;
    fechaFirma: string;
    estado: string;
    url: string;
  }>;
}

const SIGNALS = [
  "Adjudicacion sin concurrencia de oferentes",
  "Plazos de ejecucion inusualmente cortos",
  "Sobrecostos frente a precios de mercado",
  "Contratista sin experiencia acreditable",
  "Modificaciones contractuales sospechosas",
  "Concentracion de contratos en mismo proveedor",
];

function formatValor(raw: string | undefined): string {
  if (raw == null || raw === "") return "";
  const n = Number(raw);
  if (Number.isFinite(n)) return n.toLocaleString("es-CO");
  return String(raw);
}

function toNumberValue(raw: unknown): number {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  const normalized = String(raw).replace(/[^\d.-]/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function parseSecopDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const t = raw.trim();
  const slash = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slash) {
    const d = Number(slash[1]);
    const m = Number(slash[2]);
    const y = Number(slash[3]);
    return new Date(y, m - 1, d);
  }
  const iso = new Date(t);
  if (!Number.isNaN(iso.getTime())) return iso;
  return null;
}

function extractContractorForInvestigation(text: string): {
  contractorDisplay: string;
  secopSearchQuery: string;
} {
  const t = text.trim();
  const linePatterns = [
    /contratista:\s*(.+)/i,
    /proveedor_adjudicado:\s*(.+)/i,
    /Proveedor:\s*(.+)/i,
    /proveedor adjudicado:\s*(.+)/i,
    /proveedor_adjudicado\s*[:]\s*(.+)/i,
    /adjudicado a:\s*(.+)/i,
    /proveedor:\s*(.+)/i,
  ];
  for (const p of linePatterns) {
    const m = t.match(p);
    if (m?.[1]) {
      const line = m[1].split("\n")[0].trim().replace(/^["']|["']$/g, "");
      if (line.length >= 2) {
        return { contractorDisplay: line, secopSearchQuery: line };
      }
    }
  }
  const snippet = t.slice(0, 30).trim();
  const fallbackQuery = snippet.length > 0 ? snippet : "contrato";
  return {
    contractorDisplay: "Contratista no identificado",
    secopSearchQuery: fallbackQuery,
  };
}

function detectEntityName(text: string): string {
  const patterns = [/entidad:\s*(.+)/i, /nombre_entidad:\s*(.+)/i];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) {
      const line = m[1].split("\n")[0].trim();
      if (line.length >= 4) return line;
    }
  }
  return "";
}

type NetworkEntityNode = {
  name: string;
  total: number;
  count: number;
  risky: boolean;
  share: number;
};

type NetworkGraphComputed = {
  topEntities: NetworkEntityNode[];
  maxTotal: number;
  maxShare: number;
  anomaly60: boolean;
  dominantEntity: string;
  risk: number;
  riskLabel: string;
  detections: string[];
  firstD: Date | undefined;
  lastD: Date | undefined;
  totalVal: number;
};

function computeNetworkGraphData(
  investigation: DeepInvestigationResult,
  mainAnalysisScore: number | null,
): NetworkGraphComputed {
  const grouped = new Map<string, { total: number; count: number }>();
  for (const c of investigation.contractDetails) {
    const entidad = c.entidad || "Sin entidad";
    const prev = grouped.get(entidad) || { total: 0, count: 0 };
    grouped.set(entidad, {
      total: prev.total + c.valor,
      count: prev.count + 1,
    });
  }
  const totalVal = Math.max(investigation.totalValue, 1);
  const topEntities: NetworkEntityNode[] = Array.from(grouped.entries())
    .map(([name, stats]) => ({
      name,
      total: stats.total,
      count: stats.count,
      risky: stats.count > 3,
      share: stats.total / totalVal,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);
  const maxTotal = Math.max(...topEntities.map((e) => e.total), 1);
  const maxShare = topEntities.length ? Math.max(...topEntities.map((e) => e.share)) : 0;
  const anomaly60 = maxShare > 0.6;
  const dominantEntity = topEntities.find((e) => e.share === maxShare)?.name || "";
  const totalContracts = Math.max(investigation.totalContracts, 1);
  const avgContractsPerEntity =
    investigation.differentEntities > 0 ? totalContracts / investigation.differentEntities : 0;

  let risk = 0;
  if (investigation.contractorNit) risk += 18;
  if (investigation.concentrationRisk) risk += 22;
  if (investigation.fraccionamientoRisk) risk += 14;
  if (avgContractsPerEntity > 2.5) risk += 12;
  if (investigation.totalValue > 500_000_000) risk += 16;
  else if (investigation.totalValue > 100_000_000) risk += 8;
  if (maxShare > 0.5) risk += 18;
  else if (maxShare > 0.35) risk += 10;
  if (mainAnalysisScore != null) risk += Math.round(mainAnalysisScore * 0.12);
  risk = Math.min(100, Math.round(risk));

  const riskLabel =
    risk >= 80 ? "CRITICO" : risk >= 60 ? "ALTO" : risk >= 40 ? "MEDIO" : "BAJO";

  const detections: string[] = [];
  if (investigation.concentrationRisk) {
    detections.push("Concentracion contractual detectada");
  }
  if (avgContractsPerEntity > 2 || maxShare > 0.45) {
    detections.push("Dependencia institucional elevada");
  }
  if (topEntities.some((e) => e.count >= 3)) {
    detections.push("Patron repetitivo encontrado");
  }
  if (investigation.fraccionamientoRisk || (mainAnalysisScore != null && mainAnalysisScore >= 55)) {
    detections.push("Posible riesgo fiscal");
  }
  if (anomaly60) {
    detections.push("Anomalia de concentracion >60% en una entidad");
  }
  if (detections.length === 0) {
    detections.push("Red bajo perfil de alerta con datos disponibles");
  }

  const dates = investigation.contractDetails
    .map((c) => parseSecopDate(c.fechaFirma))
    .filter((d): d is Date => d != null)
    .sort((a, b) => a.getTime() - b.getTime());
  const firstD = dates[0];
  const lastD = dates[dates.length - 1];

  return {
    topEntities,
    maxTotal,
    maxShare,
    anomaly60,
    dominantEntity,
    risk,
    riskLabel,
    detections,
    firstD,
    lastD,
    totalVal,
  };
}

function toExecutiveSummary(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  const sentences = trimmed.split(/(?<=[.!?])\s+/).filter(Boolean);
  const joined = sentences.slice(0, 2).join(" ");
  const out = joined || trimmed;
  if (out.length <= 240) return out;
  return out.slice(0, 237).trim() + "...";
}

const NETWORK_LOADING_TEXTS = [
  "Analizando relaciones...",
  "Detectando concentracion...",
  "Cruzando datos PACO...",
  "Generando mapa de riesgo...",
];

/** Projector-optimized palette — Hackathon demo polish */
const DEMO = {
  textPrimary: "#F8FAFC",
  textSecondary: "#CBD5E1",
  accentBlue: "#3B82F6",
  accentGold: "#F5A800",
  danger: "#EF4444",
  success: "#22C55E",
} as const;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
}

function animateNumberOverMs(
  durationMs: number,
  onLinearProgress: (linear01: number) => void,
): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      onLinearProgress(p);
      if (p < 1) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
}

function CorruptionNetworkIntelligence({
  investigation,
  mainAnalysisScore,
  hero = false,
  hideFooterPanels = false,
}: {
  investigation: DeepInvestigationResult;
  mainAnalysisScore: number | null;
  hero?: boolean;
  hideFooterPanels?: boolean;
}) {
  const [phase, setPhase] = useState<"scan" | "live">("scan");
  const [loadingIdx, setLoadingIdx] = useState(0);
  const [revealTick, setRevealTick] = useState(0);
  const [riskBarAnim, setRiskBarAnim] = useState(0);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; key: string } | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const graphData = useMemo(
    () => computeNetworkGraphData(investigation, mainAnalysisScore),
    [investigation, mainAnalysisScore],
  );

  useEffect(() => {
    if (phase !== "scan") return;
    const t = window.setInterval(() => {
      setLoadingIdx((i) => (i + 1) % NETWORK_LOADING_TEXTS.length);
    }, 750);
    const end = window.setTimeout(() => {
      setPhase("live");
      window.clearInterval(t);
    }, 3200);
    return () => {
      window.clearInterval(t);
      window.clearTimeout(end);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "live") return;
    let frame = 0;
    const id = window.setInterval(() => {
      frame += 1;
      setRevealTick(frame);
      if (frame >= 120) window.clearInterval(id);
    }, 28);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== "live") {
      setRiskBarAnim(0);
      return;
    }
    const target = graphData.risk;
    const dur = 1200;
    const start = performance.now();
    let id = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      setRiskBarAnim(Math.round(target * easeOutCubic(p)));
      if (p < 1) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [phase, graphData.risk]);

  const width = hero ? 1080 : 920;
  const height = hero ? 340 : 300;
  const centerX = width / 2;
  const centerY = hero ? 172 : 148;
  const radius = hero ? 122 : 102;
  const legendY = height - 26;
  const { topEntities, maxTotal, anomaly60, dominantEntity, risk, riskLabel, detections, firstD, lastD } =
    graphData;

  const entityCount = topEntities.length;
  const nodesVisible = phase === "live" ? Math.min(entityCount, Math.ceil(revealTick / 14)) : 0;
  const edgeProgress = phase === "live" ? Math.min(1, revealTick / 80) : 0;

  const contractorColor = investigation.contractorNit ? DEMO.danger : DEMO.success;
  const riskColor =
    risk >= 80 ? DEMO.danger : risk >= 60 ? DEMO.accentGold : risk >= 40 ? "#FBBF24" : DEMO.success;

  const onSvgMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!wrapRef.current || !hoverKey) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const key =
      hoverKey === "c"
        ? "__contractor__"
        : hoverKey.startsWith("e-")
          ? hoverKey.slice(2)
          : hoverKey;
    setTooltip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      key,
    });
  };

  return (
    <>
      <style>{`
        @keyframes neurauditScanPulse {
          0% { transform: scale(0.58); opacity: 0.72; }
          100% { transform: scale(2.35); opacity: 0; }
        }
        @keyframes neurauditRadar {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes neurauditRadarDrift {
          0%, 100% { opacity: 0.38; }
          50% { opacity: 0.48; }
        }
        @keyframes neurauditParticle {
          0%, 100% { opacity: 0.22; transform: translateY(0); }
          50% { opacity: 0.62; transform: translateY(-5px); }
        }
        @keyframes neurauditGoldPulse {
          0%, 100% { stroke-opacity: 0.88; filter: drop-shadow(0 0 6px #F5A800); }
          50% { stroke-opacity: 1; filter: drop-shadow(0 0 16px #F5A800); }
        }
        @keyframes neurauditLiveDot {
          0%, 100% { opacity: 1; box-shadow: 0 0 6px #22c55e, 0 0 12px rgba(34,197,94,0.45); }
          50% { opacity: 0.72; box-shadow: 0 0 14px #22c55e, 0 0 22px rgba(34,197,94,0.38); }
        }
        @keyframes neurauditNodePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.88; }
        }
        @keyframes neurauditHeroFade {
          from { opacity: 0.92; }
          to { opacity: 1; }
        }
      `}</style>
      <div
        ref={wrapRef}
        style={{
          position: "relative",
          marginTop: hero ? 0 : 18,
          borderRadius: 14,
          border: "1px solid rgba(245,168,0,0.42)",
          background:
            "radial-gradient(ellipse 115% 78% at 50% 14%, rgba(59,130,246,0.18) 0%, #0a1628 42%, #050d18 100%)",
          boxShadow:
            "0 0 48px rgba(59,130,246,0.2), inset 0 1px 0 rgba(255,255,255,0.08), 0 22px 56px rgba(0,0,0,0.55)",
          padding: hero ? "10px 10px 11px" : "13px 11px 14px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: hero ? 44 : 10,
            right: 10,
            zIndex: 12,
            width: 172,
            padding: "10px 12px",
            borderRadius: 10,
            background: "linear-gradient(145deg, rgba(15,23,42,0.96), rgba(5,12,24,0.99))",
            border: "1px solid rgba(245,168,0,0.42)",
            boxShadow:
              "0 0 28px rgba(59,130,246,0.25), inset 0 0 22px rgba(59,130,246,0.06)",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: 1.4,
              color: DEMO.accentBlue,
              marginBottom: 5,
            }}
          >
            RIESGO DE RED
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: riskColor, lineHeight: 1 }}>
            {phase === "live" ? riskBarAnim : 0}
            <span style={{ fontSize: 13, color: DEMO.textSecondary, fontWeight: 800 }}>%</span>
          </div>
          <div style={{ fontSize: 11, fontWeight: 900, color: riskColor, marginTop: 3 }}>{riskLabel}</div>
          <div
            style={{
              marginTop: 8,
              height: 7,
              borderRadius: 3,
              background: "rgba(248,250,252,0.12)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: (phase === "live" ? riskBarAnim : 0) + "%",
                background: "linear-gradient(90deg, " + DEMO.accentBlue + ", " + riskColor + ")",
                borderRadius: 3,
                boxShadow: "0 0 12px " + riskColor,
                transition: "width 0.12s ease-out",
              }}
            />
          </div>
        </div>

        {anomaly60 && phase === "live" && (
          <div
            style={{
              position: "absolute",
              top: hero ? 44 : 10,
              left: 10,
              zIndex: 12,
              background: "linear-gradient(90deg, #F5A800, #EA580C)",
              color: "#0f172a",
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: 1,
              padding: "6px 11px",
              borderRadius: 7,
              boxShadow: "0 0 26px rgba(245,168,0,0.65)",
              border: "1px solid rgba(255,255,255,0.35)",
            }}
          >
            ANOMALIA DETECTADA
          </div>
        )}

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 14,
            marginBottom: hero ? 5 : 7,
            paddingBottom: hero ? 6 : 7,
            borderBottom: "1px solid rgba(59,130,246,0.28)",
          }}
        >
          {(
            [
              "SECOP II conectado",
              "PACO sincronizado",
              "IA analizando patrones",
            ] as const
          ).map((label) => (
            <div
              key={label}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontSize: hero ? 11 : 10,
                fontWeight: 800,
                color: DEMO.textPrimary,
                letterSpacing: 0.3,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: DEMO.success,
                  flexShrink: 0,
                  animation: "neurauditLiveDot 2s ease-in-out infinite",
                }}
              />
              {label}
            </div>
          ))}
        </div>

        <div
          style={{
            fontSize: hero ? 14 : 11,
            fontWeight: 900,
            letterSpacing: 2,
            color: DEMO.textPrimary,
            textShadow: "0 0 22px rgba(59,130,246,0.45)",
            marginBottom: 3,
          }}
        >
          MAPA DE RED DE CORRUPCION
        </div>
        <div
          style={{
            fontSize: hero ? 11 : 10,
            color: DEMO.textSecondary,
            fontWeight: 600,
            marginBottom: hero ? 5 : 8,
          }}
        >
          RED DE VINCULOS CONTRACTUALES · Fuente: SECOP II + PACO | Programa PIDA-OEA
        </div>

        {phase === "scan" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 15,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(5,12,24,0.75)",
              backdropFilter: "blur(4px)",
            }}
          >
            <div
              style={{
                textAlign: "center",
                color: DEMO.accentBlue,
                fontSize: 14,
                fontWeight: 800,
                letterSpacing: 0.5,
                animation: "neurauditParticle 1.2s ease-in-out infinite",
              }}
            >
              {NETWORK_LOADING_TEXTS[loadingIdx]}
            </div>
          </div>
        )}

        <div
          style={{
            position: "relative",
            minHeight: hero ? 392 : undefined,
            maxHeight: hero ? 428 : undefined,
          }}
        >
          <svg
            viewBox={"0 0 " + String(width) + " " + String(height)}
            preserveAspectRatio="xMidYMid meet"
            style={{
              width: "100%",
              height: hero ? 404 : height,
              minHeight: hero ? 390 : undefined,
              display: "block",
              animation: phase === "live" ? "neurauditHeroFade 0.85s ease-out" : undefined,
            }}
            onMouseMove={onSvgMove}
            onMouseLeave={() => {
              setHoverKey(null);
              setTooltip(null);
            }}
          >
          <defs>
            <filter id="neurauditGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3.2" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="neurauditGlowStrong" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="5" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <radialGradient id="neurauditRadarGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(245,168,0,0.32)" />
              <stop offset="100%" stopColor="rgba(245,168,0,0)" />
            </radialGradient>
          </defs>

          {[12, 28, 44, 60, 76].map((cy, i) => (
            <circle
              key={"p" + i}
              cx={(i * 173 + 40) % width}
              cy={cy + (i % 3) * 80}
              r="1.35"
              fill="rgba(59,130,246,0.65)"
              style={{
                animation: "neurauditParticle " + (2.2 + i * 0.2) + "s ease-in-out infinite",
                animationDelay: String(i * 0.15) + "s",
              }}
            />
          ))}

          <g
            style={{
              transformOrigin: centerX + "px " + centerY + "px",
              animation: phase === "live" ? "neurauditRadar 16s linear infinite" : "none",
            }}
          >
            <line
              x1={centerX}
              y1={centerY}
              x2={centerX}
              y2={centerY - radius - 20}
              stroke="url(#neurauditRadarGrad)"
              strokeWidth="40"
              style={{
                opacity: phase === "live" ? 0.42 : 0.28,
                animation: phase === "live" ? "neurauditRadarDrift 4s ease-in-out infinite" : undefined,
              }}
            />
          </g>

          {phase === "live" && (
            <g transform={`translate(${centerX} ${centerY})`}>
              <circle
                r="22"
                fill="none"
                stroke="rgba(59,130,246,0.62)"
                strokeWidth="2.5"
                style={{ animation: "neurauditScanPulse 2.4s ease-out infinite" }}
              />
            </g>
          )}

          {topEntities.map((entity, idx) => {
            if (idx >= nodesVisible) return null;
            const angle = (idx / Math.max(entityCount, 1)) * Math.PI * 2 - Math.PI / 2;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            const edgeW = 2 + (entity.total / maxTotal) * 9;
            const nodeR = 10 + (entity.total / maxTotal) * 13;
            const isDominantAnomaly = anomaly60 && entity.name === dominantEntity;
            const edgeKey = "e-" + entity.name;
            const dimNode =
              hoverKey != null &&
              hoverKey !== "c" &&
              hoverKey !== entity.name &&
              hoverKey !== edgeKey;
            const edgeFocused =
              hoverKey === "c" || hoverKey === edgeKey || hoverKey === entity.name;
            let edgeColor = entity.risky ? DEMO.accentGold : "rgba(226,232,240,0.44)";
            if (hoverKey && !edgeFocused) {
              edgeColor = "rgba(148,163,184,0.12)";
            } else if (isDominantAnomaly && phase === "live") {
              edgeColor = DEMO.accentGold;
            } else if (hoverKey && edgeFocused && !entity.risky && !isDominantAnomaly) {
              edgeColor = DEMO.accentBlue;
            }
            const lineLen = Math.hypot(x - centerX, y - centerY);
            const dashLen = lineLen * edgeProgress;
            const label =
              entity.name.length > 15 ? entity.name.slice(0, 15) + "..." : entity.name;

            return (
              <g key={entity.name + String(idx)}>
                <line
                  x1={centerX}
                  y1={centerY}
                  x2={x}
                  y2={y}
                  stroke={edgeColor}
                  strokeWidth={edgeW}
                  strokeLinecap="round"
                  strokeDasharray={String(lineLen)}
                  strokeDashoffset={String(lineLen - dashLen)}
                  filter={
                    dimNode
                      ? "url(#neurauditGlow)"
                      : hoverKey === edgeKey ||
                          hoverKey === entity.name ||
                          entity.risky ||
                          isDominantAnomaly
                        ? "url(#neurauditGlowStrong)"
                        : "url(#neurauditGlow)"
                  }
                  style={
                    isDominantAnomaly
                      ? { animation: "neurauditGoldPulse 1.65s ease-in-out infinite" }
                      : undefined
                  }
                  opacity={
                    dimNode
                      ? 0.12
                      : hoverKey === entity.name ||
                          hoverKey === "c" ||
                          hoverKey === edgeKey ||
                          !hoverKey
                        ? 1
                        : 0.26
                  }
                  onMouseEnter={(e) => {
                    setHoverKey(edgeKey);
                    const rect = wrapRef.current?.getBoundingClientRect();
                    if (rect) {
                      setTooltip({
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top,
                        key: entity.name,
                      });
                    }
                  }}
                  onMouseMove={(e) => {
                    const rect = wrapRef.current?.getBoundingClientRect();
                    if (rect) {
                      setTooltip({
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top,
                        key: entity.name,
                      });
                    }
                  }}
                  onMouseLeave={() => {
                    setHoverKey(null);
                    setTooltip(null);
                  }}
                />
                <circle
                  cx={x}
                  cy={y}
                  r={nodeR}
                  fill="#0c2744"
                  stroke={
                    hoverKey === entity.name || hoverKey === edgeKey
                      ? DEMO.accentGold
                      : "rgba(59,130,246,0.55)"
                  }
                  strokeWidth={hoverKey === entity.name || hoverKey === edgeKey ? 3 : 1.5}
                  opacity={dimNode ? 0.28 : 1}
                  filter={
                    hoverKey === entity.name || hoverKey === edgeKey
                      ? "url(#neurauditGlowStrong)"
                      : "url(#neurauditGlow)"
                  }
                  style={{
                    cursor: "pointer",
                    animation:
                      phase === "live" && !dimNode
                        ? "neurauditNodePulse " + (3.4 + idx * 0.08) + "s ease-in-out infinite"
                        : undefined,
                  }}
                  onMouseEnter={(e) => {
                    setHoverKey(entity.name);
                    const rect = wrapRef.current?.getBoundingClientRect();
                    if (rect) {
                      setTooltip({
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top,
                        key: entity.name,
                      });
                    }
                  }}
                  onMouseMove={(e) => {
                    const rect = wrapRef.current?.getBoundingClientRect();
                    if (rect) {
                      setTooltip({
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top,
                        key: entity.name,
                      });
                    }
                  }}
                  onMouseLeave={() => {
                    setHoverKey(null);
                    setTooltip(null);
                  }}
                />
                <text
                  x={x}
                  y={y + nodeR + 14}
                  textAnchor="middle"
                  fontSize={hero ? 11 : 10}
                  fill={DEMO.textSecondary}
                  fontWeight={700}
                >
                  {label}
                </text>
              </g>
            );
          })}

          <circle
            cx={centerX}
            cy={centerY}
            r={hero ? 22 : 20}
            fill={contractorColor}
            stroke="rgba(248,250,252,0.55)"
            strokeWidth={hoverKey === "c" ? 3 : 2}
            filter={hoverKey === "c" ? "url(#neurauditGlowStrong)" : "url(#neurauditGlow)"}
            style={{
              cursor: "pointer",
              animation:
                phase === "live" ? "neurauditNodePulse 3.8s ease-in-out infinite" : undefined,
            }}
            opacity={1}
            onMouseEnter={(e) => {
              setHoverKey("c");
              const rect = wrapRef.current?.getBoundingClientRect();
              if (rect) {
                setTooltip({
                  x: e.clientX - rect.left,
                  y: e.clientY - rect.top,
                  key: "__contractor__",
                });
              }
            }}
            onMouseMove={(e) => {
              const rect = wrapRef.current?.getBoundingClientRect();
              if (rect) {
                setTooltip({
                  x: e.clientX - rect.left,
                  y: e.clientY - rect.top,
                  key: "__contractor__",
                });
              }
            }}
            onMouseLeave={() => {
              setHoverKey(null);
              setTooltip(null);
            }}
          />
          <text
            x={centerX}
            y={centerY + 38}
            textAnchor="middle"
            fontSize={hero ? 12 : 11}
            fill={DEMO.textPrimary}
            fontWeight="800"
          >
            {investigation.contractorName.length > 22
              ? investigation.contractorName.slice(0, 22) + "..."
              : investigation.contractorName}
          </text>

          <g transform={"translate(24," + String(legendY) + ")"} opacity={0.88}>
            <circle cx="0" cy="0" r="5" fill={DEMO.danger} />
            <text x="10" y="4" fontSize={hero ? 10 : 9} fill={DEMO.textSecondary} fontWeight={700}>
              exposicion PACO / NIT
            </text>
            <circle cx="130" cy="0" r="5" fill={DEMO.success} />
            <text x="140" y="4" fontSize={hero ? 10 : 9} fill={DEMO.textSecondary} fontWeight={700}>
              sin huella NIT
            </text>
            <line x1="248" y1="0" x2="268" y2="0" stroke={DEMO.accentGold} strokeWidth="4" />
            <text x="276" y="4" fontSize={hero ? 10 : 9} fill={DEMO.textSecondary} fontWeight={700}>
              riesgo concentracion
            </text>
          </g>
        </svg>
        </div>

        {tooltip &&
          (() => {
            const tipBase: React.CSSProperties = {
              position: "absolute",
              left: Math.min(tooltip.x + 14, (wrapRef.current?.clientWidth || 420) - 210),
              top: tooltip.y + 14,
              zIndex: 20,
              padding: "8px 10px",
              borderRadius: 10,
              background: "rgba(15,23,42,0.94)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: "1px solid rgba(245,168,0,0.55)",
              boxShadow:
                "0 16px 44px rgba(0,0,0,0.58), 0 0 28px rgba(59,130,246,0.22)",
              pointerEvents: "none",
              transition: "left 70ms linear, top 70ms linear",
              maxWidth: 210,
            };
            if (tooltip.key === "__contractor__") {
              const cRisk = investigation.contractorNit ? "ALTO (NIT / PACO)" : "BAJO";
              return (
                <div style={tipBase}>
                  <div style={{ fontSize: 11, fontWeight: 900, color: DEMO.accentGold, marginBottom: 5 }}>
                    {investigation.contractorName.length > 28
                      ? investigation.contractorName.slice(0, 28) + "..."
                      : investigation.contractorName}
                  </div>
                  <div style={{ fontSize: 10, color: DEMO.textSecondary, lineHeight: 1.45, fontWeight: 600 }}>
                    <div style={{ color: DEMO.textPrimary }}>
                      <strong style={{ color: DEMO.accentBlue }}>Contratos:</strong>{" "}
                      {investigation.totalContracts}
                    </div>
                    <div style={{ color: DEMO.textPrimary }}>
                      <strong style={{ color: DEMO.accentBlue }}>Valor total:</strong>{" "}
                      {"$ " + investigation.totalValue.toLocaleString("es-CO")}
                    </div>
                    <div style={{ color: DEMO.textPrimary }}>
                      <strong style={{ color: DEMO.accentBlue }}>Riesgo:</strong> {cRisk}
                    </div>
                    <div style={{ color: DEMO.textPrimary }}>
                      <strong style={{ color: DEMO.accentBlue }}>Participacion:</strong> 100% (eje)
                    </div>
                  </div>
                </div>
              );
            }
            const ent = topEntities.find((e) => e.name === tooltip.key);
            if (!ent) return null;
            const pct = Math.round(ent.share * 1000) / 10;
            const entRisk =
              ent.share > 0.6 ? "CRITICO" : ent.risky ? "ALTO" : ent.share > 0.35 ? "MEDIO" : "BAJO";
            return (
              <div style={tipBase}>
                <div style={{ fontSize: 11, fontWeight: 900, color: DEMO.accentGold, marginBottom: 5 }}>
                  {ent.name.length > 28 ? ent.name.slice(0, 28) + "..." : ent.name}
                </div>
                <div style={{ fontSize: 10, color: DEMO.textSecondary, lineHeight: 1.45, fontWeight: 600 }}>
                  <div style={{ color: DEMO.textPrimary }}>
                    <strong style={{ color: DEMO.accentBlue }}>Contratos:</strong> {ent.count}
                  </div>
                  <div style={{ color: DEMO.textPrimary }}>
                    <strong style={{ color: DEMO.accentBlue }}>Valor total:</strong>{" "}
                    {"$ " + ent.total.toLocaleString("es-CO")}
                  </div>
                  <div style={{ color: DEMO.textPrimary }}>
                    <strong style={{ color: DEMO.accentBlue }}>Riesgo:</strong> {entRisk}
                  </div>
                  <div style={{ color: DEMO.textPrimary }}>
                    <strong style={{ color: DEMO.accentBlue }}>Participacion:</strong> {pct}%
                  </div>
                </div>
              </div>
            );
          })()}

        {!hideFooterPanels && (
          <>
            <div
              style={{
                marginTop: 10,
                padding: "10px 12px",
                borderRadius: 12,
                background: "linear-gradient(180deg, rgba(59,130,246,0.12), rgba(5,12,24,0.9))",
                border: "1px solid rgba(245,168,0,0.38)",
                boxShadow: "inset 0 0 26px rgba(59,130,246,0.08)",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: 2,
                  color: DEMO.accentGold,
                  textShadow: "0 0 14px rgba(245,168,0,0.35)",
                  marginBottom: 8,
                }}
              >
                DETECCIONES IA
              </div>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 18,
                  color: DEMO.textPrimary,
                  fontSize: 12,
                  lineHeight: 1.65,
                  fontWeight: 600,
                }}
              >
                {detections.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>

            <div
              style={{
                marginTop: 8,
                padding: "10px 12px",
                borderRadius: 10,
                background: "rgba(15,23,42,0.72)",
                border: "1px solid rgba(59,130,246,0.32)",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 900,
                  letterSpacing: 1.5,
                  color: DEMO.accentBlue,
                  marginBottom: 8,
                }}
              >
                LINEA DE TIEMPO · INVESTIGACION
              </div>
              <div
                style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}
              >
                {[
                  {
                    t: "Primer contrato",
                    v: firstD ? firstD.toLocaleDateString("es-CO") : "N/D",
                  },
                  {
                    t: "Concentracion detectada",
                    v: investigation.concentrationRisk ? "Si" : "No",
                  },
                  {
                    t: "Ultimo contrato",
                    v: lastD ? lastD.toLocaleDateString("es-CO") : "N/D",
                  },
                  {
                    t: "Escalada de riesgo",
                    v: risk >= 70 ? "Alta" : risk >= 45 ? "Moderada" : "Controlada",
                  },
                ].map((item) => (
                  <div key={item.t} style={{ flex: "1 1 120px", minWidth: 100 }}>
                    <div style={{ fontSize: 9, color: DEMO.textSecondary, fontWeight: 700 }}>{item.t}</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: DEMO.textPrimary }}>{item.v}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

type HackathonResultsDashboardProps = {
  result: AnalysisResult;
  investigationResult: DeepInvestigationResult | null;
  networkDashData: NetworkGraphComputed | null;
  investigating: boolean;
  runDeepInvestigation: () => void;
  showFullAnalysis: boolean;
  onToggleFullAnalysis: () => void;
  animFiscalProb: number;
  /** Animated main corruption index (0→score) */
  displayRiskScore: number;
  /** Compact preview chips above hero (viewport-first demo) */
  compactAlerts: string[];
  children?: ReactNode;
};

function HackathonResultsDashboard({
  result,
  investigationResult,
  networkDashData,
  investigating,
  runDeepInvestigation,
  showFullAnalysis,
  onToggleFullAnalysis,
  animFiscalProb,
  displayRiskScore,
  compactAlerts,
  children,
}: HackathonResultsDashboardProps) {
  const rc = (s: number) =>
    s >= 75 ? DEMO.danger : s >= 50 ? DEMO.accentGold : DEMO.success;
  const sc = (v: number) =>
    v < 40 ? DEMO.danger : v < 65 ? DEMO.accentGold : DEMO.success;
  const badgeLowCompetition = result.submetrics.competencia < 45;
  const badgeOverprice =
    result.market_analysis.price_deviation_percent > 0 ||
    result.market_analysis.price_risk === "ALTO" ||
    result.market_analysis.price_risk === "MEDIO";
  const badgeFiscal =
    result.prediction.fiscal_impact_probability >= 28 ||
    result.score >= 55 ||
    (investigationResult?.fraccionamientoRisk ?? false) ||
    (investigationResult?.concentrationRisk ?? false);

  const dashMetric: React.CSSProperties = {
    background: "linear-gradient(160deg, rgba(15,35,58,0.98) 0%, rgba(8,18,32,0.99) 100%)",
    border: "1px solid rgba(59,130,246,0.28)",
    borderRadius: 10,
    padding: "9px 10px",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 12px rgba(0,0,0,0.35)",
  };
  const mLabel: React.CSSProperties = {
    fontSize: 9,
    color: DEMO.textSecondary,
    fontWeight: 800,
    letterSpacing: 0.8,
    marginBottom: 5,
    textTransform: "uppercase" as const,
  };
  const warnBadge: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 800,
    padding: "5px 11px",
    borderRadius: 20,
    background: "rgba(245,168,0,0.28)",
    color: "#FFEDD5",
    border: "1px solid rgba(245,168,0,0.65)",
    boxShadow: "0 0 18px rgba(245,168,0,0.28)",
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 7,
        background: "linear-gradient(180deg, #0c1829 0%, #070d14 100%)",
        borderRadius: 12,
        border: "1px solid rgba(245,168,0,0.38)",
        padding: 10,
        boxShadow:
          "0 14px 52px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)",
      }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 9,
              color: DEMO.accentBlue,
              letterSpacing: 1.5,
              fontWeight: 900,
              marginBottom: 5,
            }}
          >
            DIAGNOSTICO EJECUTIVO
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              lineHeight: 1.48,
              color: DEMO.textPrimary,
              fontWeight: 600,
            }}
          >
            {toExecutiveSummary(result.explanation)}
          </p>
        </div>
        <div
          style={{
            flexShrink: 0,
            width: 168,
            padding: "10px 11px",
            borderRadius: 12,
            background: "linear-gradient(145deg, rgba(59,130,246,0.22), rgba(5,12,24,0.97))",
            border: "1px solid rgba(245,168,0,0.48)",
            boxShadow: "0 8px 28px rgba(0,51,102,0.45), 0 0 22px rgba(245,168,0,0.14)",
          }}
        >
          <div
            style={{
              fontSize: 9,
              color: DEMO.accentGold,
              fontWeight: 900,
              letterSpacing: 1.2,
            }}
          >
            PREDICCION FISCAL IA
          </div>
          <div
            style={{
              fontSize: 26,
              fontWeight: 900,
              color: DEMO.textPrimary,
              lineHeight: 1.1,
              marginTop: 4,
            }}
          >
            {animFiscalProb}
            <span style={{ fontSize: 14, fontWeight: 700 }}>%</span>
          </div>
          <div style={{ fontSize: 10, color: DEMO.textSecondary, marginTop: 3, fontWeight: 600 }}>
            Prob. hallazgo fiscal
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
          gap: 5,
        }}
      >
        <div style={{ ...dashMetric, textAlign: "center" as const }}>
          <div style={mLabel}>Riesgo</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: rc(result.score), lineHeight: 1 }}>
            {displayRiskScore}
          </div>
          <div
            style={{
              height: 4,
              background: "rgba(248,250,252,0.12)",
              borderRadius: 2,
              marginTop: 7,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: displayRiskScore + "%",
                background: rc(result.score),
                borderRadius: 2,
                boxShadow: "0 0 10px " + rc(result.score),
                transition: "width 0.12s ease-out",
              }}
            />
          </div>
        </div>
        {(
          [
            { l: "Transparencia", v: result.submetrics.transparencia },
            { l: "Competencia", v: result.submetrics.competencia },
            { l: "Legalidad", v: result.submetrics.legalidad },
          ] as const
        ).map((m) => (
          <div key={m.l} style={dashMetric}>
            <div style={mLabel}>{m.l}</div>
            <div style={{ fontSize: 17, fontWeight: 900, color: sc(m.v), lineHeight: 1 }}>{m.v}%</div>
            <div
              style={{
                height: 4,
                background: "rgba(248,250,252,0.1)",
                borderRadius: 2,
                marginTop: 5,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: m.v + "%",
                  height: "100%",
                  background: sc(m.v),
                  borderRadius: 2,
                  boxShadow: "0 0 8px " + sc(m.v),
                }}
              />
            </div>
          </div>
        ))}
        <div style={dashMetric}>
          <div style={mLabel}>Riesgo precio</div>
          <div style={{ fontSize: 13, fontWeight: 900, color: DEMO.accentGold, marginBottom: 3 }}>
            {result.market_analysis.price_risk}
          </div>
          <div style={{ fontSize: 10, color: DEMO.textSecondary, lineHeight: 1.35, fontWeight: 600 }}>
            Justo: {result.submetrics.precio}% · Desv.{" "}
            {result.market_analysis.price_deviation_percent > 0 ? "+" : ""}
            {result.market_analysis.price_deviation_percent}%
          </div>
        </div>
      </div>

      {compactAlerts.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 6,
            padding: "6px 8px",
            borderRadius: 8,
            background: "rgba(239,68,68,0.12)",
            border: "1px solid rgba(239,68,68,0.35)",
          }}
        >
          <span
            style={{
              fontSize: 9,
              fontWeight: 900,
              color: DEMO.danger,
              letterSpacing: 1,
            }}
          >
            ALERTAS
          </span>
          {compactAlerts.slice(0, 3).map((a, i) => (
            <span
              key={i + a.slice(0, 20)}
              title={a}
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: DEMO.textPrimary,
                background: "rgba(15,23,42,0.65)",
                padding: "4px 9px",
                borderRadius: 6,
                border: "1px solid rgba(248,250,252,0.18)",
                maxWidth: 220,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {a.length > 42 ? a.slice(0, 42) + "…" : a}
            </span>
          ))}
          {compactAlerts.length > 3 && (
            <span style={{ fontSize: 10, fontWeight: 800, color: DEMO.accentGold }}>
              +{compactAlerts.length - 3} más
            </span>
          )}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 200px",
          gap: 8,
          alignItems: "stretch",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
            {badgeLowCompetition && <span style={warnBadge}>⚠ Baja competencia</span>}
            {badgeOverprice && <span style={warnBadge}>⚠ Posible sobreprecio</span>}
            {badgeFiscal && <span style={warnBadge}>⚠ Riesgo fiscal</span>}
          </div>
          {investigationResult ? (
            <CorruptionNetworkIntelligence
              key={
                investigationResult.contractorName +
                "-" +
                String(investigationResult.contractDetails.length)
              }
              hero
              hideFooterPanels
              investigation={investigationResult}
              mainAnalysisScore={result.score}
            />
          ) : (
            <div
              style={{
                minHeight: 320,
                borderRadius: 14,
                border: "1px dashed rgba(245,168,0,0.48)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                background: "rgba(15,23,42,0.45)",
              }}
            >
              <button
                type="button"
                onClick={runDeepInvestigation}
                disabled={investigating}
                style={{
                  border: "none",
                  borderRadius: 10,
                  background: investigating ? "#5a6d85" : DEMO.accentBlue,
                  color: "#fff",
                  padding: "11px 18px",
                  fontWeight: 800,
                  fontSize: 11,
                  letterSpacing: 0.8,
                  cursor: investigating ? "not-allowed" : "pointer",
                  boxShadow: investigating ? "none" : "0 0 26px rgba(59,130,246,0.45)",
                }}
              >
                {investigating ? "INVESTIGANDO..." : "INVESTIGAR EN BASES ABIERTAS"}
              </button>
              <div
                style={{
                  fontSize: 11,
                  color: DEMO.textSecondary,
                  textAlign: "center",
                  padding: "0 18px",
                  maxWidth: 360,
                  lineHeight: 1.4,
                  fontWeight: 600,
                }}
              >
                El mapa de red corruptiva se activa con SECOP II + PACO + PIDA
              </div>
            </div>
          )}
        </div>

        <aside
          style={{
            ...dashMetric,
            padding: 10,
            display: "flex",
            flexDirection: "column",
            gap: 7,
            minHeight: 112,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 900,
              color: DEMO.accentGold,
              letterSpacing: 1.4,
            }}
          >
            EXPEDIENTE DIGITAL
          </div>
          {investigationResult ? (
            <>
              <div
                style={{
                  fontSize: 11,
                  color: DEMO.textPrimary,
                  fontWeight: 800,
                  lineHeight: 1.3,
                }}
              >
                {investigationResult.contractorName.length > 36
                  ? investigationResult.contractorName.slice(0, 36) + "..."
                  : investigationResult.contractorName}
              </div>
              <div style={{ fontSize: 11, color: DEMO.textSecondary, fontWeight: 600 }}>
                <strong style={{ color: DEMO.accentBlue }}>Contratos:</strong>{" "}
                {investigationResult.totalContracts}
              </div>
              <div style={{ fontSize: 11, color: DEMO.textSecondary, fontWeight: 600 }}>
                <strong style={{ color: DEMO.accentBlue }}>Entidades:</strong>{" "}
                {investigationResult.differentEntities}
              </div>
              <div style={{ fontSize: 11, color: DEMO.textSecondary, fontWeight: 600 }}>
                <strong style={{ color: DEMO.accentBlue }}>Valor:</strong> $
                {investigationResult.totalValue.toLocaleString("es-CO")}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 4 }}>
                <a
                  href={
                    "https://portal.paco.gov.co/index.php?pagina=contratista&identificacion=" +
                    encodeURIComponent(investigationResult.contractorNit || "0")
                  }
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    textDecoration: "none",
                    background: "rgba(59,130,246,0.35)",
                    color: DEMO.textPrimary,
                    borderRadius: 6,
                    padding: "6px 9px",
                    fontSize: 10,
                    fontWeight: 800,
                    border: "1px solid rgba(59,130,246,0.55)",
                  }}
                >
                  PACO · contratista <ExternalLink size={11} />
                </a>
                <a
                  href={
                    "https://www.datos.gov.co/browse?q=" +
                    encodeURIComponent(investigationResult.pidaQuery) +
                    "&sortBy=relevance"
                  }
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    textDecoration: "none",
                    background: "rgba(245,168,0,0.95)",
                    color: "#0f172a",
                    borderRadius: 6,
                    padding: "6px 9px",
                    fontSize: 10,
                    fontWeight: 900,
                    border: "1px solid rgba(245,168,0,0.75)",
                  }}
                >
                  PIDA · datos.gov.co <ExternalLink size={11} />
                </a>
              </div>
              <button
                type="button"
                onClick={runDeepInvestigation}
                disabled={investigating}
                style={{
                  marginTop: 4,
                  border: "1px solid rgba(59,130,246,0.45)",
                  borderRadius: 8,
                  background: "rgba(15,23,42,0.65)",
                  color: DEMO.textPrimary,
                  padding: "7px 9px",
                  fontSize: 10,
                  fontWeight: 800,
                  cursor: investigating ? "not-allowed" : "pointer",
                }}
              >
                {investigating ? "Actualizando..." : "Actualizar expediente"}
              </button>
            </>
          ) : (
            <div style={{ fontSize: 11, color: DEMO.textSecondary, lineHeight: 1.45, fontWeight: 600 }}>
              Ejecute la investigacion para consolidar contratos, entidades y enlaces PACO/PIDA.
            </div>
          )}
        </aside>
      </div>

      {networkDashData && investigationResult && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <div
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              background: "linear-gradient(180deg, rgba(59,130,246,0.12), rgba(5,12,24,0.92))",
              border: "1px solid rgba(245,168,0,0.4)",
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: 1.5,
                color: DEMO.accentGold,
                marginBottom: 6,
              }}
            >
              DETECCIONES IA
            </div>
            <ul
              style={{
                margin: 0,
                paddingLeft: 16,
                color: DEMO.textPrimary,
                fontSize: 11,
                lineHeight: 1.48,
                fontWeight: 600,
              }}
            >
              {networkDashData.detections.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </div>
          <div
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              background: "rgba(15,23,42,0.72)",
              border: "1px solid rgba(59,130,246,0.35)",
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: 1.3,
                color: DEMO.accentBlue,
                marginBottom: 6,
              }}
            >
              LINEA DE TIEMPO
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 6, flexWrap: "wrap" }}>
              {(
                [
                  {
                    t: "Primer contrato",
                    v: networkDashData.firstD
                      ? networkDashData.firstD.toLocaleDateString("es-CO")
                      : "N/D",
                  },
                  {
                    t: "Concentracion",
                    v: investigationResult.concentrationRisk ? "Si" : "No",
                  },
                  {
                    t: "Ultimo contrato",
                    v: networkDashData.lastD
                      ? networkDashData.lastD.toLocaleDateString("es-CO")
                      : "N/D",
                  },
                  {
                    t: "Riesgo red",
                    v:
                      networkDashData.risk >= 70
                        ? "Alto"
                        : networkDashData.risk >= 45
                          ? "Moderado"
                          : "Controlado",
                  },
                ] as const
              ).map((item) => (
                <div key={item.t} style={{ flex: "1 1 70px", minWidth: 64 }}>
                  <div style={{ fontSize: 8, color: DEMO.textSecondary, fontWeight: 700 }}>{item.t}</div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: DEMO.textPrimary }}>{item.v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onToggleFullAnalysis}
        style={{
          width: "100%",
          border: "1px solid rgba(245,168,0,0.5)",
          borderRadius: 10,
          background: showFullAnalysis ? "rgba(245,168,0,0.2)" : "rgba(59,130,246,0.2)",
          color: DEMO.accentGold,
          padding: "8px 10px",
          fontWeight: 900,
          fontSize: 11,
          letterSpacing: 0.8,
          cursor: "pointer",
        }}
      >
        {showFullAnalysis ? "▲ Ocultar analisis completo" : "▼ Ver analisis completo"}
      </button>
      {showFullAnalysis && children}
    </div>
  );
}

function detectContractorNit(text: string): string {
  const patterns = [
    /nit[:\s]+([\d.,-]+)/i,
    /nit_entidad[:\s]+([\d.,-]+)/i,
    /documento_proveedor[:\s]+([\d.,-]+)/i,
    /contratista:\s*[^\n]*?(\d[\d.,-]{5,})/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) {
      const nit = m[1].replace(/[^\d]/g, "");
      if (nit.length >= 6) return nit;
    }
  }
  return "";
}

export default function Page() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contractText, setContractText] = useState("");
  const [animScore, setAnimScore] = useState(0);
  const [animAlerts, setAnimAlerts] = useState<string[]>([]);
  const [animExplanation, setAnimExplanation] = useState("");
  const [animSubmetrics, setAnimSubmetrics] = useState<AnalysisResult["submetrics"] | null>(null);
  const [animRunning, setAnimRunning] = useState(false);
  const [animFiscalProb, setAnimFiscalProb] = useState(0);
  const [phase, setPhase] = useState<
    "idle" | "scanning" | "scoring" | "alerts" | "diagnosis" | "done"
  >("idle");

  const [secopQuery, setSecopQuery] = useState("");
  const [secopLoading, setSecopLoading] = useState(false);
  const [secopResults, setSecopResults] = useState<SecopContract[]>([]);
  const [secopError, setSecopError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"secop" | "manual">("secop");
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileToast, setFileToast] = useState("");
  const [investigating, setInvestigating] = useState(false);
  const [investigationResult, setInvestigationResult] = useState<DeepInvestigationResult | null>(null);
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);
  const [insufficientContract, setInsufficientContract] = useState(false);
  const [contractConfidenceValue, setContractConfidenceValue] = useState<number | null>(null);
  const dragCounterRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const sleep = useCallback((ms: number) => new Promise((r) => setTimeout(r, ms)), []);

  const showFileToast = useCallback((filename: string) => {
    setFileToast("Archivo cargado: " + filename);
    window.setTimeout(() => {
      setFileToast("");
    }, 3000);
  }, []);

  const extractPdfText = useCallback(async (file: File) => {
    const buffer = await file.arrayBuffer();
    const pdfjs = await import("pdfjs-dist");
    const workerUrl =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/" +
      pdfjs.version +
      "/pdf.worker.min.mjs";
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const loadingTask = pdfjs.getDocument({ data: buffer });
    const pdf = await loadingTask.promise;
    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .trim();
      pages.push(pageText);
    }
    return pages.join("\n\n").trim();
  }, []);

  const extractTxtText = useCallback(async (file: File) => {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(String(reader.result || ""));
      };
      reader.onerror = () => {
        reject(new Error("No se pudo leer archivo TXT"));
      };
      reader.readAsText(file, "utf-8");
    });
  }, []);

  const extractDocxText = useCallback(async (file: File) => {
    const buffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return result.value.trim();
  }, []);

  const handleSelectedFile = useCallback(
    async (file: File) => {
      const filename = file.name;
      const lower = filename.toLowerCase();
      try {
        setError(null);
        let text = "";
        if (lower.endsWith(".pdf")) {
          text = await extractPdfText(file);
        } else if (lower.endsWith(".txt")) {
          text = await extractTxtText(file);
        } else if (lower.endsWith(".docx")) {
          text = await extractDocxText(file);
        } else {
          throw new Error("Formato no soportado");
        }
        if (!text.trim()) {
          throw new Error("Archivo sin contenido legible");
        }
        setContractText(text);
        setActiveTab("manual");
        showFileToast(filename);
      } catch {
        setError("No se pudo leer el archivo");
      }
    },
    [extractDocxText, extractPdfText, extractTxtText, showFileToast],
  );

  const onDragEnterManual = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (activeTab !== "manual") return;
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    setIsDragOver(true);
  }, [activeTab]);

  const onDragOverManual = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (activeTab !== "manual") return;
    e.preventDefault();
    e.stopPropagation();
  }, [activeTab]);

  const onDragLeaveManual = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (activeTab !== "manual") return;
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
    }
  }, [activeTab]);

  const onDropManual = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      if (activeTab !== "manual") return;
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (!file) return;
      await handleSelectedFile(file);
    },
    [activeTab, handleSelectedFile],
  );

  const onFileInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      await handleSelectedFile(file);
      e.target.value = "";
    },
    [handleSelectedFile],
  );

  const buildInvestigationPayload = useCallback(
    (
      contracts: SecopContract[],
      contractorDisplay: string,
      pidaQuery: string,
      contractorNit: string,
      entityName: string,
      secopNotice: string,
    ): DeepInvestigationResult => {
      const totalValue = contracts.reduce((acc, c) => acc + toNumberValue(c.valor_del_contrato), 0);
      const entityCount = new Map<string, number>();
      for (const c of contracts) {
        const entity = (c.nombre_entidad || "SIN_ENTIDAD").trim().toUpperCase();
        entityCount.set(entity, (entityCount.get(entity) || 0) + 1);
      }
      let concentrationEntity = "";
      let maxEntityCount = 0;
      entityCount.forEach((count, entity) => {
        if (count > maxEntityCount) {
          maxEntityCount = count;
          concentrationEntity = entity;
        }
      });
      const concentrationRisk = maxEntityCount > 3;
      const thresholdCandidates = [10000000, 50000000, 100000000];
      let fraccionamientoCount = 0;
      for (const c of contracts) {
        const value = toNumberValue(c.valor_del_contrato);
        if (!value) continue;
        const near = thresholdCandidates.some((t) => value < t && (t - value) / t <= 0.03);
        if (near) fraccionamientoCount++;
      }
      const timeline = contracts
        .map((c) => {
          const d = parseSecopDate(c.fecha_de_firma);
          return {
            date: d,
            label: d
              ? d.toLocaleDateString("es-CO", { year: "2-digit", month: "short" })
              : "Sin fecha",
            value: toNumberValue(c.valor_del_contrato),
          };
        })
        .filter((x) => x.value > 0)
        .sort((a, b) => {
          const ta = a.date ? a.date.getTime() : 0;
          const tb = b.date ? b.date.getTime() : 0;
          return ta - tb;
        })
        .slice(-12)
        .map((x) => ({ label: x.label, value: x.value }));
      const contractDetails = contracts.slice(0, 40).map((c) => ({
        objeto: (c.objeto_del_contrato || c.descripcion_del_proceso || "Sin objeto").trim(),
        entidad: (c.nombre_entidad || "Sin entidad").trim(),
        valor: toNumberValue(c.valor_del_contrato),
        fechaFirma: c.fecha_de_firma || "Sin fecha",
        estado: (c.estado_contrato || "Sin estado").trim(),
        url: (c.urlproceso || "").trim(),
      }));
      return {
        contractorName: contractorDisplay,
        pidaQuery,
        contractorNit,
        entityName,
        secopNotice,
        totalContracts: contracts.length,
        totalValue,
        differentEntities: entityCount.size,
        concentrationRisk,
        concentrationEntity: concentrationRisk ? concentrationEntity : "",
        fraccionamientoRisk: fraccionamientoCount > 0,
        fraccionamientoCount,
        valueTimeline: timeline,
        contractDetails,
      };
    },
    [],
  );

  const runDeepInvestigation = useCallback(async () => {
    if (detectContractConfidence(contractText) < CONTRACT_CONFIDENCE_MIN) return;
    setInvestigating(true);
    try {
      const { contractorDisplay, secopSearchQuery } = extractContractorForInvestigation(contractText);
      const contractorName = contractorDisplay;
      console.log("Step 1: extracting contractor name", contractorName);

      const contractorNit = detectContractorNit(contractText);
      const entityName = detectEntityName(contractText);
      const pidaQuery = contractorDisplay !== "Contratista no identificado" ? contractorDisplay : secopSearchQuery;

      const url = "/api/secop?q=" + encodeURIComponent(secopSearchQuery);
      console.log("Step 2: calling SECOP API", url);

      let contracts: SecopContract[] = [];
      try {
        const res = await fetch(url);
        const data: unknown = await res.json();
        console.log("Step 3: SECOP response", data);
        contracts = Array.isArray(data) ? (data as SecopContract[]) : [];
        if (!res.ok) contracts = [];
      } catch (secopErr) {
        console.log("Step 3: SECOP request failed", secopErr);
        contracts = [];
      }

      const secopNotice =
        contracts.length === 0
          ? "No se encontraron contratos adicionales para este contratista"
          : "";

      console.log("Step 4: building results");
      setInvestigationResult(
        buildInvestigationPayload(contracts, contractorDisplay, pidaQuery, contractorNit, entityName, secopNotice),
      );
    } catch (err) {
      console.log("runDeepInvestigation outer catch", err);
      const { contractorDisplay, secopSearchQuery } = extractContractorForInvestigation(contractText);
      const pidaQuery = contractorDisplay !== "Contratista no identificado" ? contractorDisplay : secopSearchQuery;
      setInvestigationResult(
        buildInvestigationPayload(
          [],
          contractorDisplay,
          pidaQuery,
          detectContractorNit(contractText),
          detectEntityName(contractText),
          "No se encontraron contratos adicionales para este contratista",
        ),
      );
    } finally {
      setInvestigating(false);
    }
  }, [buildInvestigationPayload, contractText]);

  const buscarSecop = async () => {
    const query = secopQuery.trim();
    if (!query) return;
    setSecopLoading(true);
    setSecopError(null);
    setSecopResults([]);
    try {
      const url = "/api/secop?q=" + encodeURIComponent(query);
      const res = await fetch(url);
      const data: SecopContract[] = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        setSecopError("Sin resultados. Prueba: ICBF, Invias, Ministerio, Bogota");
      } else {
        setSecopResults(data);
      }
    } catch {
      setSecopError("Error de conexion con SECOP II");
    } finally {
      setSecopLoading(false);
    }
  };

  const buildContractTextFromSecop = (c: SecopContract): string => {
    const lines: string[] = [];
    if (c.objeto_del_contrato) lines.push("Objeto: " + c.objeto_del_contrato);
    if (c.nombre_entidad) lines.push("Entidad: " + c.nombre_entidad);
    if (c.valor_del_contrato) lines.push("Valor: $" + formatValor(c.valor_del_contrato) + " COP");
    if (c.modalidad_de_contratacion) lines.push("Modalidad: " + c.modalidad_de_contratacion);
    if (c.tipo_de_contrato) lines.push("Tipo: " + c.tipo_de_contrato);
    if (c.proveedor_adjudicado) lines.push("Contratista: " + c.proveedor_adjudicado);
    if (c.departamento) lines.push("Departamento: " + c.departamento);
    if (c.ciudad) lines.push("Ciudad: " + c.ciudad);
    if (c.fecha_de_firma) lines.push("Fecha firma: " + (c.fecha_de_firma || "").substring(0, 10));
    if (c.estado_contrato) lines.push("Estado: " + c.estado_contrato);
    if (c.descripcion_del_proceso) lines.push("Descripcion: " + c.descripcion_del_proceso);
    return lines.join("\n");
  };

  const cargarContrato = (c: SecopContract) => {
    const texto = buildContractTextFromSecop(c);
    setContractText(texto);
    setActiveTab("manual");
    setSecopResults([]);
  };

  const animateResults = async (data: AnalysisResult) => {
    setAnimRunning(true);
    setAnimFiscalProb(0);
    try {
      setPhase("scanning");
      await sleep(900);
      setPhase("scoring");
      setAnimSubmetrics(data.submetrics);
      await animateNumberOverMs(1200, (p) => {
        setAnimScore(Math.round(data.score * easeOutCubic(p)));
      });
      await sleep(300);
      setPhase("alerts");
      for (let i = 0; i < data.alerts.length; i++) {
        setAnimAlerts((prev) => [...prev, data.alerts[i]]);
        await sleep(500);
      }
      await sleep(400);
      setPhase("diagnosis");
      const text = data.explanation;
      for (let i = 0; i <= text.length; i++) {
        setAnimExplanation(text.substring(0, i));
        await sleep(18);
      }
      setPhase("done");
      const targetProb = Math.max(
        0,
        Math.min(100, Math.round(Number(data.prediction?.fiscal_impact_probability ?? 0))),
      );
      const fiscalSteps = 45;
      for (let i = 0; i <= fiscalSteps; i++) {
        setAnimFiscalProb(Math.round((targetProb / fiscalSteps) * i));
        await sleep(900 / fiscalSteps);
      }
    } finally {
      setAnimRunning(false);
    }
  };

  const analizar = async () => {
    const text = contractText.trim();
    if (!text) return;
    setInsufficientContract(false);
    setContractConfidenceValue(null);
    const confidenceGate = detectContractConfidence(text);
    if (confidenceGate < CONTRACT_CONFIDENCE_MIN) {
      setContractConfidenceValue(confidenceGate);
      setInsufficientContract(true);
      setError(null);
      setResult(null);
      setInvestigationResult(null);
      setShowFullAnalysis(false);
      setPhase("idle");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setInvestigationResult(null);
    setShowFullAnalysis(false);
    setAnimScore(0);
    setAnimAlerts([]);
    setAnimExplanation("");
    setAnimSubmetrics(null);
    setAnimFiscalProb(0);
    setPhase("idle");
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contract: text }),
      });
      const data = (await res.json()) as Record<string, unknown>;
      if (res.status === 422 && data.blocked === true) {
        const cc =
          typeof data.contractConfidence === "number" && Number.isFinite(data.contractConfidence)
            ? data.contractConfidence
            : confidenceGate;
        setContractConfidenceValue(cc);
        setInsufficientContract(true);
        setLoading(false);
        setPhase("idle");
        return;
      }
      if (!res.ok) throw new Error("Error del servidor: " + String(res.status));
      if (
        typeof data.score !== "number" ||
        !Array.isArray(data.alerts) ||
        !data.prediction ||
        !data.market_analysis ||
        !data.contractor_risk ||
        !data.entity_pattern ||
        !data.submetrics
      ) {
        throw new Error("Respuesta invalida");
      }
      const payload = data as unknown as AnalysisResult;
      setResult(payload);
      setLoading(false);
      await animateResults(payload);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      setLoading(false);
      setPhase("idle");
    }
  };

  const riskColor = (s: number) => (s >= 75 ? "#C62828" : s >= 50 ? "#E65100" : "#2E7D32");
  const riskLabel = (s: number) =>
    s >= 75 ? "RIESGO ALTO" : s >= 50 ? "RIESGO MEDIO" : "RIESGO BAJO";
  const riskBg = (s: number) => (s >= 75 ? "#FFEBEE" : s >= 50 ? "#FFF3E0" : "#E8F5E9");
  const riskBorder = (s: number) => (s >= 75 ? "#EF9A9A" : s >= 50 ? "#FFCC80" : "#A5D6A7");
  const subColor = (v: number) => (v < 40 ? "#C62828" : v < 65 ? "#E65100" : "#2E7D32");

  const card: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #DDE3EC",
    borderRadius: 10,
    padding: 16,
  };
  const revealCard = (delayMs: number): React.CSSProperties => ({
    opacity: 0,
    animation: "neurauditRevealCard 0.55s ease forwards",
    animationDelay: String(delayMs) + "ms",
  });
  const sectionLabel: React.CSSProperties = {
    fontSize: 9,
    color: "#003366",
    fontWeight: 700,
    letterSpacing: 2,
    marginBottom: 12,
  };
  const phaseLabel: Record<string, string> = {
    scanning: "Escaneando patrones de riesgo...",
    scoring: "Calculando indice de corrupcion...",
    alerts: "Identificando alertas...",
    diagnosis: "Generando diagnostico IA...",
    done: "",
  };
  const showPhaseButtonLabel = animRunning && phase !== "done";

  const urgencyStyle = (u: Urgency): React.CSSProperties => {
    if (u === "INMEDIATA") {
      return { background: "#FFEBEE", color: "#B71C1C", border: "1px solid #EF9A9A" };
    }
    if (u === "ALTA") {
      return { background: "#FFF3E0", color: "#E65100", border: "1px solid #FFCC80" };
    }
    if (u === "MEDIA") {
      return { background: "#FFFDE7", color: "#F57F17", border: "1px solid #FFF59D" };
    }
    return { background: "#E8F5E9", color: "#2E7D32", border: "1px solid #A5D6A7" };
  };

  const bandBadgeStyle = (b: RiskBand): React.CSSProperties => {
    if (b === "ALTO") {
      return { background: "#FFEBEE", color: "#C62828", border: "1px solid #EF9A9A" };
    }
    if (b === "MEDIO") {
      return { background: "#FFF8E1", color: "#F57F17", border: "1px solid #FFE082" };
    }
    return { background: "#E8F5E9", color: "#2E7D32", border: "1px solid #A5D6A7" };
  };

  const networkDashData = useMemo(() => {
    if (!investigationResult || !result) return null;
    return computeNetworkGraphData(investigationResult, result.score);
  }, [investigationResult, result]);

  return (
    <>
      <style>{`
        @keyframes neurauditAlertFade {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes neurauditRevealCard {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div
        style={{
          minHeight: "100vh",
          background: "#EEF2F7",
          fontFamily: "Segoe UI, Arial, sans-serif",
        }}
      >
        <div
          style={{
            background: "#003366",
            padding: "0 28px",
            height: 56,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 34,
                height: 34,
                background: "#F5A800",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 17,
                color: "#003366",
                fontWeight: 800,
              }}
            >
              AI
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#fff", letterSpacing: 1 }}>
                NeurAudit AI
              </div>
              <div
                style={{
                  fontSize: 9,
                  color: "rgba(255,255,255,0.45)",
                  letterSpacing: 1.5,
                }}
              >
                SISTEMA DE AUDITORIA - SECOP II COLOMBIA
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,0.45)",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#4CAF50",
                  display: "inline-block",
                }}
              />
              Sistema activo
            </span>
            <span
              style={{
                background: "#F5A800",
                color: "#003366",
                fontSize: 9,
                fontWeight: 700,
                padding: "3px 10px",
                borderRadius: 20,
                letterSpacing: 1,
              }}
            >
              COLOMBIA 5.0 HACKATHON
            </span>
          </div>
        </div>

        <div
          style={{
            background: "#fff",
            borderBottom: "1px solid #DDE3EC",
            padding: "8px 28px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 11, color: "#003366", fontWeight: 600 }}>
            Modulo de Deteccion de Riesgo en Contratacion Publica
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link
              href="/bases-datos"
              style={{
                background: "#F5A800",
                color: "#003366",
                padding: "4px 9px",
                borderRadius: 8,
                fontSize: 10,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Ver bases de datos
            </Link>
            <span style={{ fontSize: 10, color: "#999" }}>GobIA Auditor v2.0 - MinTIC 2026</span>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              phase === "done" && result ? "minmax(280px, 340px) minmax(0, 1fr)" : "1fr 1fr",
            gap: phase === "done" && result ? 12 : 16,
            padding: phase === "done" && result ? "14px 22px" : "18px 28px",
            maxWidth: phase === "done" && result ? 1720 : 1400,
            margin: "0 auto",
            alignItems: "start",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div
              style={{
                background: "#fff",
                border: "1px solid #DDE3EC",
                borderRadius: 10,
                overflow: "hidden",
                position: "relative",
              }}
              onDragEnter={onDragEnterManual}
              onDragOver={onDragOverManual}
              onDragLeave={onDragLeaveManual}
              onDrop={onDropManual}
            >
              <div style={{ display: "flex", borderBottom: "1px solid #DDE3EC" }}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("secop");
                  }}
                  onMouseEnter={(e) => {
                    if (activeTab !== "secop") {
                      e.currentTarget.style.background = "#E8EDF6";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeTab !== "secop") {
                      e.currentTarget.style.background = "#F5F7FA";
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: "11px 0",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 0.8,
                    background: activeTab === "secop" ? "#003366" : "#F5F7FA",
                    color: activeTab === "secop" ? "#fff" : "#888",
                    borderBottom: activeTab === "secop" ? "3px solid #F5A800" : "none",
                  }}
                >
                  BUSCAR EN SECOP II
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("manual");
                  }}
                  onMouseEnter={(e) => {
                    if (activeTab !== "manual") {
                      e.currentTarget.style.background = "#E8EDF6";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeTab !== "manual") {
                      e.currentTarget.style.background = "#F5F7FA";
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: "11px 0",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 0.8,
                    background: activeTab === "manual" ? "#003366" : "#F5F7FA",
                    color: activeTab === "manual" ? "#fff" : "#888",
                    borderBottom: activeTab === "manual" ? "3px solid #F5A800" : "none",
                  }}
                >
                  INGRESAR MANUALMENTE
                </button>
              </div>

              <div style={{ padding: 16 }}>
                {activeTab === "secop" && (
                  <div>
                    <div style={sectionLabel}>BUSQUEDA DIRECTA EN datos.gov.co</div>
                    <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                      <input
                        type="text"
                        value={secopQuery}
                        onChange={(e) => {
                          setSecopQuery(e.target.value);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") buscarSecop();
                        }}
                        placeholder="Ej: ICBF, Invias, Ministerio Salud..."
                        style={{
                          flex: 1,
                          padding: "10px 12px",
                          border: "1px solid #DDE3EC",
                          borderRadius: 7,
                          fontSize: 13,
                          outline: "none",
                          background: "#F5F7FA",
                          color: "#333",
                        }}
                      />
                      <button
                        type="button"
                        onClick={buscarSecop}
                        disabled={secopLoading}
                        onMouseEnter={(e) => {
                          if (!secopLoading) {
                            e.currentTarget.style.filter = "brightness(1.08)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.filter = "none";
                        }}
                        style={{
                          padding: "10px 16px",
                          background: secopLoading ? "#aaa" : "#003366",
                          border: "none",
                          borderRadius: 7,
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: 11,
                          cursor: secopLoading ? "not-allowed" : "pointer",
                        }}
                      >
                        {secopLoading ? "..." : "BUSCAR"}
                      </button>
                    </div>
                    {secopError && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "#C62828",
                          padding: "8px 12px",
                          background: "#FFEBEE",
                          borderRadius: 7,
                        }}
                      >
                        {secopError}
                      </div>
                    )}
                    {secopResults.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                          maxHeight: 320,
                          overflowY: "auto",
                          marginTop: 8,
                        }}
                      >
                        {secopResults.map((c, i) => (
                          <div
                            key={i}
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              cargarContrato(c);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                cargarContrato(c);
                              }
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "#E8EDF6";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "#F5F7FA";
                            }}
                            style={{
                              padding: "10px 12px",
                              background: "#F5F7FA",
                              border: "1px solid #DDE3EC",
                              borderLeft: "3px solid #003366",
                              borderRadius: "0 8px 8px 0",
                              cursor: "pointer",
                            }}
                          >
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: "6px 12px",
                                fontSize: 11,
                                color: "#334",
                              }}
                            >
                              <div>
                                <div style={{ fontSize: 9, color: "#888", marginBottom: 2 }}>
                                  Entidad
                                </div>
                                <div style={{ fontWeight: 700, color: "#003366" }}>
                                  {c.nombre_entidad || "—"}
                                </div>
                              </div>
                              <div>
                                <div style={{ fontSize: 9, color: "#888", marginBottom: 2 }}>
                                  Valor
                                </div>
                                <div>
                                  {c.valor_del_contrato
                                    ? "$ " + formatValor(c.valor_del_contrato) + " COP"
                                    : "—"}
                                </div>
                              </div>
                              <div>
                                <div style={{ fontSize: 9, color: "#888", marginBottom: 2 }}>
                                  Modalidad
                                </div>
                                <div>{c.modalidad_de_contratacion || "—"}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: 9, color: "#888", marginBottom: 2 }}>
                                  Estado
                                </div>
                                <div>{c.estado_contrato || "—"}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {!secopLoading && secopResults.length === 0 && !secopError && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "#bbb",
                          textAlign: "center",
                          padding: "24px 0",
                        }}
                      >
                        Ingresa el nombre de una entidad publica para buscar contratos reales
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "manual" && (
                  <div>
                    <div style={sectionLabel}>TEXTO DEL CONTRATO</div>
                    <textarea
                      value={contractText}
                      onChange={(e) => {
                        setContractText(e.target.value);
                      }}
                      placeholder="Pega aqui el texto del contrato publico..."
                      style={{
                        width: "100%",
                        height: 240,
                        padding: "14px 16px",
                        background: "#F5F7FA",
                        color: "#334",
                        border: "1px solid #DDE3EC",
                        borderRadius: 8,
                        fontSize: 13,
                        lineHeight: 1.7,
                        resize: "vertical",
                        outline: "none",
                        fontFamily: "monospace",
                        boxSizing: "border-box",
                      }}
                    />
                    <div
                      style={{
                        marginTop: 8,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          fileInputRef.current?.click();
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#E8EDF6";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "#F5F7FA";
                        }}
                        style={{
                          border: "1px solid #DDE3EC",
                          background: "#F5F7FA",
                          color: "#003366",
                          borderRadius: 8,
                          padding: "6px 10px",
                          fontSize: 11,
                          fontWeight: 700,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          cursor: "pointer",
                        }}
                      >
                        <Paperclip size={14} />
                        Subir archivo
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.txt,.docx"
                        onChange={onFileInputChange}
                        style={{ display: "none" }}
                      />
                      <div style={{ fontSize: 10, color: "#bbb", textAlign: "right" }}>
                        {contractText.length} caracteres
                      </div>
                    </div>
                  </div>
                )}
                {activeTab === "manual" && isDragOver && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "rgba(232, 237, 246, 0.94)",
                      border: "2px dashed #003366",
                      borderRadius: 10,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      zIndex: 9,
                      pointerEvents: "none",
                    }}
                  >
                    <div
                      style={{
                        background: "#fff",
                        color: "#003366",
                        fontSize: 16,
                        fontWeight: 800,
                        padding: "14px 22px",
                        borderRadius: 10,
                        border: "1px solid #DDE3EC",
                      }}
                    >
                      Suelta el archivo aqui
                    </div>
                  </div>
                )}
              </div>
            </div>
            {fileToast && (
              <div
                style={{
                  marginTop: -6,
                  background: "#E8F5E9",
                  border: "1px solid #A5D6A7",
                  color: "#1B5E20",
                  borderRadius: 8,
                  padding: "7px 10px",
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {fileToast}
              </div>
            )}

            <button
              type="button"
              onClick={analizar}
              disabled={loading || animRunning}
              onMouseEnter={(e) => {
                if (!(loading || animRunning)) {
                  e.currentTarget.style.background = "#00264d";
                }
              }}
              onMouseLeave={(e) => {
                if (!(loading || animRunning)) {
                  e.currentTarget.style.background = "#003366";
                }
              }}
              style={{
                width: "100%",
                padding: "16px 0",
                background: loading || animRunning ? "#ccc" : "#003366",
                border: "none",
                borderRadius: 10,
                color: loading || animRunning ? "#888" : "#fff",
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: 2,
                cursor: loading || animRunning ? "not-allowed" : "pointer",
                boxShadow:
                  loading || animRunning ? "none" : "0 4px 14px rgba(0,51,102,0.25)",
              }}
            >
              {loading
                ? "ENVIANDO AL MOTOR IA..."
                : showPhaseButtonLabel
                  ? phaseLabel[phase]
                  : "EJECUTAR ANALISIS DE RIESGO"}
            </button>

            <div style={card}>
              <div style={sectionLabel}>MOTOR DEL SISTEMA</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {[
                  { label: "Motor IA", value: "NeurAudit" },
                  { label: "Fuente", value: "SECOP II" },
                  { label: "Version", value: "2.0.0" },
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{
                      background: "#F0F4FA",
                      borderRadius: 8,
                      padding: "10px 8px",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: 8, color: "#888", marginBottom: 2 }}>{item.label}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#003366" }}>
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={card}>
              <div style={sectionLabel}>SENALES DE ALERTA MONITOREADAS</div>
              {SIGNALS.map((s, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 9,
                    padding: "7px 0",
                    borderBottom:
                      i < SIGNALS.length - 1 ? "1px solid #F0F4FA" : "none",
                    fontSize: 12,
                    color: "#4A6080",
                    lineHeight: 1.4,
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "#F5A800",
                      flexShrink: 0,
                      marginTop: 4,
                    }}
                  />
                  {s}
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {insufficientContract && !result ? (
              <div
                style={{
                  ...card,
                  background: "linear-gradient(145deg, #FFFBEB 0%, #FEF3C7 100%)",
                  border: "2px solid #F59E0B",
                  borderRadius: 12,
                  padding: "18px 16px",
                  boxShadow: "0 10px 32px rgba(245, 158, 11, 0.22)",
                }}
              >
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      background: "rgba(245, 158, 11, 0.25)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <AlertTriangle size={26} strokeWidth={2.3} color="#D97706" />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 900,
                        color: "#92400E",
                        letterSpacing: 0.4,
                        marginBottom: 8,
                      }}
                    >
                      TEXTO INSUFICIENTE PARA ANALISIS CONTRACTUAL
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 12,
                        color: "#78350F",
                        lineHeight: 1.55,
                        fontWeight: 600,
                      }}
                    >
                      No se detectaron suficientes patrones de contratación pública en el documento
                      proporcionado.
                    </p>
                    <div
                      style={{
                        marginTop: 10,
                        fontSize: 11,
                        fontWeight: 800,
                        color: "#B45309",
                      }}
                    >
                      Validez documental estimada: {contractConfidenceValue ?? 0}/100 — se requiere ≥{" "}
                      {CONTRACT_CONFIDENCE_MIN} para activar el motor IA completo.
                    </div>
                    <ul
                      style={{
                        margin: "12px 0 0",
                        paddingLeft: 18,
                        fontSize: 12,
                        color: "#78350F",
                        lineHeight: 1.65,
                        fontWeight: 600,
                      }}
                    >
                      <li>Subir o pegar texto exportado desde SECOP II</li>
                      <li>Incluir el objeto contractual completo</li>
                      <li>Incluir entidad contratante y contratista / proveedor (y NIT si aplica)</li>
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {phase === "done" && result && (
              <HackathonResultsDashboard
                result={result}
                investigationResult={investigationResult}
                networkDashData={networkDashData}
                investigating={investigating}
                runDeepInvestigation={runDeepInvestigation}
                showFullAnalysis={showFullAnalysis}
                onToggleFullAnalysis={() => setShowFullAnalysis((v) => !v)}
                animFiscalProb={animFiscalProb}
                displayRiskScore={animScore}
                compactAlerts={animAlerts}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 6 }}>
                  <div style={card}>
                    <div style={sectionLabel}>ALERTAS DETECTADAS</div>
                    {animAlerts.map((a, i) => (
                      <div
                        key={i + "-" + a.slice(0, 24)}
                        style={{
                          display: "flex",
                          gap: 10,
                          padding: "9px 12px",
                          background: "#FFF8F0",
                          border: "1px solid #FFD9A0",
                          borderLeft: "3px solid #F5A800",
                          borderRadius: "0 8px 8px 0",
                          marginBottom: 7,
                          fontSize: 12,
                          color: "#4A3000",
                          lineHeight: 1.4,
                        }}
                      >
                        <span style={{ color: "#F5A800", flexShrink: 0 }}>!</span>
                        {a}
                      </div>
                    ))}
                  </div>
                  <div style={card}>
                    <div style={sectionLabel}>DIAGNOSTICO IA · TEXTO COMPLETO</div>
                    <p style={{ fontSize: 13, lineHeight: 1.75, color: "#4A6080", margin: 0 }}>
                      {result.explanation}
                    </p>
                  </div>
                  {investigationResult && (
                    <div style={{ ...card, ...revealCard(0) }}>
                      <div style={sectionLabel}>INVESTIGACION · EXPEDIENTE EXTENDIDO</div>
                      <div
                        style={{
                          border: "1px solid #DDE3EC",
                          background: "#F8FAFD",
                          borderRadius: 10,
                          padding: 12,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            color: "#003366",
                            letterSpacing: 1.1,
                            marginBottom: 8,
                          }}
                        >
                          EXPEDIENTE DIGITAL - {investigationResult.contractorName}
                        </div>
                        {investigationResult.secopNotice && (
                          <div
                            style={{
                              marginBottom: 8,
                              padding: "7px 9px",
                              background: "#FFF8E1",
                              border: "1px solid #FFE082",
                              borderRadius: 8,
                              fontSize: 12,
                              color: "#5D4037",
                            }}
                          >
                            {investigationResult.secopNotice}
                          </div>
                        )}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          <div style={{ fontSize: 12, color: "#4A6080" }}>
                            <strong>Total contratos SECOP II:</strong> {investigationResult.totalContracts}
                          </div>
                          <div style={{ fontSize: 12, color: "#4A6080" }}>
                            <strong>Entidades diferentes:</strong> {investigationResult.differentEntities}
                          </div>
                          <div style={{ fontSize: 12, color: "#4A6080" }}>
                            <strong>Valor total contratado:</strong>{" "}
                            {"$ " + investigationResult.totalValue.toLocaleString("es-CO") + " COP"}
                          </div>
                        </div>
                        <div
                          style={{
                            marginTop: 8,
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 7,
                          }}
                        >
                          <a
                            href={
                              "https://portal.paco.gov.co/index.php?pagina=contratista&identificacion=" +
                              encodeURIComponent(investigationResult.contractorNit || "0")
                            }
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              textDecoration: "none",
                              background: "#003366",
                              color: "#fff",
                              borderRadius: 8,
                              padding: "5px 9px",
                              fontSize: 10,
                              fontWeight: 700,
                            }}
                          >
                            Ver contratista en PACO
                            <ExternalLink size={12} />
                          </a>
                          <a
                            href="https://portal.paco.gov.co/index.php?pagina=entidad&identificacion=0"
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              textDecoration: "none",
                              background: "#003366",
                              color: "#fff",
                              borderRadius: 8,
                              padding: "5px 9px",
                              fontSize: 10,
                              fontWeight: 700,
                            }}
                          >
                            Ver entidad en PACO
                            <ExternalLink size={12} />
                          </a>
                          <a
                            href={
                              "https://www.datos.gov.co/browse?q=" +
                              encodeURIComponent(investigationResult.pidaQuery) +
                              "&sortBy=relevance"
                            }
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              textDecoration: "none",
                              background: "#F5A800",
                              color: "#003366",
                              borderRadius: 8,
                              padding: "5px 9px",
                              fontSize: 10,
                              fontWeight: 800,
                            }}
                          >
                            Buscar en PIDA - datos.gov.co
                            <ExternalLink size={12} />
                          </a>
                        </div>
                        {investigationResult.entityName && (
                          <div style={{ marginTop: 8, fontSize: 11, color: "#5A728E" }}>
                            Entidad detectada en contrato:{" "}
                            <strong style={{ color: "#003366" }}>{investigationResult.entityName}</strong>
                          </div>
                        )}
                        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                          <div
                            style={{
                              fontSize: 12,
                              borderRadius: 8,
                              padding: "8px 10px",
                              background: investigationResult.concentrationRisk ? "#FFF3E0" : "#E8F5E9",
                              color: investigationResult.concentrationRisk ? "#E65100" : "#2E7D32",
                              border:
                                "1px solid " +
                                (investigationResult.concentrationRisk ? "#FFCC80" : "#A5D6A7"),
                            }}
                          >
                            <strong>Riesgo de concentración:</strong>{" "}
                            {investigationResult.concentrationRisk
                              ? "Entidad repetida mas de 3 veces (" +
                                investigationResult.concentrationEntity +
                                ")"
                              : "No detectado"}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              borderRadius: 8,
                              padding: "8px 10px",
                              background: investigationResult.fraccionamientoRisk ? "#FFF3E0" : "#E8F5E9",
                              color: investigationResult.fraccionamientoRisk ? "#E65100" : "#2E7D32",
                              border:
                                "1px solid " +
                                (investigationResult.fraccionamientoRisk ? "#FFCC80" : "#A5D6A7"),
                            }}
                          >
                            <strong>Patrón de fraccionamiento:</strong>{" "}
                            {investigationResult.fraccionamientoRisk
                              ? "Valores cercanos a umbral detectados (" +
                                investigationResult.fraccionamientoCount +
                                ")"
                              : "No detectado"}
                          </div>
                        </div>
                        {investigationResult.valueTimeline.length > 0 && (
                          <div style={{ marginTop: 12 }}>
                            <div
                              style={{
                                fontSize: 10,
                                fontWeight: 800,
                                color: "#003366",
                                letterSpacing: 1,
                                marginBottom: 8,
                              }}
                            >
                              CONTRATOS EN EL TIEMPO
                            </div>
                            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 96 }}>
                              {(() => {
                                const maxVal = Math.max(
                                  ...investigationResult.valueTimeline.map((x) => x.value),
                                  1,
                                );
                                return investigationResult.valueTimeline.map((item, idx) => (
                                  <div
                                    key={idx + item.label}
                                    title={item.label + " - $" + item.value.toLocaleString("es-CO")}
                                    style={{
                                      flex: 1,
                                      minWidth: 14,
                                      background: "#003366",
                                      height:
                                        String(
                                          Math.max(8, Math.round((item.value / maxVal) * 100)),
                                        ) + "%",
                                      borderRadius: "6px 6px 0 0",
                                      position: "relative",
                                    }}
                                  >
                                    <span
                                      style={{
                                        position: "absolute",
                                        bottom: -16,
                                        left: "50%",
                                        transform: "translateX(-50%)",
                                        fontSize: 9,
                                        color: "#68809B",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {item.label}
                                    </span>
                                  </div>
                                ));
                              })()}
                            </div>
                          </div>
                        )}
                        {investigationResult.contractDetails.length > 0 && (
                          <div style={{ marginTop: 18 }}>
                            <div
                              style={{
                                fontSize: 10,
                                fontWeight: 800,
                                color: "#003366",
                                letterSpacing: 1,
                                marginBottom: 8,
                              }}
                            >
                              DETALLE DE CONTRATOS
                            </div>
                            <div
                              style={{
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
                                    <th
                                      style={{ textAlign: "left", padding: "8px 9px", color: "#003366" }}
                                    >
                                      Objeto del contrato
                                    </th>
                                    <th
                                      style={{ textAlign: "left", padding: "8px 9px", color: "#003366" }}
                                    >
                                      Entidad
                                    </th>
                                    <th
                                      style={{ textAlign: "left", padding: "8px 9px", color: "#003366" }}
                                    >
                                      Valor
                                    </th>
                                    <th
                                      style={{ textAlign: "left", padding: "8px 9px", color: "#003366" }}
                                    >
                                      Fecha firma
                                    </th>
                                    <th
                                      style={{ textAlign: "left", padding: "8px 9px", color: "#003366" }}
                                    >
                                      Estado
                                    </th>
                                    <th
                                      style={{ textAlign: "left", padding: "8px 9px", color: "#003366" }}
                                    >
                                      SECOP
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {investigationResult.contractDetails.map((c, idx) => {
                                    const estadoNorm = c.estado.toLowerCase();
                                    const isTerminado = estadoNorm.includes("terminado");
                                    const isEjecucion = estadoNorm.includes("ejecuc");
                                    const estadoBg = isTerminado
                                      ? "#E8F5E9"
                                      : isEjecucion
                                        ? "#FFF8E1"
                                        : "#FFEBEE";
                                    const estadoColor = isTerminado
                                      ? "#2E7D32"
                                      : isEjecucion
                                        ? "#E65100"
                                        : "#C62828";
                                    const estadoBorder = isTerminado
                                      ? "#A5D6A7"
                                      : isEjecucion
                                        ? "#FFE082"
                                        : "#EF9A9A";
                                    return (
                                      <tr key={idx + c.entidad + c.fechaFirma}>
                                        <td
                                          style={{
                                            borderBottom: "1px solid #EEF2F7",
                                            padding: "7px 9px",
                                            color: "#324A63",
                                          }}
                                          title={c.objeto}
                                        >
                                          {c.objeto.length > 60
                                            ? c.objeto.slice(0, 60) + "..."
                                            : c.objeto}
                                        </td>
                                        <td
                                          style={{
                                            borderBottom: "1px solid #EEF2F7",
                                            padding: "7px 9px",
                                            color: "#324A63",
                                          }}
                                        >
                                          {c.entidad}
                                        </td>
                                        <td
                                          style={{
                                            borderBottom: "1px solid #EEF2F7",
                                            padding: "7px 9px",
                                            color: "#324A63",
                                          }}
                                        >
                                          {"$ " + c.valor.toLocaleString("es-CO") + " COP"}
                                        </td>
                                        <td
                                          style={{
                                            borderBottom: "1px solid #EEF2F7",
                                            padding: "7px 9px",
                                            color: "#324A63",
                                          }}
                                        >
                                          {c.fechaFirma}
                                        </td>
                                        <td
                                          style={{
                                            borderBottom: "1px solid #EEF2F7",
                                            padding: "7px 9px",
                                          }}
                                        >
                                          <span
                                            style={{
                                              display: "inline-block",
                                              borderRadius: 12,
                                              padding: "2px 8px",
                                              fontWeight: 700,
                                              fontSize: 10,
                                              background: estadoBg,
                                              color: estadoColor,
                                              border: "1px solid " + estadoBorder,
                                            }}
                                          >
                                            {c.estado}
                                          </span>
                                        </td>
                                        <td
                                          style={{
                                            borderBottom: "1px solid #EEF2F7",
                                            padding: "7px 9px",
                                          }}
                                        >
                                          {c.url ? (
                                            <a
                                              href={c.url}
                                              target="_blank"
                                              rel="noreferrer"
                                              style={{
                                                color: "#003366",
                                                fontWeight: 700,
                                                textDecoration: "none",
                                              }}
                                            >
                                              Ver en SECOP
                                            </a>
                                          ) : (
                                            <span style={{ color: "#99A8BA" }}>No disponible</span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                        <div style={{ marginTop: 16 }}>
                          <div
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              color: "#003366",
                              letterSpacing: 1,
                              marginBottom: 7,
                            }}
                          >
                            FUENTES CONSULTADAS
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                            <span
                              style={{
                                background: "#003366",
                                color: "#fff",
                                borderRadius: 16,
                                fontSize: 10,
                                fontWeight: 700,
                                padding: "4px 10px",
                              }}
                            >
                              SECOP II - datos.gov.co
                            </span>
                            <span
                              style={{
                                background: "#003366",
                                color: "#fff",
                                borderRadius: 16,
                                fontSize: 10,
                                fontWeight: 700,
                                padding: "4px 10px",
                              }}
                            >
                              PACO
                            </span>
                            <span
                              style={{
                                background: "#F5A800",
                                color: "#003366",
                                borderRadius: 16,
                                fontSize: 10,
                                fontWeight: 800,
                                padding: "4px 10px",
                              }}
                            >
                              PIDA - OEA
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div style={{ ...card, ...revealCard(0) }}>
                    <div style={sectionLabel}>PREDICCION FISCAL IA · DETALLE</div>
                    <div style={{ fontSize: 38, fontWeight: 800, color: "#003366", lineHeight: 1.1 }}>
                      {animFiscalProb}
                      <span style={{ fontSize: 18, fontWeight: 700 }}>%</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#4A6080", marginTop: 4, marginBottom: 12 }}>
                      probabilidad de hallazgo fiscal o actuación de control
                    </div>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 800,
                        color: "#C62828",
                        marginBottom: 10,
                      }}
                    >
                      {result.prediction.estimated_fiscal_damage}
                    </div>
                    <div
                      style={{
                        display: "inline-block",
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "4px 14px",
                        borderRadius: 20,
                        letterSpacing: 1,
                        marginBottom: 10,
                        ...urgencyStyle(result.prediction.urgency),
                      }}
                    >
                      URGENCIA: {result.prediction.urgency}
                    </div>
                    <p style={{ fontSize: 12, lineHeight: 1.65, color: "#4A6080", margin: 0 }}>
                      {result.prediction.fiscal_damage_reasoning}
                    </p>
                  </div>
                  <div style={{ ...card, ...revealCard(90) }}>
                    <div style={sectionLabel}>ACCIONES RECOMENDADAS</div>
                    <ol style={{ margin: 0, padding: "0 0 0 0", listStyle: "none" as const }}>
                      {result.prediction.recommended_actions.map((action, idx) => (
                        <li
                          key={idx}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 10,
                            padding: "10px 12px",
                            marginBottom: 8,
                            borderLeft: "3px solid #F5A800",
                            borderRadius: "0 8px 8px 0",
                            background: "#F8FAFC",
                            fontSize: 13,
                            color: "#003366",
                            lineHeight: 1.5,
                            fontWeight: 600,
                          }}
                        >
                          <CheckSquare
                            size={18}
                            strokeWidth={2.2}
                            color="#F5A800"
                            style={{ flexShrink: 0, marginTop: 2 }}
                          />
                          <span>
                            <span style={{ color: "#F5A800", marginRight: 8 }}>{idx + 1}.</span>
                            {action}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div style={{ ...card, ...revealCard(180) }}>
                    <div style={sectionLabel}>ANALISIS DE PRECIO DE MERCADO</div>
                    {(() => {
                      const dev = result.market_analysis.price_deviation_percent;
                      const w = Math.min(100, Math.max(dev === 0 ? 0 : 4, Math.abs(dev)));
                      const fillColor = dev <= 0 ? "#2E7D32" : "#C62828";
                      const sign = dev > 0 ? "+" : "";
                      return (
                        <>
                          <div style={{ fontSize: 11, color: "#666", marginBottom: 6 }}>
                            Desviación estimada vs. mercado:{" "}
                            <strong style={{ color: "#003366" }}>
                              {sign}
                              {dev}%
                            </strong>
                            {dev > 0 ? " (sobreprecio)" : dev < 0 ? " (precio favorable)" : ""}
                          </div>
                          <div
                            style={{
                              height: 12,
                              background: "#E8EDF4",
                              borderRadius: 6,
                              overflow: "hidden",
                              marginBottom: 12,
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: w + "%",
                                background: fillColor,
                                borderRadius: 6,
                                transition: "width 0.4s ease",
                              }}
                            />
                          </div>
                          <div style={{ fontSize: 12, color: "#4A6080", marginBottom: 10 }}>
                            Referencia de mercado:{" "}
                            <span style={{ fontWeight: 700, color: "#003366" }}>
                              {result.market_analysis.market_average_estimate}
                            </span>
                          </div>
                          <div
                            style={{
                              display: "inline-block",
                              fontSize: 10,
                              fontWeight: 700,
                              padding: "4px 14px",
                              borderRadius: 20,
                              letterSpacing: 1,
                              ...bandBadgeStyle(result.market_analysis.price_risk),
                            }}
                          >
                            RIESGO DE PRECIO: {result.market_analysis.price_risk}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  <div style={{ ...card, ...revealCard(270) }}>
                    <div style={sectionLabel}>PERFIL DE RIESGO DEL CONTRATISTA</div>
                    <div style={{ marginBottom: 10 }}>
                      <span
                        style={{
                          display: "inline-block",
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "4px 14px",
                          borderRadius: 20,
                          letterSpacing: 1,
                          ...bandBadgeStyle(result.contractor_risk.concentration_risk),
                        }}
                      >
                        CONCENTRACIÓN: {result.contractor_risk.concentration_risk}
                      </span>
                    </div>
                    {result.contractor_risk.experience_flag && (
                      <div
                        style={{
                          padding: "10px 12px",
                          background: "#FFF8E1",
                          border: "1px solid #FFE082",
                          borderRadius: 8,
                          fontSize: 12,
                          color: "#E65100",
                          fontWeight: 700,
                          marginBottom: 10,
                        }}
                      >
                        Alerta: posible falta de experiencia o debilidad en trayectoria del contratista.
                      </div>
                    )}
                    <p style={{ fontSize: 13, lineHeight: 1.65, color: "#4A6080", margin: 0 }}>
                      {result.contractor_risk.risk_summary}
                    </p>
                    {result.entity_pattern.pattern_detected && (
                      <div
                        style={{
                          marginTop: 12,
                          padding: "12px 14px",
                          background: "#FFF8F0",
                          border: "1px solid #F5A800",
                          borderLeft: "4px solid #F5A800",
                          borderRadius: "0 10px 10px 0",
                          fontSize: 12,
                          color: "#4A3000",
                          lineHeight: 1.55,
                        }}
                      >
                        <div style={{ fontWeight: 800, color: "#003366", marginBottom: 6 }}>
                          Patrón en entidad / procedimiento
                        </div>
                        {result.entity_pattern.pattern_description}
                      </div>
                    )}
                  </div>
                </div>
              </HackathonResultsDashboard>
            )}
            {!(phase === "done" && result) && (
              <>
            <div
              style={{
                ...card,
                background: result ? riskBg(result.score) : "#fff",
                border: "1px solid " + (result ? riskBorder(result.score) : "#DDE3EC"),
                textAlign: "center",
              }}
            >
              <div style={sectionLabel}>INDICE DE RIESGO DE CORRUPCION</div>
              {phase === "idle" && !result && (
                <div style={{ padding: "28px 0", color: "#ccc", fontSize: 13 }}>
                  Esperando analisis
                </div>
              )}
              {(loading || phase === "scanning") && (
                <div style={{ padding: "28px 0" }}>
                  <div style={{ color: "#888", fontSize: 12, letterSpacing: 1 }}>
                    Escaneando patrones de riesgo...
                  </div>
                </div>
              )}
              {(phase === "scoring" ||
                phase === "alerts" ||
                phase === "diagnosis" ||
                phase === "done") &&
                result && (
                  <>
                    <div
                      style={{
                        width: 110,
                        height: 110,
                        borderRadius: "50%",
                        border: "7px solid " + riskColor(result.score),
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 12px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 40,
                          fontWeight: 800,
                          color: riskColor(result.score),
                          lineHeight: 1,
                        }}
                      >
                        {animScore}
                      </div>
                      <div style={{ fontSize: 9, color: riskColor(result.score) }}>/ 100</div>
                    </div>
                    <div
                      style={{
                        display: "inline-block",
                        background: riskBg(result.score),
                        border: "1px solid " + riskBorder(result.score),
                        color: riskColor(result.score),
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "4px 16px",
                        borderRadius: 20,
                        letterSpacing: 1.5,
                        marginBottom: 12,
                      }}
                    >
                      {riskLabel(result.score)}
                    </div>
                    <div
                      style={{
                        height: 7,
                        background: "#E8EDF4",
                        borderRadius: 4,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: animScore + "%",
                          background:
                            "linear-gradient(90deg, #F5A800, " + riskColor(result.score) + ")",
                          borderRadius: 4,
                        }}
                      />
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 9,
                        color: "#aaa",
                        marginTop: 4,
                      }}
                    >
                      <span>Bajo</span>
                      <span>Medio</span>
                      <span>Alto</span>
                    </div>
                  </>
                )}
            </div>

            {animSubmetrics &&
              (phase === "scoring" ||
                phase === "alerts" ||
                phase === "diagnosis" ||
                phase === "done") && (
                <div style={card}>
                  <div style={sectionLabel}>METRICAS DETALLADAS</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {[
                      { label: "Transparencia", value: animSubmetrics.transparencia },
                      { label: "Competencia", value: animSubmetrics.competencia },
                      { label: "Legalidad", value: animSubmetrics.legalidad },
                      { label: "Precio justo", value: animSubmetrics.precio },
                    ].map((m) => (
                      <div
                        key={m.label}
                        style={{
                          background: "#F5F7FA",
                          borderRadius: 8,
                          padding: "10px 12px",
                        }}
                      >
                        <div style={{ fontSize: 9, color: "#888", marginBottom: 4 }}>{m.label}</div>
                        <div
                          style={{
                            fontSize: 16,
                            fontWeight: 800,
                            color: subColor(m.value),
                          }}
                        >
                          {m.value}%
                        </div>
                        <div
                          style={{
                            height: 4,
                            background: "#DDE3EC",
                            borderRadius: 2,
                            marginTop: 5,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: m.value + "%",
                              background: subColor(m.value),
                              borderRadius: 2,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            <div style={card}>
              <div style={sectionLabel}>
                ALERTAS DETECTADAS{" "}
                {animAlerts.length > 0 ? "(" + String(animAlerts.length) + ")" : ""}
              </div>
              {phase === "idle" && !result && (
                <div style={{ fontSize: 12, color: "#ccc" }}>Sin alertas - ejecute un analisis</div>
              )}
              {(loading || phase === "scanning" || phase === "scoring") && (
                <div style={{ fontSize: 12, color: "#aaa" }}>Detectando senales...</div>
              )}
              {animAlerts.map((a, i) => (
                <div
                  key={i + "-" + a.slice(0, 24)}
                  style={{
                    display: "flex",
                    gap: 10,
                    padding: "9px 12px",
                    background: "#FFF8F0",
                    border: "1px solid #FFD9A0",
                    borderLeft: "3px solid #F5A800",
                    borderRadius: "0 8px 8px 0",
                    marginBottom: 7,
                    fontSize: 12,
                    color: "#4A3000",
                    lineHeight: 1.4,
                    animation: "neurauditAlertFade 0.45s ease forwards",
                  }}
                >
                  <span style={{ color: "#F5A800", flexShrink: 0 }}>!</span>
                  {a}
                </div>
              ))}
            </div>

            <div style={card}>
              <div style={sectionLabel}>DIAGNOSTICO IA - LENGUAJE NATURAL</div>
              {phase === "idle" && !result && (
                <div style={{ fontSize: 12, color: "#ccc" }}>Sin diagnostico - ejecute un analisis</div>
              )}
              {(loading || phase === "scanning" || phase === "scoring" || phase === "alerts") &&
                !animExplanation && (
                  <div style={{ fontSize: 12, color: "#aaa" }}>Preparando diagnostico...</div>
                )}
              {error && (
                <div
                  style={{
                    fontSize: 12,
                    color: "#C62828",
                    padding: "8px 12px",
                    background: "#FFEBEE",
                    borderRadius: 7,
                  }}
                >
                  {error}
                </div>
              )}
              {animExplanation && (
                <p style={{ fontSize: 13, lineHeight: 1.8, color: "#4A6080" }}>{animExplanation}</p>
              )}
            </div>
            </>
            )}
              </>
            )}

          </div>
        </div>

        <div
          style={{
            background: "#003366",
            padding: "10px 28px",
            display: "flex",
            justifyContent: "space-between",
            fontSize: 9,
            color: "rgba(255,255,255,0.3)",
            letterSpacing: 1,
          }}
        >
          <span>NEURAUDIT AI - COLOMBIA 5.0 - 2026</span>
          <span>DATOS ABIERTOS - datos.gov.co - SECOP II</span>
        </div>
      </div>
    </>
  );
}

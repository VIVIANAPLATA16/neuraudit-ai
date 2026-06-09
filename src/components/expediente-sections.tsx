"use client"

import { motion } from "framer-motion"
import {
  Shield, FileText, AlertTriangle, Users, Scale, Database, Clock,
} from "lucide-react"
import { IntelligenceSections } from "@/components/intelligence-sections"
import { AIAnalystPanel } from "@/components/ai-analyst-panel"
import { formatCOP } from "@/lib/utils"
import type { SearchResult, AnalystAnalysis } from "@/lib/types"
import type { InvestigationAnalytics } from "@/lib/data-analytics"

interface ExpedienteSectionsProps {
  result: SearchResult
  analytics: InvestigationAnalytics
  analisisIA?: AnalystAnalysis | null
  analisisLoading?: boolean
}

export function ExpedienteSections({ result, analytics, analisisIA, analisisLoading }: ExpedienteSectionsProps) {
  const { riesgo, interpretacion: interp, query } = result

  return (
    <div className="space-y-8">
      {/* Portada / Ficha técnica */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-8">
        <p className="text-xs text-primary font-semibold uppercase tracking-wider mb-2">Expediente de Auditoría</p>
        <h2 className="text-3xl font-bold text-foreground mb-2">{query}</h2>
        <p className="text-sm text-muted-foreground">
          {new Date(result.timestamp).toLocaleString("es-CO")} · Score {riesgo.score}/100 · {interp?.clasificacion || riesgo.nivel}
        </p>
      </motion.div>

      {/* Ficha Técnica */}
      <Section icon={Database} title="Ficha Técnica">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Metric label="Registros analizados" value={String(result.fuentes.total)} />
          <Metric label="Contratos" value={String(riesgo.totalContratos)} />
          <Metric label="Valor contratado" value={formatCOP(riesgo.valorTotal)} />
          <Metric label="Entidades únicas" value={String(riesgo.entidadesUnicas)} />
          <Metric label="Directos" value={String(riesgo.directos)} />
          <Metric label="Sin competencia" value={String(riesgo.sinCompetencia)} />
          <Metric label="Procuraduría" value={String(result.fuentes.procuraduria)} />
          <Metric label="CGR fiscal" value={formatCOP(riesgo.montoCGR)} />
        </div>
      </Section>

      {/* Matriz de Riesgos */}
      <Section icon={Scale} title="Matriz de Riesgos">
        <div className="space-y-2">
          {riesgo.scoreBreakdown.map((f, i) => (
            <div key={i} className="flex justify-between p-3 rounded-xl bg-primary/5 border border-primary/20 text-sm">
              <span className="text-foreground">{f.factor}</span>
              <span className="font-bold text-primary">+{f.points}</span>
            </div>
          ))}
        </div>
      </Section>

      <IntelligenceSections
        riesgo={riesgo}
        interpretacion={interp}
        analisisIA={null}
        analisisLoading={false}
      />

      {/* Contratos relevantes */}
      <Section icon={FileText} title="Contratos Relevantes (Top 10)">
        <div className="space-y-2">
          {analytics.topContratos.map((c, i) => (
            <div key={i} className="p-3 rounded-xl bg-muted/30 border border-border text-sm">
              <p className="font-medium text-foreground">#{i + 1} {c.proveedor}</p>
              <p className="text-muted-foreground">{c.entidad} · {c.valorFmt} · {c.modalidad}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Proveedores */}
      <Section icon={Users} title="Proveedores Relevantes">
        <div className="space-y-2">
          {analytics.top10Proveedores.map((p, i) => (
            <div key={i} className="flex justify-between p-3 rounded-xl bg-muted/30 text-sm">
              <span className="text-foreground">{p.nombre}</span>
              <span className="text-muted-foreground">{p.contratos} ctr · {p.valorFmt} ({p.participacionPct}%)</span>
            </div>
          ))}
        </div>
        <p className="text-sm text-muted-foreground mt-3">
          Concentración Top 5: {analytics.concentracionTop5Pct}% · Top 10: {analytics.concentracionTop10Pct}%
        </p>
      </Section>

      {/* Disciplinarios / Fiscales */}
      <Section icon={AlertTriangle} title="Registros Disciplinarios y Fiscales">
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div className="p-4 rounded-xl bg-warning/5 border border-warning/20">
            <p className="font-semibold text-foreground">Procuraduría</p>
            <p className="text-2xl font-bold text-foreground">{result.fuentes.procuraduria}</p>
            <p className="text-xs text-muted-foreground mt-1">Registros disciplinarios consultados</p>
          </div>
          <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20">
            <p className="font-semibold text-foreground">Responsabilidad Fiscal</p>
            <p className="text-2xl font-bold text-foreground">{formatCOP(riesgo.montoCGR)}</p>
            <p className="text-xs text-muted-foreground mt-1">{result.fuentes.cgr} fallo(s) CGR</p>
          </div>
        </div>
      </Section>

      {/* Análisis IA */}
      <AIAnalystPanel analysis={analisisIA} loading={analisisLoading} />

      {/* Anexos / Trazabilidad */}
      <Section icon={Clock} title="Anexos y Trazabilidad">
        <ul className="space-y-1 text-sm text-muted-foreground">
          {(interp?.trazabilidad || []).map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground mt-4 border-t border-border pt-4">
          Anexo A: {result.contratos.length} contratos en muestra SECOP · Anexo B: {result.fuentes.total} registros totales
        </p>
      </Section>
    </div>
  )
}

function Section({ icon: Icon, title, children }: { icon: typeof Shield; title: string; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <Icon className="size-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      </div>
      {children}
    </motion.div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-xl bg-muted/30">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold text-foreground">{value}</p>
    </div>
  )
}

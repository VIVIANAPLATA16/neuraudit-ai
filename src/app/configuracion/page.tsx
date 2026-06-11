"use client"

import { motion } from "framer-motion"
import {
  Shield,
  Bot,
  FileText,
  Building2,
  Scale,
  Landmark,
  MapPin,
  Sparkles,
  Plug,
  Database,
  Cloud,
} from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { cn } from "@/lib/utils"

const stagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
}

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" as const } },
}

const FEATURES = [
  {
    icon: Shield,
    title: "Detecta riesgo",
    description:
      "Analiza SECOP I+II, Contraloría, Procuraduría y 10 fuentes más para calcular un score de riesgo 0-100",
  },
  {
    icon: Bot,
    title: "IA Explicable",
    description:
      "Gemini 2.5 Flash genera hallazgos narrativos con normativa colombiana aplicable (Ley 80/1993, Ley 1474/2011)",
  },
  {
    icon: FileText,
    title: "Expediente digital",
    description:
      "Genera PDFs institucionales listos para enviar a entes de control",
  },
]

const USE_CASES = [
  { icon: Building2, title: "Entidades nacionales", example: "ICBF, UNGRD, Ministerios" },
  { icon: Landmark, title: "Gobernaciones", example: "Antioquia, Cundinamarca, Valle" },
  { icon: MapPin, title: "Alcaldías", example: "Medellín, Bogotá, Cali" },
  { icon: Scale, title: "Contratistas", example: "NIT, razón social, proveedores" },
]

const SOURCE_GROUPS = [
  {
    label: "Contratación",
    color: "bg-primary/15 text-primary border-primary/30",
    items: ["SECOP II", "SECOP I", "Procesos de Licitación", "Ejecución de Contratos"],
  },
  {
    label: "Control",
    color: "bg-destructive/15 text-destructive border-destructive/30",
    items: ["CGR Fallos Fiscales", "Sanciones Contractuales", "Contadores Sancionados"],
  },
  {
    label: "Disciplinario",
    color: "bg-warning/15 text-warning border-warning/30",
    items: ["Procuraduría"],
  },
  {
    label: "Regalías",
    color: "bg-success/15 text-success border-success/30",
    items: ["SGR Regalías ×4 datasets"],
  },
]

const TECH_BADGES = [
  { icon: Sparkles, label: "Gemini 2.5 Flash" },
  { icon: Bot, label: "ADK Agents" },
  { icon: Plug, label: "MCP Protocol" },
  { icon: Database, label: "Elasticsearch" },
  { icon: Cloud, label: "Google Cloud" },
]

export default function ConfiguracionPage() {
  return (
    <AppShell title="NeurAudit AI" subtitle="Inteligencia Anticorrupción · Colombia">
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="max-w-4xl mx-auto space-y-12 pb-16"
      >
        {/* Hero */}
        <motion.section variants={fadeUp} className="text-center space-y-4">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">NeurAudit AI</h1>
          <p className="text-muted-foreground text-lg">
            Inteligencia Anticorrupción · Google Cloud Rapid Agent Hackathon 2026
          </p>
          <motion.span
            animate={{ opacity: [1, 0.6, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-success/10 text-success border border-success/30"
          >
            <span className="size-2 rounded-full bg-success animate-pulse" />
            Live · 13 fuentes en tiempo real
          </motion.span>
        </motion.section>

        {/* Qué hace */}
        <motion.section variants={fadeUp} className="space-y-6">
          <h2 className="text-xl font-semibold text-foreground">¿Qué hace NeurAudit?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <motion.div
                key={f.title}
                variants={fadeUp}
                className="glass rounded-2xl p-6 space-y-4 hover:border-primary/30 transition-colors"
              >
                <div className="size-12 rounded-xl bg-primary/15 flex items-center justify-center">
                  <f.icon className="size-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Puedes investigar */}
        <motion.section variants={fadeUp} className="space-y-6">
          <h2 className="text-xl font-semibold text-foreground">Puedes investigar</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {USE_CASES.map((uc) => (
              <motion.div
                key={uc.title}
                whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="glass rounded-2xl p-5 border border-border hover:border-primary/50 transition-colors cursor-default"
              >
                <div className="flex items-start gap-4">
                  <div className="size-10 rounded-lg bg-accent/15 flex items-center justify-center shrink-0">
                    <uc.icon className="size-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{uc.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{uc.example}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Fuentes */}
        <motion.section variants={fadeUp} className="space-y-6">
          <h2 className="text-xl font-semibold text-foreground">Fuentes de datos</h2>
          <div className="glass rounded-2xl p-6 space-y-6">
            {SOURCE_GROUPS.map((group, gi) => (
              <motion.div
                key={group.label}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: gi * 0.08 }}
                className="space-y-3"
              >
                <span
                  className={cn(
                    "inline-block px-3 py-1 rounded-full text-xs font-semibold border",
                    group.color
                  )}
                >
                  {group.label}
                </span>
                <div className="flex flex-wrap gap-2">
                  {group.items.map((item) => (
                    <span
                      key={item}
                      className="px-3 py-1.5 rounded-lg text-sm bg-muted/40 text-foreground border border-border"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Footer tech */}
        <motion.footer
          variants={fadeUp}
          className="flex flex-wrap items-center justify-center gap-3 pt-4"
        >
          {TECH_BADGES.map((badge) => (
            <span
              key={badge.label}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium glass border border-border text-muted-foreground"
            >
              <badge.icon className="size-3.5 text-primary" />
              {badge.label}
            </span>
          ))}
        </motion.footer>
      </motion.div>
    </AppShell>
  )
}

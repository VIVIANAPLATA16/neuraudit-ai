"use client"

import { motion } from "framer-motion"
import { Search, FileText, AlertTriangle, Brain, FileCheck, CheckCircle2, Loader2 } from "lucide-react"

interface TimelineStep {
  id: string
  label: string
  status: "pending" | "active" | "complete"
  icon: React.ElementType
}

interface AITimelineProps {
  currentStep: number
}

const steps: Omit<TimelineStep, "status">[] = [
  { id: "secop", label: "Consultando SECOP I y II", icon: Search },
  { id: "contraloria", label: "Consultando Contraloría", icon: FileText },
  { id: "procuraduria", label: "Consultando Procuraduría", icon: FileText },
  { id: "sanciones", label: "Analizando sanciones", icon: AlertTriangle },
  { id: "patrones", label: "Detectando patrones con IA", icon: Brain },
  { id: "expediente", label: "Generando expediente", icon: FileCheck },
]

export function AITimeline({ currentStep }: AITimelineProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md mx-auto"
    >
      <div className="space-y-3">
        {steps.map((step, index) => {
          const Icon = step.icon
          const status = index < currentStep ? "complete" : index === currentStep ? "active" : "pending"

          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`flex items-center gap-4 p-3 rounded-xl transition-all ${
                status === "active"
                  ? "glass border-primary/30"
                  : status === "complete"
                    ? "opacity-60"
                    : "opacity-30"
              }`}
            >
              <div
                className={`size-10 rounded-lg flex items-center justify-center ${
                  status === "active"
                    ? "bg-primary/20 text-primary"
                    : status === "complete"
                      ? "bg-success/20 text-success"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {status === "active" ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : status === "complete" ? (
                  <CheckCircle2 className="size-5" />
                ) : (
                  <Icon className="size-5" />
                )}
              </div>

              <div className="flex-1">
                <p
                  className={`text-sm font-medium ${
                    status === "active" ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                </p>
                {status === "active" && (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 2, ease: "linear" }}
                    className="h-0.5 bg-primary/50 rounded-full mt-2"
                  />
                )}
              </div>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}

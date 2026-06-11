"use client"

import { motion } from "framer-motion"
import { Database, Shield, Scale, TrendingUp, Bot, CheckCircle2, Loader2 } from "lucide-react"

interface AITimelineProps {
  currentStep: number
}

const STEPS = [
  { id: "secop", label: "Consultando SECOP II y SECOP I...", icon: Database },
  { id: "cgr", label: "Verificando Contraloría General...", icon: Shield },
  { id: "proc", label: "Consultando Procuraduría...", icon: Scale },
  { id: "sgr", label: "Analizando SGR Regalías...", icon: TrendingUp },
  { id: "gemini", label: "Agente Gemini procesando hallazgos...", icon: Bot },
]

export function AITimeline({ currentStep }: AITimelineProps) {
  const activeIndex = Math.min(currentStep, STEPS.length - 1)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md mx-auto"
    >
      <div className="space-y-3">
        {STEPS.map((step, index) => {
          const Icon = step.icon
          const isComplete = index < currentStep
          const isActive = index === activeIndex && currentStep < STEPS.length
          const isPending = !isComplete && !isActive
          const isGeminiStep = index === STEPS.length - 1

          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.8 }}
              className={`flex items-center gap-4 p-3 rounded-xl transition-all ${
                isActive
                  ? "glass border-primary/30"
                  : isComplete
                    ? "opacity-80"
                    : "opacity-35"
              }`}
            >
              <div
                className={`size-10 rounded-lg flex items-center justify-center shrink-0 ${
                  isActive
                    ? "bg-primary/20 text-primary"
                    : isComplete
                      ? "bg-success/20 text-success"
                      : "bg-muted text-muted-foreground"
                } ${isActive && isGeminiStep ? "animate-pulse" : ""}`}
              >
                {isComplete ? (
                  <CheckCircle2 className="size-5" />
                ) : isActive ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <Icon className="size-5" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${
                    isActive ? "text-foreground" : isPending ? "text-muted-foreground" : "text-foreground/80"
                  }`}
                >
                  {step.label}
                </p>
                {isActive && (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 1.5, ease: "linear" }}
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

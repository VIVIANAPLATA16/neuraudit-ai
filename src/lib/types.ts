export type SourceStatus = "success" | "timeout" | "error" | "empty" | "partial"

export interface SourceTraceEntry {
  id: string
  name: string
  dataset: string
  status: SourceStatus
  records: number
  pages: number
  durationMs: number
  message?: string
}

export interface ScoreRuleExplanation {
  id: string
  factor: string
  regla: string
  condicion: string
  pesoMaximo: number
  cumplida: boolean
  puntos: number
  evidencia?: string
}

export interface ScoreExplainability {
  scoreFinal: number
  nivel: string
  formula: string
  totalReglas: number
  reglasActivas: number
  factoresAplicados: ScoreRuleExplanation[]
  factoresNoAplicados: ScoreRuleExplanation[]
  sumaPuntos: number
  capAplicado: boolean
  interpretacion: string
  benchmark: string
}

export interface ScoreBreakdownItem {
  factor: string
  points: number
  description: string
}

export interface FactorInterpretacion {
  factor: string
  points: number
  impacto: "Alto" | "Medio" | "Bajo"
  analisis: string
}

export interface HallazgoEnriquecido {
  titulo: string
  descripcion: string
  impactoPotencial: string[]
  prioridad: "Alta" | "Media" | "Baja"
}

export interface ContratoDestacado {
  entidad: string
  proveedor: string
  valor: string
  valorNumerico: number
  motivoRelevancia: string
}

export interface ProveedorRecurrente {
  nombre: string
  apariciones: number
  valorAcumulado: string
  interpretacion: string
}

export interface InterpretacionAnalisis {
  analisisEjecutivo: string
  scoreInterpretacion: string
  clasificacion: string
  benchmark: string
  factores: FactorInterpretacion[]
  hallazgos: HallazgoEnriquecido[]
  contratosDestacados: ContratoDestacado[]
  proveedoresRecurrentes: ProveedorRecurrente[]
  concentracion: {
    porcentaje: number
    proveedoresTop5: { nombre: string; valor: string }[]
    interpretacion: string
  }
  aclaraciones: string[]
  trazabilidad: string[]
}

export interface AnalystAnalysisMeta {
  model: string
  durationMs: number
  estimatedTokens?: number
  geminiConnected: boolean
  engine: "adk" | "gemini" | "derived"
}

export interface AnalystAnalysis {
  resumenEjecutivo: string
  evaluacionRiesgo: string
  hallazgosCriticos: string
  evaluacionContratacion: string
  riesgoConcentracion: string
  riesgoDisciplinario: string
  riesgoFiscal: string
  recomendaciones: string
  conclusion: string
  /** Compatibilidad con panel anterior */
  riesgosRelevantes?: string
  source: "adk" | "gemini" | "derived"
  meta?: AnalystAnalysisMeta
}

export interface ComparativeAnalystAnalysis {
  entidadMayorRiesgo: string
  diferenciasRelevantes: string
  prioridadesAuditoria: string
  conclusion: string
  entidadAuditarPrimero?: string
  justificacionPrioridad?: string
  source: "adk" | "gemini" | "derived"
  meta?: AnalystAnalysisMeta
}

export interface RiskData {
  score: number
  nivel: string
  alertas: string[]
  scoreBreakdown: ScoreBreakdownItem[]
  hallazgos: string[]
  recomendaciones: string[]
  totalContratos: number
  entidadesUnicas: number
  directos: number
  fraccionados: number
  valorTotal: number
  montoCGR: number
  montoSanc: number
  totalSGR: number
  sinCompetencia: number
}

export interface SourcesData {
  secopII: number
  secopI: number
  procesos: number
  ejecucion: number
  cgr: number
  sanciones: number
  contadores: number
  procuraduria: number
  sgr: number
  total: number
}

export interface ElasticContractHit {
  entidad: string
  contratista: string
  objeto: string
  valor: number
  modalidad: string
  fechaFirma: string | null
  estado: string
  departamento: string
  score: number
}

export interface ElasticInsights {
  status: "ok" | "skipped" | "error"
  index: string
  query: string
  totalHits: number
  durationMs: number
  message?: string
  topContratos: ElasticContractHit[]
  alertas: string[]
  valorTotalIndexado: number
}

export interface InvestigationMeta {
  cached?: boolean
  cacheTtlMs?: number
  fuentesConsultadas: number
  fuentesExitosas: number
  fuentesConError: number
  fuentesVacias: number
  fuentesTimeout: number
  fuentesParciales?: number
  fetchConcurrency?: number
  duracionTotalMs?: number
}

export interface SearchResult {
  query: string
  timestamp: string
  fuentes: SourcesData
  fuentesTrace?: SourceTraceEntry[]
  scoreExplainability?: ScoreExplainability
  meta?: InvestigationMeta
  riesgo: RiskData
  interpretacion?: InterpretacionAnalisis
  elasticInsights?: ElasticInsights
  analytics?: Record<string, unknown>
  analisisIA?: AnalystAnalysis
  conclusionIA?: string
  contratos: Record<string, unknown>[]
  procesosLicitacion?: Record<string, unknown>[]
  fallosResponsabilidadFiscal?: Record<string, unknown>[]
  sancionesContractuales?: Record<string, unknown>[]
  registrosProcuraduria?: Record<string, unknown>[]
  regaliasSGR?: Record<string, unknown>[]
}

export interface CompareEntityResult {
  query: string
  riesgo: RiskData
  fuentes: SourcesData
  conclusionIA?: string
}

export type TimelinePhase = "idle" | "searching" | "complete"

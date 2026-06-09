const SETTINGS_KEY = "neuraudit:settings"

export interface NeurAuditSettings {
  model: string
  temperature: number
  maxContext: number
  theme: "dark" | "light"
  exportFormat: "pdf" | "json"
  adkAnalyzeUrl: string
}

const DEFAULTS: NeurAuditSettings = {
  model: "gemini-2.5-flash",
  temperature: 0.35,
  maxContext: 16384,
  theme: "dark",
  exportFormat: "pdf",
  adkAnalyzeUrl: "http://127.0.0.1:8001/analyze",
}

export function getSettings(): NeurAuditSettings {
  if (typeof window === "undefined") return DEFAULTS
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

export function saveSettings(partial: Partial<NeurAuditSettings>): NeurAuditSettings {
  const next = { ...getSettings(), ...partial }
  if (typeof window !== "undefined") {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
  }
  return next
}

export { DEFAULTS as DEFAULT_SETTINGS }

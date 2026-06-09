/**
 * Normalización de términos de búsqueda para reducir falsos negativos en Socrata.
 * F22.4 — sin cambios de UI.
 */

const STOP_WORDS = new Set(["DE", "DEL", "LA", "LAS", "LOS", "EL", "Y", "EN"])

/** Alias institucionales conocidos (clave = forma normalizada base) */
const KNOWN_ALIASES: Record<string, string[]> = {
  "ALCALDIA DE BOGOTA": [
    "BOGOTA",
    "BOGOTA DC",
    "DISTRITO CAPITAL",
    "ALCALDIA MAYOR DE BOGOTA",
    "ALCALDIA MAYOR DE BOGOTA DC",
    "ALCALDIA MAYOR DE BOGOTA D C",
  ],
  "MINISTERIO DE SALUD": ["MINSALUD", "MIN SALUD", "MINISTERIO SALUD Y PROTECCION SOCIAL"],
  "ICBF": ["INSTITUTO COLOMBIANO DE BIENESTAR FAMILIAR", "BIENESTAR FAMILIAR"],
  UNGRD: ["UNIDAD NACIONAL DE GESTION DEL RIESGO", "GESTION DEL RIESGO"],
}

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

function cleanToken(value: string): string {
  return stripAccents(value)
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Genera variantes de búsqueda a partir del término ingresado.
 */
export function normalizeSearchTerm(term: string): string[] {
  const base = cleanToken(term)
  if (!base) return []

  const variants = new Set<string>([base])

  for (const [key, aliases] of Object.entries(KNOWN_ALIASES)) {
    const keyMatch = base.includes(key) || key.includes(base)
    const aliasMatch = aliases.some((a) => base.includes(a) || a.includes(base))
    if (keyMatch || aliasMatch) {
      variants.add(key)
      aliases.forEach((a) => variants.add(cleanToken(a)))
    }
  }

  const words = base.split(" ").filter((w) => w.length > 2 && !STOP_WORDS.has(w))
  if (words.length >= 2) {
    const sig = words[words.length - 1]
    if (sig.length >= 4) variants.add(sig)
    if (words.length >= 3) {
      variants.add(words.slice(-2).join(" "))
    }
  }

  if (words.length === 1 && words[0].length >= 4) {
    variants.add(words[0])
  }

  return [...variants].filter(Boolean)
}

/** Escapa comillas simples para cláusulas SoQL */
export function escapeSoql(value: string): string {
  return value.replace(/'/g, "''")
}

/** Construye cláusula LIKE OR para un campo y múltiples variantes */
export function likeFieldVariants(field: string, variants: string[]): string {
  const unique = [...new Set(variants.map(escapeSoql))]
  if (unique.length === 0) return "1=0"
  return unique.map((v) => `upper(${field}) like '%${v}%'`).join(" OR ")
}

/** Combina múltiples campos con OR */
export function whereFromFields(fields: string[], variants: string[]): string {
  return fields.map((f) => `(${likeFieldVariants(f, variants)})`).join(" OR ")
}

import type { SearchResult } from "./types"

const HISTORY_KEY = "neuraudit:historial"

export interface HistoryEntry {
  id: string
  query: string
  score: number
  nivel: string
  timestamp: string
  valorTotal: number
}

export function addToHistory(result: SearchResult): void {
  if (typeof window === "undefined") return
  try {
    const entries = getHistory()
    const entry: HistoryEntry = {
      id: `${Date.now()}-${encodeURIComponent(result.query)}`,
      query: result.query,
      score: result.riesgo.score,
      nivel: result.riesgo.nivel,
      timestamp: result.timestamp,
      valorTotal: result.riesgo.valorTotal,
    }
    const filtered = entries.filter((e) => e.query.toLowerCase() !== result.query.toLowerCase())
    filtered.unshift(entry)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered.slice(0, 100)))
  } catch {
    /* ignore */
  }
}

export function getHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : []
  } catch {
    return []
  }
}

export function removeFromHistory(id: string): void {
  if (typeof window === "undefined") return
  const entries = getHistory().filter((e) => e.id !== id)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries))
}

export function searchHistory(term: string): HistoryEntry[] {
  const q = term.toLowerCase()
  return getHistory().filter((e) => e.query.toLowerCase().includes(q))
}

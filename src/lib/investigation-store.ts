import type { SearchResult } from "./types"

const PREFIX = "neuraudit:investigation:"

export function saveInvestigation(result: SearchResult): void {
  if (typeof window === "undefined") return
  const key = PREFIX + encodeURIComponent(result.query)
  sessionStorage.setItem(key, JSON.stringify(result))
  sessionStorage.setItem("neuraudit:last-query", result.query)
}

export function loadInvestigation(query: string): SearchResult | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(PREFIX + encodeURIComponent(query))
    return raw ? (JSON.parse(raw) as SearchResult) : null
  } catch {
    return null
  }
}

export function getLastQuery(): string | null {
  if (typeof window === "undefined") return null
  return sessionStorage.getItem("neuraudit:last-query")
}

/**
 * Caché en memoria de investigaciones (TTL configurable).
 * Fase 22 — sin PostgreSQL.
 */

import type { SearchResult } from "./types"

const DEFAULT_TTL_MS = 30 * 60 * 1000 // 30 minutos

interface CacheEntry {
  result: SearchResult
  expiresAt: number
}

const store = new Map<string, CacheEntry>()

function normalizeKey(query: string): string {
  return query.trim().toLowerCase()
}

export function getCacheTtlMs(): number {
  const env = process.env.NEURAUDIT_CACHE_TTL_MS
  if (env) {
    const parsed = Number(env)
    if (!Number.isNaN(parsed) && parsed > 0) return parsed
  }
  return DEFAULT_TTL_MS
}

export function getCachedInvestigation(query: string): SearchResult | null {
  const key = normalizeKey(query)
  const entry = store.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    store.delete(key)
    return null
  }
  return entry.result
}

export function setCachedInvestigation(query: string, result: SearchResult): void {
  const key = normalizeKey(query)
  store.set(key, {
    result,
    expiresAt: Date.now() + getCacheTtlMs(),
  })
}

export function invalidateInvestigationCache(query?: string): void {
  if (query) {
    store.delete(normalizeKey(query))
    return
  }
  store.clear()
}

export function getCacheStats(): { entries: number; ttlMs: number } {
  const now = Date.now()
  let entries = 0
  for (const [, entry] of store) {
    if (entry.expiresAt > now) entries++
  }
  return { entries, ttlMs: getCacheTtlMs() }
}

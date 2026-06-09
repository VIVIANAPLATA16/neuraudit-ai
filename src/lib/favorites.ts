export interface FavoriteEntity {
  id: string
  name: string
  addedAt: string
  lastScore?: number
  lastNivel?: string
  lastChecked?: string
}

const STORAGE_KEY = "neuraudit:favorites"

export function getFavorites(): FavoriteEntity[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as FavoriteEntity[]) : []
  } catch {
    return []
  }
}

export function addFavorite(name: string): FavoriteEntity[] {
  const favorites = getFavorites()
  if (favorites.some((f) => f.name.toLowerCase() === name.toLowerCase())) return favorites
  const entity: FavoriteEntity = {
    id: crypto.randomUUID(),
    name,
    addedAt: new Date().toISOString(),
  }
  const updated = [...favorites, entity]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  return updated
}

export function removeFavorite(id: string): FavoriteEntity[] {
  const updated = getFavorites().filter((f) => f.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  return updated
}

export function updateFavoriteScore(name: string, score: number, nivel: string): void {
  const favorites = getFavorites()
  const idx = favorites.findIndex((f) => f.name.toLowerCase() === name.toLowerCase())
  if (idx === -1) return
  favorites[idx] = {
    ...favorites[idx],
    lastScore: score,
    lastNivel: nivel,
    lastChecked: new Date().toISOString(),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites))
}

export function isFavorite(name: string): boolean {
  return getFavorites().some((f) => f.name.toLowerCase() === name.toLowerCase())
}

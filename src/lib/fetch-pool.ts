/**
 * Pool de concurrencia para consultas a datos.gov.co.
 * F22.3 — limita paralelismo sin eliminarlo.
 */

const DEFAULT_CONCURRENCY = 4

export function getFetchConcurrency(): number {
  const env = process.env.NEURAUDIT_FETCH_CONCURRENCY
  if (env) {
    const n = Number(env)
    if (!Number.isNaN(n) && n >= 1 && n <= 13) return Math.floor(n)
  }
  return DEFAULT_CONCURRENCY
}

export async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < tasks.length) {
      const i = nextIndex++
      results[i] = await tasks[i]()
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker())
  await Promise.all(workers)
  return results
}

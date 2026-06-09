import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { SourcesData } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function buildSourceList(fuentes: SourcesData) {
  return [
    { name: 'SECOP II', count: fuentes.secopII, checked: fuentes.secopII > 0 },
    { name: 'SECOP I', count: fuentes.secopI, checked: fuentes.secopI > 0 },
    { name: 'Contraloría (CGR)', count: fuentes.cgr, checked: fuentes.cgr > 0 },
    { name: 'Procuraduría', count: fuentes.procuraduria, checked: fuentes.procuraduria > 0 },
    { name: 'Sanciones', count: fuentes.sanciones, checked: fuentes.sanciones > 0 },
    { name: 'Regalías (SGR)', count: fuentes.sgr, checked: fuentes.sgr > 0 },
    { name: 'Procesos licitación', count: fuentes.procesos, checked: fuentes.procesos > 0 },
    { name: 'Ejecución contractual', count: fuentes.ejecucion, checked: fuentes.ejecucion > 0 },
    { name: 'Contadores sancionados', count: fuentes.contadores, checked: fuentes.contadores > 0 },
  ]
}

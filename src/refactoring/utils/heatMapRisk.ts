import type { ITrisk } from '@/components/HeatMap/types/ITrisk'

/**
 * Нормализует значение риска, приходящее с бэкенда.
 */
export const normalizeRisk = (r: unknown): ITrisk => {
    const s = String(r ?? '').trim().toLowerCase()
    if (!s) return null
    if (s === 'high') return 'high'
    if (s === 'low') return 'low'
    if (['middle', 'medium', 'moderate', 'mid'].includes(s)) return 'medium'
    return null
}

/**
 * Возвращает модификатор класса по риску: 'low' | 'medium' | 'high' | ''
 */
export const riskClass = (r: unknown): '' | 'low' | 'medium' | 'high' => {
    return normalizeRisk(r) ?? ''
}

/**
 * Утилиты для работы с чатами
 */

/**
 * Генерирует инициалы из названия чата
 */
export function generateChatInitials(name: string): string {
    if (!name?.trim()) return ''
    
    const parts = name.trim().split(' ').filter(Boolean)
    
    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase()
    }
    
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    
    return ''
}

/**
 * Создает URL с базовым путем
 */
export function withBase(path: string | null): string {
    if (!path) return ''
    if (path.startsWith('http')) return path
    
    const base = import.meta.env.BASE_URL || '/'
    return `${base.replace(/\/$/, '')}${path}`
}
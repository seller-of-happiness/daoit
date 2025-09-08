/**
 * Утилиты для работы с чатами
 */

/**
 * Генерирует инициалы из названия чата
 * Для имен пользователей берет первую букву имени и первую букву фамилии
 */
export function generateChatInitials(name: string): string {
    if (!name?.trim()) return ''
    
    const parts = name.trim().split(' ').filter(Boolean)
    
    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase()
    }
    
    if (parts.length >= 2) {
        // Для русских имен: если первое слово похоже на имя, а второе на фамилию
        // то берем инициалы в порядке Имя + Фамилия
        const firstName = parts[0]
        const lastName = parts[1]
        
        // Проверяем, является ли первое слово именем (начинается с заглавной и не очень длинное)
        // и второе слово фамилией
        const isLikelyNameSurname = firstName.length <= 15 && lastName.length <= 20
        
        if (isLikelyNameSurname) {
            return (firstName[0] + lastName[0]).toUpperCase()
        }
        
        // Для остальных случаев (названия групп, каналов и т.д.) - как было
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
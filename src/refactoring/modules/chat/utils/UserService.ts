/**
 * Унифицированный сервис для работы с пользователями
 * Заменяет дублирующую логику из различных частей приложения
 */

import type { IUser } from '../types/IChat'

export class UserService {
    /**
     * Получает отображаемое имя пользователя
     * Приоритет: full_name > first_name + last_name > user_name > email > id
     */
    static getDisplayName(user: IUser | null | undefined): string {
        if (!user) return 'Неизвестный пользователь'

        // Приоритет для полного имени
        if (user.full_name?.trim()) {
            return user.full_name.trim()
        }

        // Составляем из имени и фамилии
        if (user.first_name || user.last_name) {
            const parts = [user.first_name?.trim(), user.last_name?.trim()].filter(Boolean)

            if (parts.length > 0) {
                return parts.join(' ')
            }
        }

        // Фоллбэки
        if (user.user_name?.trim()) {
            return user.user_name.trim()
        }

        if (user.username?.trim()) {
            return user.username.trim()
        }

        if (user.email?.trim()) {
            return user.email.trim()
        }

        return `Пользователь ${user.id}`
    }

    /**
     * Получает полное имя пользователя (имя + фамилия + отчество)
     */
    static getFullName(user: IUser | null | undefined): string {
        if (!user) return ''

        if (user.full_name?.trim()) {
            return user.full_name.trim()
        }

        const parts = [
            user.first_name?.trim(),
            user.last_name?.trim(),
            user.middle_name?.trim(),
        ].filter(Boolean)

        return parts.join(' ')
    }

    /**
     * Генерирует инициалы пользователя
     */
    static getInitials(user: IUser | null | undefined): string {
        if (!user) return '??'

        // Если есть имя и фамилия - используем их
        if (user.first_name && user.last_name) {
            return (user.first_name[0] + user.last_name[0]).toUpperCase()
        }

        // Если есть только имя
        if (user.first_name) {
            return user.first_name.slice(0, 2).toUpperCase()
        }

        // Если есть только фамилия
        if (user.last_name) {
            return user.last_name.slice(0, 2).toUpperCase()
        }

        // Фоллбэк на полное имя или другие поля
        const fallbackName = user.full_name || user.user_name || user.username || user.email
        if (fallbackName) {
            return this.generateInitialsFromString(fallbackName)
        }

        return '??'
    }

    /**
     * Генерирует инициалы из строки
     */
    static generateInitialsFromString(name: string): string {
        if (!name?.trim()) return '??'

        const cleanName = name.trim()
        const parts = cleanName.split(' ').filter(Boolean)

        if (parts.length === 1) {
            // Для одного слова берем первые 2 символа
            return parts[0].slice(0, 2).toUpperCase()
        }

        if (parts.length >= 2) {
            // Для русских имен: если первое слово похоже на имя, а второе на фамилию
            // то берем инициалы в порядке Имя + Фамилия
            const firstName = parts[0]
            const lastName = parts[1]

            // Проверяем, является ли это именем и фамилией
            const isLikelyNameSurname =
                firstName.length <= 15 &&
                lastName.length <= 20 &&
                !/^\d+$/.test(firstName) &&
                !/^\d+$/.test(lastName)

            if (isLikelyNameSurname) {
                return (firstName[0] + lastName[0]).toUpperCase()
            }

            // Для остальных случаев (названия групп, каналов и т.д.)
            return (parts[0][0] + parts[1][0]).toUpperCase()
        }

        return '??'
    }

    /**
     * Получает аватар пользователя или null
     */
    static getAvatar(user: IUser | null | undefined): string | null {
        if (!user) return null
        return user.avatar || null
    }

    /**
     * Получает уникальный идентификатор пользователя
     * Приоритет: uuid > id
     */
    static getId(user: IUser | null | undefined): string | null {
        if (!user) return null
        return user.uuid || user.id || null
    }

    /**
     * Проверяет, является ли пользователь сотрудником (имеет дополнительные поля)
     */
    static isEmployee(user: IUser): boolean {
        return !!(user.department || user.position || user.can_create_dialog !== undefined)
    }

    /**
     * Создает объект ReactionUser из IUser
     */
    static toReactionUser(user: IUser): {
        id: string | number
        name: string
        avatar?: string | null
    } {
        return {
            id: this.getId(user) || user.id,
            name: this.getDisplayName(user),
            avatar: this.getAvatar(user),
        }
    }

    /**
     * Нормализует ID пользователя к строке для сравнения
     */
    static normalizeId(id: string | number | null | undefined): string | null {
        if (id == null) return null
        return String(id).trim() || null
    }

    /**
     * Сравнивает двух пользователей по ID
     */
    static isSameUser(user1: IUser | null | undefined, user2: IUser | null | undefined): boolean {
        if (!user1 || !user2) return false

        const id1 = this.normalizeId(this.getId(user1))
        const id2 = this.normalizeId(this.getId(user2))

        return id1 !== null && id2 !== null && id1 === id2
    }

    /**
     * Проверяет, может ли пользователь создавать диалоги
     */
    static canCreateDialog(user: IUser): boolean {
        return user.can_create_dialog !== false // по умолчанию true, если не указано иное
    }
}

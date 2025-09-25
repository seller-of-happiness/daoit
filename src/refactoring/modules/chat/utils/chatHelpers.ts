/**
 * Утилиты для работы с чатами
 * Обновлены для работы с новой структурой API
 */

import type { IUser, IChat, IChatMember } from '../types/IChat'
import { ChatAdapter } from '../types/IChat'

/**
 * Генерирует инициалы из названия чата или имени пользователя
 * Обновлено для работы с новой структурой пользователей
 */
export function generateChatInitials(name: string): string {
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
 * Генерирует инициалы для пользователя на основе новой структуры API
 */
export function generateUserInitials(user: IUser): string {
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

    // Фоллбек на полное имя или другие поля
    const fallbackName = user.full_name || user.user_name || user.username || user.email
    if (fallbackName) {
        return generateChatInitials(fallbackName)
    }

    return '??'
}

/**
 * Генерирует инициалы для чата с учетом его типа и новой структуры
 */
export function generateChatInitialsForChat(chat: IChat, currentUserId?: string): string {
    if (!chat) return '??'

    // Для диалогов показываем инициалы собеседника
    if ((chat.type === 'direct' || chat.type === 'dialog') && currentUserId) {
        const companion = ChatAdapter.getDialogCompanion(chat, currentUserId)
        if (companion && companion.user) {
            return generateUserInitials(companion.user)
        }
    }

    // Для групп и каналов используем название чата
    if (chat.title) {
        return generateChatInitials(chat.title)
    }

    // Фоллбек на тип чата
    switch (chat.type) {
        case 'group':
            return 'ГР'
        case 'channel':
            return 'КН'
        case 'dialog':
        case 'direct':
            return 'ДИ'
        default:
            return '??'
    }
}

/**
 * Получает отображаемое название чата
 */
export function getChatDisplayTitle(chat: IChat, currentUserId?: string): string {
    if (!chat) return 'Неизвестный чат'

    // Для диалогов показываем имя собеседника
    if ((chat.type === 'direct' || chat.type === 'dialog') && currentUserId) {
        const companion = ChatAdapter.getDialogCompanion(chat, currentUserId)
        if (companion && companion.user) {
            return ChatAdapter.getChatDisplayName(companion.user)
        }
    }

    // Для групп и каналов показываем название
    return chat.title || `${getReadableChatType(chat.type)} #${chat.id}`
}

/**
 * Получает читаемое название типа чата
 */
export function getReadableChatType(type: string): string {
    switch (type) {
        case 'dialog':
        case 'direct':
            return 'Диалог'
        case 'group':
            return 'Группа'
        case 'channel':
            return 'Канал'
        default:
            return 'Чат'
    }
}

/**
 * Создает URL с базовым путем
 */
export function withBase(path: string | null): string {
    if (!path) return ''
    if (path.startsWith('http')) return path

    const base = ((import.meta as any).env?.BASE_URL as string) || '/'
    return `${base.replace(/\/$/, '')}${path}`
}

/**
 * Проверяет, может ли пользователь выполнить действие в чате
 */
export function canUserPerformAction(
    chat: IChat,
    userId: string,
    action: 'invite' | 'remove' | 'edit' | 'delete',
): boolean {
    if (!chat || !userId) {
        return false
    }

    // Нормализуем ID для корректного сравнения
    const normalizedUserId = String(userId).trim()

    // Получаем ID создателя из разных возможных полей
    const creatorId = String(
        chat.created_by?.id || 
        chat.created_by?.uuid || 
        (chat as any).created_by_id || 
        chat.owner || 
        '',
    ).trim()


    // Проверяем создателя чата - у создателя все права
    if (normalizedUserId && creatorId && normalizedUserId === creatorId) {
        return true
    }

    // Ищем пользователя среди участников
    const memberInfo = chat.members?.find((member) => {
        const memberId = String(member.user?.id || member.user?.uuid || '').trim()
        const memberUuid = String(member.user_uuid || '').trim()

        return memberId === normalizedUserId || memberUuid === normalizedUserId
    })

    const isMember = !!memberInfo
    const isAdmin = memberInfo?.is_admin || false


    // Если пользователь не найден среди участников
    if (!isMember) {
        return false
    }

    switch (action) {
        case 'invite':
            // Приглашать могут все участники в группах, только админы в каналах
            const canInvite = chat.type === 'channel' ? isAdmin : true
            return canInvite

        case 'remove':
            // Удалять участников могут только админы
            return isAdmin

        case 'edit':
            // Редактировать чат могут только админы
            return isAdmin

        case 'delete':
            // Удалять чат может только создатель
            const canDelete = normalizedUserId === creatorId
            return canDelete

        default:
            return false
    }
}

/**
 * Получает статус пользователя в чате
 */
export function getUserChatStatus(
    chat: IChat,
    userId: string,
): 'owner' | 'admin' | 'member' | 'not_member' {
    if (!chat || !userId) return 'not_member'

    // Проверяем, является ли создателем
    const creatorId = String(
        chat.created_by?.id || 
        chat.created_by?.uuid || 
        (chat as any).created_by_id || 
        chat.owner || 
        '',
    ).trim()
    if (creatorId === userId) return 'owner'

    // Ищем пользователя среди участников
    const member = chat.members?.find((m) => m.user?.id === userId)
    if (!member) return 'not_member'

    // Проверяем права администратора
    return member.is_admin ? 'admin' : 'member'
}

/**
 * Форматирует список участников для отображения
 */
export function formatMembersList(members: IChatMember[], maxCount: number = 3): string {
    if (!members || members.length === 0) return 'Нет участников'

    const displayMembers = members.slice(0, maxCount)
    const names = displayMembers.map((member) => ChatAdapter.getChatDisplayName(member.user))

    let result = names.join(', ')

    if (members.length > maxCount) {
        const remaining = members.length - maxCount
        result += ` и ещё ${remaining}`
    }

    return result
}

/**
 * Получает информацию о последней активности в чате
 */
export function getLastActivityInfo(chat: IChat): { text: string; timestamp: string | null } {
    // Приоритет: последнее сообщение > время создания
    if (chat.last_message) {
        const messageText = chat.last_message.content?.trim() || '📎 Файл'
        return {
            text: messageText.length > 50 ? messageText.slice(0, 50) + '...' : messageText,
            timestamp: chat.last_message.created_at,
        }
    }

    if (chat.created_at) {
        return {
            text: 'Чат создан',
            timestamp: chat.created_at,
        }
    }

    return {
        text: 'Нет активности',
        timestamp: null,
    }
}

/**
 * Проверяет, нужно ли показывать индикатор непрочитанных сообщений
 */
export function shouldShowUnreadIndicator(chat: IChat): boolean {
    return (chat.unread_count || 0) > 0
}

/**
 * Форматирует счетчик непрочитанных сообщений
 */
export function formatUnreadCount(count: number): string {
    if (count <= 0) return ''
    if (count > 99) return '99+'
    return String(count)
}

/**
 * Проверяет, создал ли текущий пользователь данный чат/группу
 * @param chat - объект чата
 * @param currentUserId - ID текущего пользователя
 * @returns true, если пользователь создал чат
 */
export function isUserChatCreator(chat: IChat | null, currentUserId: string | null): boolean {
    if (!chat || !currentUserId) {
        return false
    }

    // Нормализуем ID для корректного сравнения
    const normalizedUserId = String(currentUserId).trim()

    // Получаем ID создателя из разных возможных полей
    // Поддерживаем как новую структуру (created_by.id), так и старую (created_by_id, owner)
    const creatorId = String(
        chat.created_by?.id || 
        chat.created_by?.uuid || 
        (chat as any).created_by_id || 
        chat.owner || 
        ''
    ).trim()

    // Возвращаем результат сравнения
    const isCreator: boolean = !!(normalizedUserId && creatorId && normalizedUserId === creatorId)
    
    return isCreator
}

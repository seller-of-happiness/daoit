/**
 * Композабл для работы с текущим пользователем в контексте чата
 * Централизует логику определения пользователя, его ID и имени
 */
import { computed, type ComputedRef } from 'vue'
import { useUserStore } from '@/refactoring/modules/user/stores/userStore'
import type { IChat, IChatMember, IUser, IMessage } from '@/refactoring/modules/chat/types/IChat'
import { UserService } from '../utils/UserService'

export interface CurrentUserInfo {
    id: ComputedRef<string | null>
    name: ComputedRef<string | null>
    nameForChat: ComputedRef<string | null>
    displayName: ComputedRef<string>
    initials: ComputedRef<string>
}

export function useCurrentUser(currentChat?: IChat | null): CurrentUserInfo {
    const userStore = useUserStore()

    // Централизованное получение ID пользователя
    const currentUserId = computed(() => {
        const user = userStore.user as IUser | null
        if (!user) {
            return null
        }

        // Приоритет: uuid > id (строковый) > id (приведенный к строке)
        const userId =
            user.uuid ||
            (typeof user.id === 'string' ? user.id : null) ||
            (user.id ? String(user.id) : null)


        return userId
    })

    // Централизованное получение имени пользователя
    const currentUserName = computed(() => {
        const user = userStore.user as IUser | null
        return UserService.getDisplayName(user) || null
    })

    // Отображаемое имя пользователя (всегда строка)
    const displayName = computed(() => {
        const user = userStore.user as IUser | null
        return UserService.getDisplayName(user)
    })

    // Инициалы пользователя
    const initials = computed(() => {
        const user = userStore.user as IUser | null
        return UserService.getInitials(user)
    })

    // Имя пользователя в контексте текущего чата (как показывает бэкенд)
    const currentUserNameForChat = computed(() => {
        if (!currentChat?.members || !currentUserId.value) {
            return currentUserName.value
        }

        // Ищем участника по разным вариантам ID
        const userId = currentUserId.value
        const member = currentChat.members.find((m: IChatMember) => {
            const memberId = String(m.user?.id || m.user?.uuid || '').trim()
            const memberUuid = String(m.user_uuid || '').trim()

            return memberId === userId || memberUuid === userId
        })

        return member?.user_name || currentUserName.value
    })

    return {
        id: currentUserId,
        name: currentUserName,
        nameForChat: currentUserNameForChat,
        displayName,
        initials,
    }
}

/**
 * Нормализация имени для сравнения
 */
function normalizeName(value: unknown): string {
    const normalized = String(value ?? '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim()

    return normalized
}

/**
 * Сравнение двух имен с учетом возможного разного порядка слов
 */
function compareNames(name1: string, name2: string): boolean {
    const norm1 = normalizeName(name1)
    const norm2 = normalizeName(name2)

    // Прямое сравнение
    if (norm1 === norm2) {
        return true
    }

    // Сравнение с перестановкой слов (для случая "Павел Кузнецов" vs "Кузнецов Павел")
    const words1 = norm1.split(' ').filter(Boolean)
    const words2 = norm2.split(' ').filter(Boolean)

    if (words1.length === words2.length && words1.length === 2) {
        const reversed1 = `${words1[1]} ${words1[0]}`
        const reversed2 = `${words2[1]} ${words2[0]}`

        const match = norm1 === reversed2 || norm2 === reversed1
        return match
    }

    return false
}

/**
 * Проверка, является ли сообщение моим
 */
export function isMyMessage(
    message: IMessage,
    currentUserId: string | null,
    currentUserName: string | null,
): boolean {
    if (!currentUserId && !currentUserName) {
        return false
    }

    // Пробуем сравнение по ID (самый надежный способ)
    if (currentUserId) {
        const messageUserIds = [
            message?.author_id,
            message?.user_id,
            message?.created_by?.id,
            typeof message?.author === 'number' ? message.author : null,
            typeof message?.author === 'string' ? message.author : null,
        ]
            .filter((id) => id !== undefined && id !== null)
            .map((id) => id.toString())

        // Проверяем точное совпадение
        if (messageUserIds.some((id) => id === currentUserId)) {
            return true
        }
    }

    // Сравнение по имени (основной способ в этом проекте)
    if (currentUserName) {
        // Извлекаем имя из разных возможных полей
        const messageUserName =
            message?.author_name ??
            (typeof message?.author === 'string' ? message.author : null) ??
            message?.name ??
            message?.created_by?.full_name ??
            (message?.created_by?.first_name && message?.created_by?.last_name
                ? `${message.created_by.first_name} ${message.created_by.last_name}`.trim()
                : null) ??
            (message?.created_by?.last_name && message?.created_by?.first_name
                ? `${message.created_by.last_name} ${message.created_by.first_name}`.trim()
                : null) ??
            message?.created_by?.user_name ??
            message?.created_by?.username

        if (messageUserName) {
            return compareNames(messageUserName, currentUserName)
        }
    }

    return false
}

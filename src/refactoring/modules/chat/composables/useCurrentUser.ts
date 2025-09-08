/**
 * Композабл для работы с текущим пользователем в контексте чата
 * Централизует логику определения пользователя, его ID и имени
 */
import { computed, type ComputedRef } from 'vue'
import { useUserStore } from '@/refactoring/modules/user/stores/userStore'
import type { IChat, IChatMember, IUser, IMessage } from '@/refactoring/modules/chat/types/IChat'

export interface CurrentUserInfo {
    id: ComputedRef<string | null>
    name: ComputedRef<string | null>
    nameForChat: ComputedRef<string | null>
}

export function useCurrentUser(currentChat?: IChat | null): CurrentUserInfo {
    const userStore = useUserStore()

    // Централизованное получение ID пользователя
    const currentUserId = computed(() => {
        const user = userStore.user
        return user?.id?.toString() ?? null
    })

    // Централизованное получение имени пользователя
    const currentUserName = computed(() => {
        const user = userStore.user as IUser | null
        if (!user) return null

        // Приоритетный порядок полей для имени
        const nameFields = [
            user.full_name,
            [user.first_name, user.last_name].filter(Boolean).join(' '),
            [user.last_name, user.first_name].filter(Boolean).join(' '),
            user.user_name,
            user.username,
            user.email,
        ]

        return nameFields.find((field) => field && field.trim()) || null
    })

    // Имя пользователя в контексте текущего чата (как показывает бэкенд)
    const currentUserNameForChat = computed(() => {
        if (!currentChat?.members || !currentUserId.value) {
            return currentUserName.value
        }

        const member = currentChat.members.find((m: IChatMember) => m.user === currentUserId.value)

        return member?.user_name || currentUserName.value
    })

    return {
        id: currentUserId,
        name: currentUserName,
        nameForChat: currentUserNameForChat,
    }
}

/**
 * Нормализация имени для сравнения
 */
export function normalizeName(value: unknown): string {
    const normalized = String(value ?? '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim()

    console.log(`🔤 normalizeName: "${value}" -> "${normalized}"`)
    return normalized
}

/**
 * Сравнение двух имен с учетом возможного разного порядка слов
 */
function compareNames(name1: string, name2: string): boolean {
    const norm1 = normalizeName(name1)
    const norm2 = normalizeName(name2)

    console.log(`🔍 compareNames: "${norm1}" vs "${norm2}"`)

    // Прямое сравнение
    if (norm1 === norm2) {
        console.log('✅ Прямое совпадение имен')
        return true
    }

    // Сравнение с перестановкой слов (для случая "Павел Кузнецов" vs "Кузнецов Павел")
    const words1 = norm1.split(' ').filter(Boolean)
    const words2 = norm2.split(' ').filter(Boolean)

    if (words1.length === words2.length && words1.length === 2) {
        const reversed1 = `${words1[1]} ${words1[0]}`
        const reversed2 = `${words2[1]} ${words2[0]}`

        const match = norm1 === reversed2 || norm2 === reversed1
        console.log(`🔄 Проверка перестановки: ${match}`)
        return match
    }

    console.log('❌ Имена не совпадают')
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
    // Отладочная информация (временно включена для диагностики)
    console.log('🔍 Проверка сообщения:', {
        messageId: message?.id,
        messageAuthorId: message?.author_id,
        messageUserId: message?.user_id,
        messageAuthor: message?.author,
        messageAuthorName: message?.author_name,
        messageName: message?.name,
        currentUserId,
        currentUserName,
    })

    if (!currentUserId && !currentUserName) {
        console.log('❌ Нет данных о текущем пользователе')
        return false
    }

    // Пробуем сравнение по ID (самый надежный способ)
    if (currentUserId) {
        const messageUserIds = [
            message?.author_id,
            message?.user_id,
            typeof message?.author === 'number' ? message.author : null,
        ]
            .filter((id) => id !== undefined && id !== null)
            .map((id) => id.toString())

        console.log('🆔 Сравнение ID:', { messageUserIds, currentUserId })

        if (messageUserIds.some((id) => id === currentUserId)) {
            console.log('✅ Совпадение по ID - это мое сообщение')
            return true
        }

        // Если у сообщения есть ID, но не совпал - НЕ ВОЗВРАЩАЕМ false сразу
        // Пробуем еще по имени, так как ID могут быть в разных форматах
        console.log('⚠️ ID не совпадают, пробуем по имени')
    }

    // Сравнение по имени (основной способ в этом проекте)
    if (currentUserName) {
        const messageUserName =
            message?.author_name ??
            (typeof message?.author === 'string' ? message.author : null) ??
            message?.name

        console.log('👤 Найденное имя в сообщении:', messageUserName)

        if (messageUserName) {
            const result = compareNames(messageUserName, currentUserName)
            console.log(`📝 Сравнение имен: "${messageUserName}" vs "${currentUserName}" = ${result}`)
            return result
        } else {
            console.log('⚠️ В сообщении не найдено имя автора')
        }
    }

    console.log('❌ Сообщение определено как чужое (нет данных для сравнения)')
    return false
}

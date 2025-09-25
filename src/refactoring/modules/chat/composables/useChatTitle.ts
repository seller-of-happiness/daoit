import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import type { IChat, IChatMember } from '../types/IChat'
import { useCurrentUser } from './useCurrentUser'
import { ChatAdapter } from '../types/IChat'

/**
 * Композабл для определения названия и иконки чата
 * Обновлен для работы с новой структурой API
 */
export function useChatTitle(chat: ComputedRef<IChat | null>) {
    const { id: currentUserId } = useCurrentUser()

    /**
     * Определяет название чата в зависимости от его типа
     */
    const chatTitle = computed(() => {
        if (!chat.value) return ''

        // Для диалогов показываем имя собеседника
        if (chat.value.type === 'direct' || chat.value.type === 'dialog') {
            const currentUserIdStr = currentUserId.value
            if (!currentUserIdStr) {
                return chat.value.title || 'Диалог'
            }

            // Используем адаптер для получения собеседника
            const companion = ChatAdapter.getDialogCompanion(chat.value, currentUserIdStr)

            if (companion && companion.user) {
                // Получаем отображаемое имя собеседника
                return ChatAdapter.getChatDisplayName(companion.user)
            }

            // Фоллбек: если не удалось найти собеседника
            return chat.value.title || 'Диалог'
        }

        // Для групп и каналов используем установленное название
        return chat.value.title || 'Без названия'
    })

    /**
     * Определяет иконку чата
     */
    const chatIcon = computed(() => {
        if (!chat.value) return null

        // Для диалогов иконки нет (используются инициалы)
        if (chat.value.type === 'direct' || chat.value.type === 'dialog') {
            return null
        }

        // Для групп и каналов возвращаем установленную иконку
        return chat.value.icon
    })

    /**
     * Получает информацию о собеседнике в диалоге
     */
    const dialogCompanion = computed<IChatMember | null>(() => {
        if (!chat.value || (chat.value.type !== 'direct' && chat.value.type !== 'dialog')) {
            return null
        }

        const currentUserIdStr = currentUserId.value
        if (!currentUserIdStr) return null

        return ChatAdapter.getDialogCompanion(chat.value, currentUserIdStr)
    })

    /**
     * Получает полное имя собеседника в диалоге
     */
    const companionFullName = computed(() => {
        if (!dialogCompanion.value) return null
        return ChatAdapter.getFullUserName(dialogCompanion.value.user)
    })

    /**
     * Получает отображаемое имя собеседника в диалоге
     */
    const companionDisplayName = computed(() => {
        if (!dialogCompanion.value) return null
        return ChatAdapter.getChatDisplayName(dialogCompanion.value.user)
    })

    /**
     * Проверяет, является ли текущий пользователь администратором чата
     * Исправлено для корректной работы с новой структурой
     */
    const isCurrentUserAdmin = computed(() => {
        if (!chat.value || !currentUserId.value) {
            return false
        }

        const userId = currentUserId.value
        const currentChat = chat.value

        // Проверяем, является ли пользователь создателем
        const creatorId = String(
            currentChat.created_by?.id || 
            currentChat.created_by?.uuid || 
            (currentChat as any).created_by_id || 
            currentChat.owner || 
            '',
        ).trim()

        if (userId === creatorId) {
            return true
        }

        // Проверяем среди участников
        const isAdmin =
            currentChat.members?.some((member) => {
                const memberId = String(member.user?.id || member.user?.uuid || '').trim()
                const memberUuid = String(member.user_uuid || '').trim()

                const isThisUser = memberId === userId || memberUuid === userId
                const isAdminMember = member.is_admin

                return isThisUser && isAdminMember
            }) || false


        return isAdmin
    })

    /**
     * Получает количество участников чата
     */
    const memberCount = computed(() => {
        if (!chat.value || !Array.isArray(chat.value.members)) return 0
        return chat.value.members.length
    })

    /**
     * Получает количество администраторов чата
     */
    const adminCount = computed(() => {
        if (!chat.value || !Array.isArray(chat.value.members)) return 0
        return chat.value.members.filter((member) => member.is_admin).length
    })

    /**
     * Получает информацию о создателе чата
     */
    const chatCreator = computed(() => {
        return chat.value?.created_by || null
    })

    /**
     * Получает отображаемое имя создателя чата
     */
    const creatorDisplayName = computed(() => {
        if (!chatCreator.value) return null
        return ChatAdapter.getChatDisplayName(chatCreator.value)
    })

    return {
        // Основные свойства
        chatTitle,
        chatIcon,

        // Информация о диалогах
        dialogCompanion,
        companionFullName,
        companionDisplayName,

        // Административная информация
        isCurrentUserAdmin,
        memberCount,
        adminCount,

        // Информация о создателе
        chatCreator,
        creatorDisplayName,
    }
}

import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import type { IChat } from '../types/IChat'
import { useCurrentUser } from './useCurrentUser'

/**
 * Композабл для определения названия и инициалов чата
 */
export function useChatTitle(chat: ComputedRef<IChat | null>) {
    const { id: currentUserId } = useCurrentUser()

    // Вспомогательная функция для поиска собеседника
    const findCompanion = (chatValue: IChat) => {
        if (!chatValue.members || !Array.isArray(chatValue.members)) {
            return null
        }

        return chatValue.members.find((member) => {
            if (!member) return false

            const memberUserId = String(member.user || member.user_uuid || '')
            const currentUserIdStr = String(currentUserId.value || '')
            return memberUserId !== currentUserIdStr && memberUserId !== ''
        })
    }

    /**
     * Определяет название чата в зависимости от его типа
     */
    const chatTitle = computed(() => {
        if (!chat.value) return ''

        if (chat.value.type === 'direct' || chat.value.type === 'dialog') {
            const companion = findCompanion(chat.value)
            const companionName = companion?.user_name?.trim()
            
            return companionName || chat.value.title || 'Диалог'
        }

        return chat.value.title || 'Без названия'
    })

    /**
     * Определяет иконку чата
     */
    const chatIcon = computed(() => {
        if (!chat.value) return null

        if (chat.value.type === 'direct' || chat.value.type === 'dialog') {
            return null // IChatMember не содержит avatar
        }

        return chat.value.icon
    })

    return {
        chatTitle,
        chatIcon,
    }
}

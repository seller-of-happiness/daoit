import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import type { IChat } from '../types/IChat'
import { useCurrentUser } from './useCurrentUser'

/**
 * Композабл для определения названия и инициалов чата
 */
export function useChatTitle(chat: ComputedRef<IChat | null>) {
    const { id: currentUserId } = useCurrentUser()

    /**
     * Определяет название чата в зависимости от его типа
     */
    const chatTitle = computed(() => {
        if (!chat.value) return ''

        if (chat.value.type === 'direct' || chat.value.type === 'dialog') {
            // Проверяем что members существует и это массив
            if (!chat.value.members || !Array.isArray(chat.value.members)) {
                return chat.value.title || 'Диалог'
            }

            // Для личных диалогов показываем имя собеседника
            const companion = chat.value.members.find((member) => {
                if (!member) return false // Проверка на существование member

                const memberUserId = String(member.user || member.user_uuid || '')
                const currentUserIdStr = String(currentUserId.value || '')
                return memberUserId !== currentUserIdStr && memberUserId !== ''
            })

            // Используем user_name или извлекаем имя из других полей
            const companionName = companion?.user_name?.trim()
            if (companionName) {
                return companionName
            }

            // Fallback - используем title чата
            return chat.value.title || 'Диалог'
        }

        // Для групп и каналов используем title
        return chat.value.title || 'Без названия'
    })

    /**
     * Определяет иконку чата
     */
    const chatIcon = computed(() => {
        if (!chat.value) return null

        if (chat.value.type === 'direct' || chat.value.type === 'dialog') {
            // Проверяем что members существует и это массив
            if (!chat.value.members || !Array.isArray(chat.value.members)) {
                return null
            }

            // Для личных диалогов ищем аватар собеседника
            const companion = chat.value.members.find((member) => {
                if (!member) return false // Проверка на существование member

                const memberUserId = String(member.user || member.user_uuid || '')
                const currentUserIdStr = String(currentUserId.value || '')
                return memberUserId !== currentUserIdStr && memberUserId !== ''
            })

            return null // IChatMember не содержит avatar
        }

        return chat.value.icon
    })

    return {
        chatTitle,
        chatIcon,
    }
}

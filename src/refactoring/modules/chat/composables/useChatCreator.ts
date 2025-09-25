/**
 * Композабл для проверки, является ли текущий пользователь создателем чата
 * Предоставляет реактивные методы для работы с правами создателя
 */
import { computed, type ComputedRef } from 'vue'
import type { IChat } from '@/refactoring/modules/chat/types/IChat'
import { useCurrentUser } from '@/refactoring/modules/chat/composables/useCurrentUser'
import { isUserChatCreator } from '@/refactoring/modules/chat/utils/chatHelpers'

export interface ChatCreatorInfo {
    /** Является ли текущий пользователь создателем чата */
    isCreator: ComputedRef<boolean>
    /** Может ли пользователь удалить чат (только создатель) */
    canDeleteChat: ComputedRef<boolean>
    /** Может ли пользователь редактировать основные настройки чата */
    canEditChatSettings: ComputedRef<boolean>
}

/**
 * Композабл для работы с правами создателя чата
 * @param chat - реактивный объект чата или ref на чат
 * @returns объект с реактивными свойствами для проверки прав создателя
 */
export function useChatCreator(chat: ComputedRef<IChat | null> | IChat | null): ChatCreatorInfo {
    const { id: currentUserId } = useCurrentUser()
    
    // Получаем реактивный чат
    const reactiveChat = computed(() => {
        if (typeof chat === 'object' && chat !== null && 'value' in chat) {
            // Это ComputedRef
            return (chat as ComputedRef<IChat | null>).value
        }
        // Это обычный объект или null
        return chat as IChat | null
    })

    // Основная проверка - является ли пользователь создателем
    const isCreator = computed(() => {
        return isUserChatCreator(reactiveChat.value, currentUserId.value)
    })

    // Может ли удалить чат (только создатель)
    const canDeleteChat = computed(() => {
        return isCreator.value
    })

    // Может ли редактировать настройки чата (создатель всегда может)
    const canEditChatSettings = computed(() => {
        return isCreator.value
    })

    return {
        isCreator,
        canDeleteChat,
        canEditChatSettings,
    }
}

/**
 * Упрощенная версия композабла для быстрой проверки
 * @param chat - объект чата
 * @returns true, если текущий пользователь создал чат
 */
export function useIsChatCreator(chat: ComputedRef<IChat | null> | IChat | null): ComputedRef<boolean> {
    const { isCreator } = useChatCreator(chat)
    return isCreator
}
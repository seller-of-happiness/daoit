import { ref } from 'vue'

// Глобальное состояние скользящего чата
const isSlidingChatVisible = ref(false)
const slidingChatInitialChatId = ref<number | null>(null)
const slidingChatInitialUserId = ref<string | null>(null)

export function useSlidingChatGlobal() {
    /**
     * Открытие скользящего чата
     */
    const openSlidingChat = (chatId?: number | null, userId?: string | null) => {
        slidingChatInitialChatId.value = chatId || null
        slidingChatInitialUserId.value = userId || null
        isSlidingChatVisible.value = true
    }

    /**
     * Закрытие скользящего чата
     */
    const closeSlidingChat = () => {
        isSlidingChatVisible.value = false
        slidingChatInitialChatId.value = null
        slidingChatInitialUserId.value = null
    }

    return {
        // Состояние
        isSlidingChatVisible,
        slidingChatInitialChatId,
        slidingChatInitialUserId,
        
        // Методы
        openSlidingChat,
        closeSlidingChat,
    }
}
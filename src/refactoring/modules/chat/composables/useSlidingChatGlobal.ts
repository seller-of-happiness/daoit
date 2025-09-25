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
        // Нормализуем параметры: undefined преобразуем в null
        const normalizedChatId = chatId ?? null
        const normalizedUserId = userId ?? null
        
        console.log('useSlidingChatGlobal.openSlidingChat вызван с параметрами:', { 
            chatId: chatId, 
            userId: userId,
            normalizedChatId,
            normalizedUserId
        })
        
        slidingChatInitialChatId.value = normalizedChatId
        slidingChatInitialUserId.value = normalizedUserId
        isSlidingChatVisible.value = true
        
        console.log('Состояние после установки:', { 
            visible: isSlidingChatVisible.value, 
            chatId: slidingChatInitialChatId.value, 
            userId: slidingChatInitialUserId.value 
        })
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
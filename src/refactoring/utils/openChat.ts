import router from '@/router'
import { ERouteNames } from '@/router/ERouteNames'
import { useSlidingChatGlobal } from '@/refactoring/modules/chat/composables/useSlidingChatGlobal'

/**
 * Открывает чат в скользящем режиме
 * @param userId - ID пользователя для создания чата
 * @param chatId - ID существующего чата
 * @param openInNewTab - открыть в новой вкладке (по умолчанию false)
 */
export const openChat = async (
    userId?: string | null,
    chatId?: number | null,
    openInNewTab = false,
) => {
    if (openInNewTab) {
        // Открываем в новой вкладке
        let href = '/chat?slide=true'

        if (userId) {
            const encodedUserId = encodeURIComponent(String(userId))
            href += `&userId=${encodedUserId}`
        } else if (chatId) {
            href += `&chatId=${chatId}`
        }

        window.open(href, '_blank', 'noopener')
    } else {
        // Открываем скользящий чат без перезагрузки страницы
        const { openSlidingChat } = useSlidingChatGlobal()
        console.log(userId)
        openSlidingChat(chatId, userId)
    }
}

/**
 * Открывает полноэкранный чат
 * @param userId - ID пользователя (опционально)
 */
export const openFullScreenChat = async (userId?: string | null) => {
    if (userId) {
        const href = router.resolve({
            name: ERouteNames.CHAT,
            params: { param: String(userId) },
        }).href
        await router.push(href)
    } else {
        await router.push({ name: ERouteNames.CHAT })
    }
}

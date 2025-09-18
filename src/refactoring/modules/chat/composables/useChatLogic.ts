import { computed, onMounted, onUnmounted, ref, watch, shallowRef } from 'vue'
import { useChatStore } from '@/refactoring/modules/chat/stores/chatStore'
import { useCurrentUser } from '@/refactoring/modules/chat/composables/useCurrentUser'
import { toApiDate, formatDateOnly } from '@/refactoring/utils/formatters'

import type {
    IChat,
    IMessage,
    IEmployee,
    MediaQueryMethods,
    MobileViewType,
} from '@/refactoring/modules/chat/types/IChat'

export interface ChatLogicOptions {
    /** ID пользователя для создания диалога при инициализации */
    userId?: string
    /** ID чата для открытия при инициализации */
    initialChatId?: number | null
    /** ID пользователя для создания диалога при инициализации */
    initialUserId?: string | null
    /** Селектор контейнера сообщений для скролла */
    messagesContainerSelector?: string
    /** Колбэк при открытии чата */
    onChatOpen?: (chat: IChat) => void
}

interface MessageGroup {
    key: string
    label: string
    items: IMessage[]
}

export function useChatLogic(options: ChatLogicOptions = {}) {
    const chatStore = useChatStore()
    const currentUser = useCurrentUser(chatStore.currentChat)

    // Состояние компонента
    const messagesContainer = shallowRef<HTMLElement | null>(null)
    const autoScroll = ref(true)
    const BOTTOM_THRESHOLD_PX = 32

    // Мобильная адаптация
    const isMobile = ref(false)
    const mobileView = ref<MobileViewType>('list')
    let mediaQueryList: (MediaQueryList & MediaQueryMethods) | null = null

    const updateIsMobile = () => {
        if (!mediaQueryList) return
        isMobile.value = mediaQueryList.matches
    }

    // Группировка сообщений по дате с оптимизацией
    const todayKey = toApiDate(new Date())

    const groupedMessages = computed<MessageGroup[]>(() => {
        const items = chatStore.messages
        if (!items?.length) return []

        const groups = new Map<string, MessageGroup>()

        for (const message of items) {
            const key = toApiDate(message?.created_at) || 'unknown'
            if (!groups.has(key)) {
                const isToday = key === todayKey
                groups.set(key, {
                    key,
                    label: isToday ? 'Сегодня' : formatDateOnly(key),
                    items: [],
                })
            }
            groups.get(key)!.items.push(message)
        }

        return Array.from(groups.entries())
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([, value]) => value)
    })

    // Управление скроллом
    const scrollToBottom = () => {
        if (!messagesContainer.value) return
        requestAnimationFrame(() => {
            const el = messagesContainer.value!
            el.scrollTop = el.scrollHeight
        })
    }

    const handleScroll = () => {
        const el = messagesContainer.value
        if (!el) return
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
        autoScroll.value = distanceFromBottom <= BOTTOM_THRESHOLD_PX
    }

    // Обработчики для чата
    const openChatFromList = async (chat: IChat) => {
        await chatStore.openChat(chat)
        if (isMobile.value) mobileView.value = 'chat'
        options.onChatOpen?.(chat)
    }

    const performSearch = async (query: string) => {
        await chatStore.searchChats(query)
    }

    const clearSearch = () => {
        chatStore.searchResults = null
    }

    const createNewDialog = async (employee: IEmployee) => {
        try {
            const chat = await chatStore.createDirectChat(employee.id)
            await chatStore.openChat(chat)
            if (isMobile.value) mobileView.value = 'chat'
            options.onChatOpen?.(chat)
        } catch (error) {
            // Ошибка создания диалога
        }
    }

    // Удалена функция joinPublicChat - используйте приглашения

    const sendMessage = async (content: string) => {
        await chatStore.sendMessage(content)
    }

    const uploadFile = async (file: File) => {
        try {
            const message = await chatStore.sendMessage('')
            await chatStore.uploadAttachment(message.id, file)
        } catch (error) {
            // Ошибка загрузки файла
        }
    }

    const createChat = async (payload: {
        type: 'group' | 'channel'
        title: string
        description: string
        icon: File | null
    }) => {
        const chat = await chatStore.createChat(payload)
        await chatStore.openChat(chat)
        options.onChatOpen?.(chat)
        return chat
    }

    const inviteUsersToChat = async (userIds: string[]) => {
        if (!chatStore.currentChat) return

        try {
            await chatStore.inviteUsersToChat(chatStore.currentChat.id, userIds)
        } catch (error) {
            // Ошибка приглашения пользователей
        }
    }

    const changeReaction = async (
        messageId: number,
        reactionId: number,
        prevReactionId: number | null,
    ) => {
        // Если пользователь кликает на ту же реакцию - удаляем её
        if (prevReactionId && prevReactionId === reactionId) {
            await chatStore.clearMyReactions(messageId)
            return
        }

        // Если у пользователя уже есть реакция - используем эксклюзивную установку
        if (prevReactionId !== null) {
            await chatStore.setExclusiveReaction(messageId, reactionId)
        } else {
            await chatStore.addReaction(messageId, reactionId)
        }
    }

    const removeMyReaction = async (messageId: number, prevReactionId: number | null) => {
        await chatStore.clearMyReactions(messageId)
    }

    // Инициализация
    const initialize = async () => {
        // Инициализация медиа-запросов для мобильной адаптации
        if (typeof window !== 'undefined' && 'matchMedia' in window) {
            mediaQueryList = window.matchMedia('(max-width: 767px)')

            if (mediaQueryList.addEventListener) {
                mediaQueryList.addEventListener('change', updateIsMobile)
            } else {
                // Поддержка старых браузеров
                mediaQueryList.addListener?.(updateIsMobile)
            }

            updateIsMobile()
            mobileView.value = isMobile.value ? (chatStore.currentChat ? 'chat' : 'list') : 'list'
        }

        try {
            // Загрузка чатов только один раз (предотвращение дублирования запросов)
            await chatStore.initializeOnce()

            let chatToOpen: IChat | null = null

            // Попытка найти чат для открытия
            try {
                if (options.userId) {
                    console.log('useChatLogic: Trying to find/create chat with userId:', options.userId)
                    chatToOpen = await chatStore.findOrCreateDirectChat(options.userId)
                    console.log('useChatLogic: Successfully found/created chat with userId:', options.userId, chatToOpen)
                } else if (options.initialUserId) {
                    console.log('useChatLogic: Trying to find/create chat with initialUserId:', options.initialUserId)
                    chatToOpen = await chatStore.findOrCreateDirectChat(options.initialUserId)
                    console.log('useChatLogic: Successfully found/created chat with initialUserId:', options.initialUserId, chatToOpen)
                } else if (options.initialChatId) {
                    // Ищем чат по ID в загруженном списке
                    console.log('useChatLogic: Trying to find chat with initialChatId:', options.initialChatId)
                    chatToOpen = chatStore.chats.find((c) => c.id === options.initialChatId) || null
                    console.log('useChatLogic: Found chat with initialChatId:', options.initialChatId, chatToOpen)
                } else {
                    // Попытка восстановить последний выбранный чат из локального хранилища
                    // ТОЛЬКО если не был передан конкретный пользователь
                    console.log('useChatLogic: No specific user/chat provided, trying localStorage')
                    try {
                        const savedId = Number(localStorage.getItem('selectedChatId') || '')
                        if (savedId && !Number.isNaN(savedId)) {
                            chatToOpen = chatStore.chats.find((c) => c.id === savedId) || null
                            console.log('useChatLogic: Found chat from localStorage:', savedId, chatToOpen)
                        }
                    } catch (e) {
                        // Игнорируем ошибки локального хранилища
                        console.log('useChatLogic: Error reading from localStorage:', e)
                    }
                }

                // Если нашли чат для открытия - открываем его
                if (chatToOpen) {
                    try {
                        await chatStore.openChat(chatToOpen)
                        if (isMobile.value) mobileView.value = 'chat'
                        options.onChatOpen?.(chatToOpen)
                    } catch (error) {
                        // Не удалось открыть чат

                        // Если не удалось открыть выбранный чат, сбрасываем его
                        chatStore.currentChat = null

                        // Попытаемся открыть первый доступный чат ТОЛЬКО если не был передан конкретный пользователь
                        if (!options.userId && !options.initialUserId && chatStore.chats.length > 0) {
                            try {
                                const firstChat = chatStore.chats[0]
                                await chatStore.openChat(firstChat)
                                if (isMobile.value) mobileView.value = 'chat'
                                options.onChatOpen?.(firstChat)
                            } catch (fallbackError) {
                                // Не удалось открыть резервный чат
                            }
                        }
                    }
                } else if (!options.userId && !options.initialUserId && chatStore.chats.length > 0) {
                    // Если нет конкретного чата для открытия, но есть чаты - открываем первый
                    // ТОЛЬКО если не был передан конкретный пользователь
                    try {
                        const firstChat = chatStore.chats[0]
                        await chatStore.openChat(firstChat)
                        if (isMobile.value) mobileView.value = 'chat'
                        options.onChatOpen?.(firstChat)
                    } catch (error) {
                        // Не удалось открыть первый чат
                    }
                }
            } catch (error) {
                // Ошибка при инициализации чата
                console.error('useChatLogic: Error during chat initialization:', error)
                
                // Если была ошибка при создании чата с конкретным пользователем, 
                // НЕ откатываемся к localStorage чату
                if (options.userId || options.initialUserId) {
                    console.log('useChatLogic: Failed to create chat with specific user, not falling back to localStorage')
                    // Очищаем текущий чат, чтобы показать пустое состояние
                    chatStore.currentChat = null
                }
                
                // Не прерываем инициализацию из-за ошибок чата
            }

            // Инициализация скролла
            if (options.messagesContainerSelector) {
                try {
                    const container = document.querySelector(
                        options.messagesContainerSelector,
                    ) as HTMLElement
                    if (container) {
                        messagesContainer.value = container
                        container.addEventListener('scroll', handleScroll, { passive: true })
                    }
                } catch (error) {
                    // Не удалось инициализировать контейнер сообщений
                }
            }

            // Скролл вниз с задержкой для корректной отрисовки
            setTimeout(scrollToBottom, 100)
        } catch (error) {
            // Критическая ошибка при инициализации чата
            // Даже при критической ошибке не прерываем работу приложения
        }
    }

    const cleanup = () => {
        // Очистка обработчиков медиа-запросов
        if (mediaQueryList) {
            if (mediaQueryList.removeEventListener) {
                mediaQueryList.removeEventListener('change', updateIsMobile)
            } else {
                mediaQueryList.removeListener?.(updateIsMobile)
            }
        }

        // Очистка обработчика скролла
        if (messagesContainer.value) {
            messagesContainer.value.removeEventListener('scroll', handleScroll)
        }
    }

    // Наблюдатели с оптимизацией
    watch(
        () => chatStore.currentChat?.id,
        () => {
            autoScroll.value = true
            requestAnimationFrame(scrollToBottom)
        },
        { flush: 'post' },
    )

    watch(
        () => chatStore.messages.length,
        () => {
            if (autoScroll.value) {
                requestAnimationFrame(scrollToBottom)
            }
        },
        { flush: 'post' },
    )

    return {
        // Хранилище и пользователь
        chatStore,
        currentUser,

        // Состояние
        messagesContainer,
        autoScroll,
        isMobile,
        mobileView,

        // Вычисляемые свойства
        groupedMessages,

        // Методы управления скроллом
        scrollToBottom,
        handleScroll,

        // Обработчики событий
        openChatFromList,
        performSearch,
        clearSearch,
        createNewDialog,
        sendMessage,
        uploadFile,
        createChat,
        inviteUsersToChat,
        changeReaction,
        removeMyReaction,

        // Жизненный цикл
        initialize,
        cleanup,

        // Утилиты
        updateIsMobile,
    }
}

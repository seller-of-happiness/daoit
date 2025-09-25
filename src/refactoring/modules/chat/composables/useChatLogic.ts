import { computed, onMounted, onUnmounted, ref, watch, shallowRef } from 'vue'
import { useChatStore } from '@/refactoring/modules/chat/stores/chatStore'
import { useCurrentUser } from '@/refactoring/modules/chat/composables/useCurrentUser'
import { useFeedbackStore } from '@/refactoring/modules/feedback/stores/feedbackStore'
import { toApiDate, formatDateOnly } from '@/refactoring/utils/formatters'

import type {
    IChat,
    IMessage,
    IEmployee,
    IChatInvitation,
    MediaQueryMethods,
    MobileViewType,
    IChatUpdatePayload,
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
            const chat = await chatStore.createDialog(employee.id)
            await chatStore.openChat(chat)
            if (isMobile.value) mobileView.value = 'chat'
            options.onChatOpen?.(chat)
        } catch (error) {
            // Ошибка создания диалога
        }
    }

    const sendMessage = async (content: string, files?: File[]) => {
        if (files && files.length > 0) {
            // Отправляем сообщение с файлами
            await chatStore.sendMessageWithFiles(content, files)
        } else {
            // Отправляем обычное текстовое сообщение
            await chatStore.sendMessage(content)
        }
    }

    // Создание чата с поддержкой новых типов
    const createChat = async (payload: {
        type: 'group' | 'channel'
        title: string
        description?: string
        icon?: File | null
        addMembersImmediately?: boolean
    }) => {
        let chat: IChat

        // Используем соответствующий метод в зависимости от типа
        if (payload.type === 'group') {
            chat = await chatStore.createGroup({
                title: payload.title,
                description: payload.description,
                icon: payload.icon,
            })
        } else if (payload.type === 'channel') {
            chat = await chatStore.createChannel({
                title: payload.title,
                description: payload.description,
                icon: payload.icon,
            })
        } else {
            throw new Error(`Unsupported chat type: ${payload.type}`)
        }

        await chatStore.openChat(chat)
        options.onChatOpen?.(chat)

        // Возвращаем объект с чатом и флагом для немедленного добавления участников
        return {
            chat,
            shouldInviteMembers: payload.addMembersImmediately || false,
        }
    }

    const addMembersToChat = async (userIds: string[]) => {
        if (!chatStore.currentChat) return

        try {
            await chatStore.addMembersToChat(chatStore.currentChat.id, userIds)
        } catch (error) {
            // Ошибка добавления участников
        }
    }

    // Для обратной совместимости
    const inviteUsersToChat = addMembersToChat

    // Управление участниками чата
    const removeMemberFromChat = async (userId: string) => {
        if (!chatStore.currentChat) return

        try {
            await chatStore.removeMemberFromChat(chatStore.currentChat.id, userId)
        } catch (error) {
            // Ошибка удаления участника
        }
    }

    // Обновление информации о чате
    const updateChatInfo = async (payload: IChatUpdatePayload) => {
        if (!chatStore.currentChat) return

        try {
            const updatedChat = await chatStore.updateChat(chatStore.currentChat.id, payload)
            return updatedChat
        } catch (error) {
            // Ошибка обновления чата
            throw error
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

    // Управление приглашениями
    const acceptInvitation = async (invitationOrId: number | IChatInvitation) => {
        try {
            const invitationId =
                typeof invitationOrId === 'number' ? invitationOrId : invitationOrId.id
            if (!invitationId || invitationId <= 0) {
                console.error(
                    '[useChatLogic] acceptInvitation: недействительный invitationId',
                    invitationOrId,
                )
                // Показываем уведомление пользователю
                const fb = useFeedbackStore()
                fb.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: 'Недействительное приглашение. Попробуйте перезагрузить страницу.',
                    time: 7000,
                })
                return
            }

            console.log('[useChatLogic] Принимаем приглашение с ID:', invitationId)
            await chatStore.acceptInvitation(invitationId)
        } catch (error) {
            console.error('[useChatLogic] Ошибка принятия приглашения:', error)
            // Ошибка уже обработана в store
        }
    }

    const declineInvitation = async (invitationOrId: number | IChatInvitation) => {
        try {
            const invitationId =
                typeof invitationOrId === 'number' ? invitationOrId : invitationOrId.id
            if (!invitationId || invitationId <= 0) {
                console.error(
                    '[useChatLogic] declineInvitation: недействительный invitationId',
                    invitationOrId,
                )
                // Показываем уведомление пользователю
                const fb = useFeedbackStore()
                fb.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: 'Недействительное приглашение. Попробуйте перезагрузить страницу.',
                    time: 7000,
                })
                return
            }

            console.log('[useChatLogic] Отклоняем приглашение с ID:', invitationId)
            await chatStore.declineInvitation(invitationId)
        } catch (error) {
            console.error('[useChatLogic] Ошибка отклонения приглашения:', error)
            // Ошибка уже обработана в store
        }
    }

    // Инициализация
    const initialize = async () => {
        console.log('useChatLogic.initialize вызван с опциями:', options)

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
            console.log('useChatLogic.initialize: вызываем chatStore.initializeOnce()')
            // Загрузка чатов только один раз (предотвращение дублирования запросов)
            await chatStore.initializeOnce()
            console.log('useChatLogic.initialize: chatStore.initializeOnce() завершен')

            let chatToOpen: IChat | null = null

            // Попытка найти чат для открытия
            try {
                if (options.userId) {
                    chatToOpen = await chatStore.createDialog(options.userId)
                } else if (options.initialUserId) {
                    chatToOpen = await chatStore.createDialog(options.initialUserId)
                } else if (options.initialChatId) {
                    // Сначала ищем чат по ID в загруженном списке
                    chatToOpen =
                        chatStore.chats.find((c: IChat) => c.id === options.initialChatId) || null

                    // Если чат не найден в списке, попробуем открыть напрямую по ID
                    if (!chatToOpen) {
                        try {
                            await chatStore.openChatById(options.initialChatId)
                            // Если успешно открыли, выходим из блока инициализации
                            if (isMobile.value) mobileView.value = 'chat'
                            options.onChatOpen?.(chatStore.currentChat!)
                            return
                        } catch (error) {
                            // Не удалось открыть чат по ID, продолжаем обычную логику
                        }
                    }
                } else {
                    // Попытка восстановить последний выбранный чат из локального хранилища
                    // ТОЛЬКО если не был передан конкретный пользователь
                    try {
                        const savedId = Number(localStorage.getItem('selectedChatId') || '')
                        if (savedId && !Number.isNaN(savedId)) {
                            // Сначала пытаемся найти чат в уже загруженном списке
                            chatToOpen =
                                chatStore.chats.find((c: IChat) => c.id === savedId) || null

                            // Если чат не найден в списке, попробуем открыть по ID
                            // (это загрузит актуальную информацию с сервера)
                            if (!chatToOpen) {
                                try {
                                    await chatStore.openChatById(savedId)
                                    // Если успешно открыли, выходим из блока инициализации
                                    if (isMobile.value) mobileView.value = 'chat'
                                    options.onChatOpen?.(chatStore.currentChat!)
                                    return
                                } catch (error) {
                                    // Не удалось открыть сохраненный чат, продолжаем обычную логику
                                }
                            }
                        }
                    } catch (e) {
                        // Игнорируем ошибки локального хранилища
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
                        if (
                            !options.userId &&
                            !options.initialUserId &&
                            chatStore.chats.length > 0
                        ) {
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
                } else if (
                    !options.userId &&
                    !options.initialUserId &&
                    chatStore.chats.length > 0
                ) {
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

                // Если была ошибка при создании чата с конкретным пользователем,
                // НЕ откатываемся к localStorage чату
                if (options.userId || options.initialUserId) {
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
        createChat,
        addMembersToChat,
        inviteUsersToChat,
        removeMemberFromChat,
        updateChatInfo,
        changeReaction,
        removeMyReaction,
        acceptInvitation,
        declineInvitation,

        // Жизненный цикл
        initialize,
        cleanup,

        // Утилиты
        updateIsMobile,
    }
}

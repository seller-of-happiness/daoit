/*
 * Хранилище чатов (чат-центр приложения)
 *
 * Основные функции:
 * - Загрузка и управление списком чатов
 * - Открытие чата, загрузка сообщений и подписка на realtime-обновления
 * - Отправка сообщений и загрузка вложений
 * - Работа с реакциями: загрузка типов, добавление/удаление, эксклюзивная постановка
 * - Поиск чатов и создание новых (группы/каналы/личные диалоги)
 * - Управление приглашениями в чаты
 *
 * Особенности:
 * - Сообщения упорядочиваются по времени (старые → новые)
 * - Чаты сортируются по времени последнего сообщения (новые → старые)
 * - Восстановление последнего выбранного чата через localStorage
 * - Realtime-подписка через центрифуго на единый канал chats:user#user_uuid
 * - Debounced-поиск с отображением серверных результатов
 * - Унифицированная обработка серверных ответов (поддержка data.results и плоского ответа)
 * - Управление глобальной индикацией загрузки и показом уведомлений
 */
import axios from 'axios'
import { defineStore } from 'pinia'
import { BASE_URL } from '@/refactoring/environment/environment'
import { useFeedbackStore } from '@/refactoring/modules/feedback/stores/feedbackStore'
import type {
    IChat,
    IChatStoreState,
    IMessage,
    IReactionType,
    IEmployee,
    ISearchResults,
    IChatInvitation,
} from '@/refactoring/modules/chat/types/IChat'
import { useCentrifugeStore } from '@/refactoring/modules/centrifuge/stores/centrifugeStore'
import { useUserStore } from '@/refactoring/modules/user/stores/userStore'
import { soundService } from '@/refactoring/utils/soundService'
import { useCurrentUser, isMyMessage } from '@/refactoring/modules/chat/composables/useCurrentUser'
import { useUnreadMessages } from '@/refactoring/modules/chat/composables/useUnreadMessages'

// Упорядочивание сообщений по времени (сначала старые)
function compareMessagesAscending(a: IMessage, b: IMessage): number {
    const aTime = a?.created_at ? Date.parse(a.created_at) : NaN
    const bTime = b?.created_at ? Date.parse(b.created_at) : NaN
    if (!Number.isNaN(aTime) && !Number.isNaN(bTime)) return aTime - bTime
    // Фоллбек по id на случай отсутствия/некорректного времени
    const aId = a?.id ?? 0
    const bId = b?.id ?? 0
    return aId - bId
}

// Сортировка чатов по времени последнего сообщения (новые сверху)
function sortChatsByLastMessage(chats: IChat[]): IChat[] {
    return [...chats].sort((a, b) => {
        // Сначала пытаемся сравнить по времени последнего сообщения
        const aLastMessage = a.last_message
        const bLastMessage = b.last_message

        if (aLastMessage && bLastMessage) {
            const aTime = Date.parse(aLastMessage.created_at)
            const bTime = Date.parse(bLastMessage.created_at)
            if (!isNaN(aTime) && !isNaN(bTime)) {
                return bTime - aTime // Новые сверху
            }
        }

        // Если у одного есть последнее сообщение, а у другого нет
        if (aLastMessage && !bLastMessage) return -1
        if (!aLastMessage && bLastMessage) return 1

        // Если у обоих нет последних сообщений, сортируем по времени создания чата
        const aCreated = a.created_at ? Date.parse(a.created_at) : 0
        const bCreated = b.created_at ? Date.parse(b.created_at) : 0

        return bCreated - aCreated // Новые сверху
    })
}

// Глобальный экземпляр для управления непрочитанными сообщениями в заголовке
const globalUnreadMessages = useUnreadMessages()

// Обеспечиваем инициализацию событий в клиентском коде
if (typeof window !== 'undefined') {
    // Инициализируем события после загрузки DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            globalUnreadMessages.initializeEventListeners()
        })
    } else {
        globalUnreadMessages.initializeEventListeners()
    }
}

export const useChatStore = defineStore('chatStore', {
    state: (): IChatStoreState => ({
        chats: [],
        currentChat: null,
        messages: [],
        reactionTypes: [],
        isSending: false,
        searchResults: null,
        isSearching: false,
        // Флаг для предотвращения дублирования инициализации
        isInitialized: false,
        isInitializing: false,
        // Приглашения в чаты
        invitations: [],
    }),
    actions: {
        // Получает UUID текущего пользователя для подписки на центрифуго
        getCurrentUserUuid(): string | null {
            const userStore = useUserStore()
            return userStore.user?.uuid || userStore.user?.id?.toString() || null
        },

        // Подписывается на единый канал пользователя для получения уведомлений о всех чатах
        // Используется новая система: один канал chats:user#${userUuid} вместо подписки на каждый чат отдельно
        subscribeToUserChannel(): void {
            const centrifuge = useCentrifugeStore()
            const userUuid = this.getCurrentUserUuid()

            if (!userUuid) {
                return
            }

            const channelName = `chats:user#${userUuid}`

            centrifuge.subscribe(channelName, (data: any) => {
                this.handleCentrifugoMessage(data)
            })
        },

        // Обрабатывает сообщения из центрифуго
        handleCentrifugoMessage(data: any): void {
            const eventType = data?.event_type || data?.event || data?.type

            switch (eventType) {
                case 'message':
                case 'new_message':
                    // Проверяем структуру данных из центрифуго
                    const messageData = data?.data?.message || data.message || data.object || data
                    const chatId = data?.data?.chat_id || data.chat_id

                    if (messageData && chatId) {
                        this.handleNewMessage(messageData, chatId)
                    }
                    break

                case 'chat_updated':
                    const chatData = data?.data?.chat || data.chat || data.object || data
                    this.handleChatUpdated(chatData)
                    break

                case 'reaction_added':
                case 'reaction_removed':
                case 'new_reaction':
                case 'reaction_update':
                case 'reaction_changed':
                    this.handleReactionUpdate(data)
                    break

                case 'member_added':
                case 'member_removed':
                    this.handleMembershipUpdate(data)
                    break

                case 'new_invite':
                    // Обрабатываем новое приглашение в чат
                    this.handleNewInvitation(data)
                    break

                default:
                    // Fallback: если нет event_type, но есть id и content - считаем новым сообщением
                    if (data?.id && data?.content !== undefined) {
                        this.handleNewMessage(data, data.chat_id)
                    } else if (
                        data?.message_id &&
                        (data?.reaction_type_id || data?.reaction_type)
                    ) {
                        this.handleReactionUpdate(data)
                    }
                    break
            }
        },

        // Инициализирует чаты только один раз для предотвращения дублирования запросов
        async initializeOnce(): Promise<void> {
            // Если уже инициализировано или идет инициализация - выходим
            if (this.isInitialized || this.isInitializing) {
                return
            }

            this.isInitializing = true

            try {
                await this.fetchChats()

                // Загружаем приглашения после загрузки чатов
                await this.fetchInvitations()

                this.isInitialized = true
            } catch (error) {
                // Не устанавливаем isInitialized в true при ошибке,
                // чтобы можно было повторить инициализацию
            } finally {
                this.isInitializing = false
            }
        },

        // Сбрасывает состояние инициализации (например, при логауте)
        resetInitialization(): void {
            this.isInitialized = false
            this.isInitializing = false
            this.chats = []
            this.currentChat = null
            this.messages = []
            this.searchResults = null
            this.invitations = []
            // Сбрасываем счетчик непрочитанных сообщений в заголовке
            globalUnreadMessages.resetUnread()
        },

        // Загружает список чатов. Управляет глобальным индикатором загрузки, логирует ошибки
        async fetchChats(): Promise<void> {
            const fb = useFeedbackStore()
            fb.isGlobalLoading = true

            try {
                const res = await axios.get(`${BASE_URL}/api/chat/chat/`)
                const chatsData = res.data?.results ?? res.data

                // Проверяем что получили массив
                if (Array.isArray(chatsData)) {
                    // Сортируем чаты по времени последнего сообщения
                    this.chats = sortChatsByLastMessage(chatsData)
                } else {
                    this.chats = []
                }

                // Загружаем счетчики непрочитанных сообщений (с обработкой ошибок)
                await this.fetchUnreadCounts()

                // Обновляем счетчик в заголовке после загрузки чатов
                this.updateTitleUnreadCount()

                // Подписываемся на единый канал пользователя для получения уведомлений о всех чатах
                this.subscribeToUserChannel()
            } catch (error) {
                // Устанавливаем пустой массив при ошибке
                this.chats = []

                fb.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: 'Не удалось загрузить чаты',
                    time: 7000,
                })

                // НЕ выбрасываем ошибку дальше, чтобы не ломать приложение
            } finally {
                fb.isGlobalLoading = false
            }
        },

        // Создаёт групповой/канальный чат. Возвращает созданный объект и добавляет его в начало списка
        async createChat(payload: {
            type: 'group' | 'channel'
            title: string
            description?: string
            icon?: File | null
        }): Promise<IChat> {
            try {
                const form = new FormData()
                form.append('type', payload.type)
                form.append('title', payload.title || '')
                if (payload.description) form.append('description', payload.description)
                if (payload.icon) form.append('icon', payload.icon)

                const res = await axios.post(`${BASE_URL}/api/chat/chat/`, form, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                })
                const chat = (res.data?.results ?? res.data) as IChat

                // Добавляем новый чат и пересортируем список
                this.chats.unshift(chat)
                this.chats = sortChatsByLastMessage(this.chats)

                useFeedbackStore().showToast({
                    type: 'success',
                    title: 'Создано',
                    message: 'Чат успешно создан',
                    time: 3000,
                })
                return chat
            } catch (error) {
                useFeedbackStore().showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: 'Не удалось создать чат',
                    time: 7000,
                })
                throw error
            }
        },

        // Получает информацию о конкретном чате
        async fetchChat(chatId: number): Promise<IChat> {
            try {
                const res = await axios.get(`${BASE_URL}/api/chat/chat/${chatId}/`)
                return (res.data?.results ?? res.data) as IChat
            } catch (error) {
                throw error
            }
        },

        // Обновляет информацию о чате
        async updateChat(chatId: number, payload: Partial<IChat>): Promise<IChat> {
            try {
                const res = await axios.patch(`${BASE_URL}/api/chat/chat/${chatId}/`, payload)
                const updatedChat = (res.data?.results ?? res.data) as IChat

                // Обновляем чат в списке
                const chatIndex = this.chats.findIndex((chat) => chat.id === chatId)
                if (chatIndex !== -1) {
                    this.chats.splice(chatIndex, 1, updatedChat)
                    // Пересортируем список после обновления
                    this.chats = sortChatsByLastMessage(this.chats)
                }

                // Обновляем текущий чат, если это он
                if (this.currentChat?.id === chatId) {
                    this.currentChat = updatedChat
                }

                useFeedbackStore().showToast({
                    type: 'success',
                    title: 'Обновлено',
                    message: 'Чат успешно обновлен',
                    time: 3000,
                })

                return updatedChat
            } catch (error) {
                useFeedbackStore().showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: 'Не удалось обновить чат',
                    time: 7000,
                })
                throw error
            }
        },

        // Удаляет участника из чата
        async removeMemberFromChat(chatId: number, memberId: string): Promise<void> {
            try {
                await axios.delete(`${BASE_URL}/api/chat/chat/${chatId}/remove-member/`, {
                    data: { member_id: memberId },
                })

                // Обновляем информацию о чате после удаления участника
                const updatedChat = await this.fetchChat(chatId)
                const chatIndex = this.chats.findIndex((chat) => chat.id === chatId)
                if (chatIndex !== -1) {
                    this.chats.splice(chatIndex, 1, updatedChat)
                    // Пересортируем список после обновления
                    this.chats = sortChatsByLastMessage(this.chats)
                }

                // Обновляем текущий чат, если это он
                if (this.currentChat?.id === chatId) {
                    this.currentChat = updatedChat
                }

                useFeedbackStore().showToast({
                    type: 'success',
                    title: 'Успешно',
                    message: 'Участник удален из чата',
                    time: 3000,
                })
            } catch (error) {
                useFeedbackStore().showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: 'Не удалось удалить участника',
                    time: 7000,
                })
                throw error
            }
        },

        // Выполняет поиск чатов и предложений новых диалогов
        async searchChats(query: string, includePublic: boolean = true): Promise<ISearchResults> {
            if (!query.trim()) {
                this.searchResults = null
                return { chats: [], new_dialogs: [] }
            }

            this.isSearching = true
            try {
                const params = new URLSearchParams({
                    q: query.trim(),
                    ...(includePublic && { include_public: 'true' }),
                })

                const res = await axios.get(
                    `${BASE_URL}/api/chat/chat/search/?${params.toString()}`,
                )

                this.searchResults = res.data
                return res.data
            } catch (error) {
                useFeedbackStore().showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: 'Не удалось выполнить поиск',
                    time: 7000,
                })
                throw error
            } finally {
                this.isSearching = false
            }
        },

        // Создаёт или возвращает существующий личный диалог с выбранным сотрудником
        async createDirectChat(employeeId: string): Promise<IChat> {
            try {
                const res = await axios.post(`${BASE_URL}/api/chat/chat/dialog/`, {
                    user_id: employeeId,
                })
                const chat = res.data.chat || res.data

                // Проверяем, есть ли чат уже в списке
                const existingChatIndex = this.chats.findIndex((c) => c.id === chat.id)
                if (existingChatIndex === -1) {
                    // Если чата нет в списке, добавляем его
                    this.chats.unshift(chat)
                    // Пересортируем список
                    this.chats = sortChatsByLastMessage(this.chats)

                    useFeedbackStore().showToast({
                        type: 'success',
                        title: 'Успешно',
                        message: 'Диалог открыт',
                        time: 3000,
                    })
                } else {
                    // Если чат уже есть, обновляем его данные
                    this.chats.splice(existingChatIndex, 1, chat)
                    // Пересортируем список
                    this.chats = sortChatsByLastMessage(this.chats)
                }

                this.searchResults = null
                return chat
            } catch (error) {
                useFeedbackStore().showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: 'Не удалось создать диалог',
                    time: 7000,
                })
                throw error
            }
        },

        // Находит или создает диалог с пользователем (теперь делегирует логику на сервер)
        async findOrCreateDirectChat(userId: string): Promise<IChat> {
            // Теперь просто используем createDirectChat, который сам решает создавать или возвращать существующий
            return await this.createDirectChat(userId)
        },

        // Получает счетчики непрочитанных сообщений для всех чатов
        async fetchUnreadCounts(): Promise<void> {
            try {
                // Используем GET для получения счетчиков непрочитанных сообщений
                const res = await axios.get(`${BASE_URL}/api/chat/chat/unread-counts/`)
                const unreadData = res.data?.results ?? res.data

                // Проверяем формат ответа - может быть массив объектов или объект с ключами chat_id
                let unreadCounts: { chat_id: number; unread_count: number }[] = []

                if (Array.isArray(unreadData)) {
                    unreadCounts = unreadData
                } else if (unreadData && typeof unreadData === 'object') {
                    // Конвертируем объект в массив, если пришёл в формате { "chat_id": count }
                    unreadCounts = Object.entries(unreadData).map(([chatId, count]) => ({
                        chat_id: parseInt(chatId, 10),
                        unread_count: Number(count),
                    }))
                }

                // Обновляем счетчики в чатах
                unreadCounts.forEach((item) => {
                    const chatIndex = this.chats.findIndex((c) => c.id === item.chat_id)
                    if (chatIndex !== -1) {
                        const updatedChats = [...this.chats]
                        updatedChats[chatIndex] = {
                            ...updatedChats[chatIndex],
                            unread_count: item.unread_count,
                        }
                        this.chats = updatedChats
                    }
                })
            } catch (error) {
                // API может возвращать 404 если не реализован - инициализируем счетчики нулями

                // Инициализируем все чаты с нулевыми счетчиками
                const updatedChats = this.chats.map((chat) => ({
                    ...chat,
                    unread_count: chat.unread_count ?? 0,
                }))
                this.chats = updatedChats
            }
        },

        // Обновляет счетчик непрочитанных сообщений в заголовке страницы
        updateTitleUnreadCount(): void {
            const totalUnread = this.chats.reduce(
                (total, chat) => total + (chat.unread_count || 0),
                0,
            )

            // Устанавливаем счетчик через специальный метод
            globalUnreadMessages.setUnreadCount(totalUnread)
        },

        // Обрабатывает новое сообщение из WebSocket
        handleNewMessage(message: IMessage, chatId: number): void {
            const currentUserInfo = useCurrentUser(this.currentChat)
            const isFromCurrentUser = isMyMessage(
                message,
                String(currentUserInfo.id.value ?? ''),
                String(currentUserInfo.name.value ?? ''),
            )
            const isCurrentChat = this.currentChat?.id === chatId

            // Если это текущий чат - добавляем сообщение в список
            if (isCurrentChat) {
                // Проверяем что сообщение еще не добавлено
                const exists = this.messages.some((m) => m.id === message.id)
                if (!exists) {
                    this.messages.push(message)
                    this.messages.sort(compareMessagesAscending)
                }

                // Отмечаем как прочитанное
                setTimeout(() => {
                    this.markChatAsRead(chatId, message.id)
                }, 500)
            } else {
                // Если это другой чат - увеличиваем счетчик непрочитанных
                const chatIndex = this.chats.findIndex((c) => c.id === chatId)
                if (chatIndex !== -1) {
                    const oldCount = this.chats[chatIndex].unread_count || 0
                    const updatedChats = [...this.chats]
                    updatedChats[chatIndex] = {
                        ...updatedChats[chatIndex],
                        unread_count: oldCount + 1,
                        last_message_id: message.id,
                        last_message: message,
                    }
                    this.chats = updatedChats

                    // Пересортируем чаты после получения нового сообщения
                    this.chats = sortChatsByLastMessage(this.chats)

                    // Обновляем счетчик в заголовке после изменения счетчиков чатов
                    this.updateTitleUnreadCount()
                }
            }

            // Обновляем информацию о последнем сообщении в текущем чате тоже
            if (isCurrentChat && this.currentChat) {
                const chatIndex = this.chats.findIndex((c) => c.id === this.currentChat!.id)
                if (chatIndex !== -1) {
                    const updatedChat = {
                        ...this.chats[chatIndex],
                        last_message: message,
                        last_message_id: message.id,
                    }
                    this.chats.splice(chatIndex, 1, updatedChat)

                    // Пересортируем чаты после обновления последнего сообщения
                    this.chats = sortChatsByLastMessage(this.chats)
                }
            }

            // Для чужих сообщений воспроизводим звук
            if (!isFromCurrentUser) {
                // Воспроизводим звук для всех чужих сообщений (и в активном, и в неактивном чате)
                soundService.playNewMessageSound().catch(() => {
                    // Игнорируем ошибки воспроизведения звука
                })
            }
        },

        // Обрабатывает обновление информации о чате
        handleChatUpdated(chat: IChat): void {
            const chatIndex = this.chats.findIndex((c) => c.id === chat.id)
            if (chatIndex !== -1) {
                this.chats.splice(chatIndex, 1, chat)
                // Пересортируем список после обновления
                this.chats = sortChatsByLastMessage(this.chats)
            }

            // Обновляем текущий чат, если это он
            if (this.currentChat?.id === chat.id) {
                this.currentChat = chat
            }
        },

        // Обрабатывает обновление реакций
        handleReactionUpdate(data: any): void {
            // Извлекаем данные реакции из нового формата бэкенда
            const reactionData = data?.data || data
            const chatId = reactionData?.chat_id || data?.chat_id
            const messageId = reactionData?.message_id || data?.message_id
            const eventType = data?.event_type || data?.event || data?.type

            // Новый формат: данные реакции находятся в поле reaction
            const reactionInfo = reactionData?.reaction || reactionData
            const reactionTypeId =
                reactionInfo?.reaction_type_id ||
                reactionData?.reaction_type_id ||
                reactionData?.reaction_type ||
                data?.reaction_type_id ||
                data?.reaction_type
            const userId =
                reactionInfo?.user_id ||
                reactionData?.user_id ||
                reactionData?.user ||
                data?.user_id ||
                data?.user
            const userName = reactionInfo?.user_name || reactionData?.user_name || data?.user_name
            const userAvatar = reactionInfo?.avatar || reactionData?.avatar || data?.avatar

            if (!chatId || !messageId) {
                return
            }

            // Если это текущий чат, обновляем локально
            if (this.currentChat && chatId === this.currentChat.id) {
                const success = this.updateMessageReactionLocally(
                    messageId,
                    reactionTypeId,
                    userId,
                    eventType,
                    userName,
                    userAvatar,
                )

                if (success) {
                    // Принудительно обновляем реактивность, создавая новый массив сообщений
                    this.messages = this.messages.map((msg) => ({ ...msg }))
                } else {
                    // Если локальное обновление не удалось, перезагружаем сообщения
                    this.fetchMessages(this.currentChat.id).catch(() => {})
                }
            }
        },

        // Локальное обновление реакции в сообщении
        updateMessageReactionLocally(
            messageId: number,
            reactionTypeId: number,
            userId: string,
            eventType: string,
            userName?: string,
            userAvatar?: string | null,
        ): boolean {
            try {
                const messageIndex = this.messages.findIndex((m) => m.id === messageId)
                if (messageIndex === -1) {
                    return false
                }

                const message = this.messages[messageIndex]
                let reactions = message.reactions || message.message_reactions || []

                // Создаем глубокую копию массива реакций для избежания мутаций
                const newReactions = JSON.parse(JSON.stringify(reactions))

                if (eventType === 'new_reaction' || eventType === 'reaction_added') {
                    // Сначала удаляем все предыдущие реакции этого пользователя (эксклюзивность)
                    const filteredReactions = newReactions.filter((r: any) => {
                        const reactionUserId = String(r.user || r.user_id || '')
                        return reactionUserId !== String(userId)
                    })

                    // Добавляем новую реакцию с полными данными пользователя
                    const newReaction = {
                        id: Date.now(), // Временный ID
                        reaction_type: reactionTypeId,
                        reaction_type_id: reactionTypeId,
                        user: userId,
                        user_id: userId,
                        user_name: userName,
                        avatar: userAvatar,
                        created_at: new Date().toISOString(),
                    }
                    filteredReactions.push(newReaction)

                    // Создаем новое сообщение с обновленными реакциями и временной меткой обновления
                    const updatedMessage = {
                        ...message,
                        reactions: filteredReactions,
                        message_reactions: filteredReactions,
                        // Добавляем временную метку последнего обновления для принудительного перерендера
                        reaction_updated_at: new Date().toISOString(),
                    }

                    // Заменяем сообщение в массиве
                    this.messages.splice(messageIndex, 1, updatedMessage)
                } else if (eventType === 'reaction_removed') {
                    // Удаляем все реакции этого пользователя
                    const filteredReactions = newReactions.filter((r: any) => {
                        const reactionUserId = String(r.user || r.user_id || '')
                        return reactionUserId !== String(userId)
                    })

                    // Создаем новое сообщение с обновленными реакциями и временной меткой обновления
                    const updatedMessage = {
                        ...message,
                        reactions: filteredReactions,
                        message_reactions: filteredReactions,
                        // Добавляем временную метку последнего обновления для принудительного перерендера
                        reaction_updated_at: new Date().toISOString(),
                    }

                    // Заменяем сообщение в массиве
                    this.messages.splice(messageIndex, 1, updatedMessage)
                }

                return true
            } catch (error) {
                return false
            }
        },

        // Обрабатывает изменения состава участников
        handleMembershipUpdate(data: any): void {
            // Перезагружаем список чатов для актуализации информации об участниках
            this.fetchChats()
        },

        // Обрабатывает новое приглашение в чат
        handleNewInvitation(data: any): void {
            try {
                // Извлекаем данные приглашения из WebSocket сообщения
                const invitationData = data?.data || data

                if (!invitationData?.chat || !invitationData?.created_by) {
                    return
                }

                // Получаем данные текущего пользователя если invited_user отсутствует
                const userStore = useUserStore()
                const currentUser = userStore.user
                const currentUserUuid = this.getCurrentUserUuid()

                const invitation: IChatInvitation = {
                    id: invitationData.id,
                    chat: invitationData.chat,
                    created_by: invitationData.created_by,
                    invited_user:
                        invitationData.invited_user ||
                        (currentUser
                            ? {
                                  id: currentUser.uuid || currentUser.id?.toString() || '',
                                  first_name: currentUser.first_name || '',
                                  last_name: currentUser.last_name || '',
                                  middle_name: currentUser.middle_name || '',
                                  phone_number: currentUser.phone_number || '',
                                  birth_date: currentUser.birth_date || null,
                              }
                            : undefined),
                    is_accepted: invitationData.is_accepted || false,
                    created_at: new Date().toISOString(),
                }

                // Проверяем, что приглашение для текущего пользователя
                if (invitation.invited_user && invitation.invited_user.id !== currentUserUuid) {
                    return
                }

                // Добавляем приглашение в список, если его еще нет
                const existingIndex = this.invitations.findIndex(
                    (inv) =>
                        inv.chat.id === invitation.chat.id &&
                        inv.invited_user?.id === invitation.invited_user?.id,
                )

                if (existingIndex !== -1) {
                    // Обновляем существующее приглашение
                    this.invitations.splice(existingIndex, 1, invitation)
                } else {
                    // Добавляем новое приглашение в начало списка
                    this.invitations.unshift(invitation)
                }

                // Показываем уведомление
                const fb = useFeedbackStore()
                fb.showToast({
                    type: 'info',
                    title: 'Новое приглашение',
                    message: `${invitation.created_by.first_name} ${invitation.created_by.last_name} пригласил вас в "${invitation.chat.title}"`,
                    time: 5000,
                })
            } catch (error) {
                // Игнорируем ошибки обработки приглашений
            }
        },

        // Отмечает сообщения в чате как прочитанные (только локально)
        async markChatAsRead(chatId: number, lastMessageId?: number): Promise<void> {
            try {
                // Обновляем локальное состояние
                const chatIndex = this.chats.findIndex((c) => c.id === chatId)
                if (chatIndex !== -1) {
                    const updatedChats = [...this.chats]
                    updatedChats[chatIndex] = {
                        ...updatedChats[chatIndex],
                        unread_count: 0,
                        ...(lastMessageId && { last_read_message_id: lastMessageId }),
                    }
                    this.chats = updatedChats

                    // Обновляем счетчик в заголовке после изменения счетчиков чатов
                    this.updateTitleUnreadCount()
                }

                // Если это текущий чат, обновляем флаги прочитанности сообщений
                if (this.currentChat?.id === chatId) {
                    this.messages.forEach((message) => {
                        if (!lastMessageId || message.id <= lastMessageId) {
                            message.is_read = true
                        }
                    })
                }
            } catch (error) {
                // Критическая ошибка в логике
            }
        },

        // Открывает чат: грузит сообщения, типы реакций и подписывается на realtime-канал
        async openChat(chat: IChat): Promise<void> {
            // Устанавливаем текущий чат сразу, чтобы UI не ломался
            this.currentChat = chat

            try {
                localStorage.setItem('selectedChatId', String(chat.id))
            } catch (e) {
                // Игнорируем ошибки localStorage в приватном режиме
            }

            try {
                // Загружаем типы реакций ДО загрузки сообщений
                if (!this.reactionTypes.length) {
                    await this.fetchReactionTypes()
                }
            } catch (error) {
                // Продолжаем работу с fallback типами
            }

            // Загружаем сообщения (ошибки обрабатываются внутри функции)
            await this.fetchMessages(chat.id)

            // Автоматически отмечаем чат как прочитанный при открытии
            if (this.messages.length > 0) {
                try {
                    const lastMessage = this.messages[this.messages.length - 1]
                    await this.markChatAsRead(chat.id, lastMessage.id)
                } catch (error) {
                    // Игнорируем ошибки отметки прочтения
                }
            } else {
                // Если нет сообщений, все равно отмечаем чат как прочитанный
                await this.markChatAsRead(chat.id)
            }
        },

        // Загружает сообщения выбранного чата с сортировкой по времени
        async fetchMessages(chatId: number): Promise<void> {
            try {
                const res = await axios.get(`${BASE_URL}/api/chat/chat/${chatId}/message/`)
                const list = (res.data?.results ?? res.data) as IMessage[]

                // Используйте правильное реактивное присваивание
                const sortedMessages = [...list].sort(compareMessagesAscending)
                this.messages.length = 0
                this.messages.push(...sortedMessages)
            } catch (error) {
                // При ошибке 404 или другой ошибке - очищаем сообщения
                this.messages.length = 0

                // Не выбрасываем ошибку дальше, чтобы не ломать UI
            }
        },

        // Отправляет текстовое сообщение в текущий чат
        async sendMessage(content: string): Promise<IMessage> {
            if (!this.currentChat) throw new Error('Нет выбранного чата')
            this.isSending = true
            try {
                const res = await axios.post(
                    `${BASE_URL}/api/chat/chat/${this.currentChat.id}/message/`,
                    { content },
                )
                const msg = res.data as IMessage

                // Добавляем сообщение сразу, если оно еще не пришло через WebSocket
                const exists = this.messages.some((m) => m.id === msg.id)
                if (!exists) {
                    this.messages.push(msg)
                    this.messages.sort(compareMessagesAscending)
                }

                // Обновляем последнее сообщение в текущем чате и поднимаем чат в топ
                if (this.currentChat) {
                    const chatIndex = this.chats.findIndex((c) => c.id === this.currentChat!.id)
                    if (chatIndex !== -1) {
                        const updatedChat = {
                            ...this.chats[chatIndex],
                            last_message: msg,
                            last_message_id: msg.id,
                        }
                        this.chats.splice(chatIndex, 1, updatedChat)

                        // Пересортируем чаты чтобы отправленное сообщение подняло чат в топ
                        this.chats = sortChatsByLastMessage(this.chats)
                    }
                }

                return msg
            } catch (error) {
                useFeedbackStore().showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: 'Не удалось отправить сообщение',
                    time: 7000,
                })
                throw error
            } finally {
                this.isSending = false
            }
        },

        // Обновляет сообщение
        async updateMessage(chatId: number, messageId: number, content: string): Promise<IMessage> {
            try {
                const res = await axios.patch(
                    `${BASE_URL}/api/chat/chat/${chatId}/message/${messageId}/`,
                    { content },
                )
                const updatedMessage = res.data as IMessage

                // Обновляем сообщение в локальном списке
                const messageIndex = this.messages.findIndex((m) => m.id === messageId)
                if (messageIndex !== -1) {
                    this.messages.splice(messageIndex, 1, updatedMessage)
                }

                useFeedbackStore().showToast({
                    type: 'success',
                    title: 'Обновлено',
                    message: 'Сообщение изменено',
                    time: 3000,
                })

                return updatedMessage
            } catch (error) {
                useFeedbackStore().showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: 'Не удалось изменить сообщение',
                    time: 7000,
                })
                throw error
            }
        },

        // Удаляет сообщение
        async deleteMessage(chatId: number, messageId: number): Promise<void> {
            try {
                await axios.delete(`${BASE_URL}/api/chat/chat/${chatId}/message/${messageId}/`)

                // Удаляем сообщение из локального списка
                this.messages = this.messages.filter((m) => m.id !== messageId)

                useFeedbackStore().showToast({
                    type: 'success',
                    title: 'Удалено',
                    message: 'Сообщение удалено',
                    time: 3000,
                })
            } catch (error) {
                useFeedbackStore().showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: 'Не удалось удалить сообщение',
                    time: 7000,
                })
                throw error
            }
        },

        // Получает список пользователей, которые прочитали сообщение
        async fetchMessageReaders(chatId: number, messageId: number): Promise<any[]> {
            try {
                const res = await axios.get(
                    `${BASE_URL}/api/chat/chat/${chatId}/message/${messageId}/readers/`,
                )
                return res.data?.results ?? res.data
            } catch (error) {
                return []
            }
        },

        // Загружает типы реакций
        async fetchReactionTypes(): Promise<void> {
            try {
                const res = await axios.get(`${BASE_URL}/api/chat/chat/reactions/types/`)
                this.reactionTypes = res.data as IReactionType[]
            } catch (error) {
                this.reactionTypes = [
                    { id: 1, name: 'Like', icon: '👍' },
                    { id: 2, name: 'Love', icon: '❤️' },
                    { id: 3, name: 'Laugh', icon: '😂' },
                    { id: 4, name: 'Wow', icon: '😮' },
                    { id: 5, name: 'Sad', icon: '😢' },
                    { id: 6, name: 'Angry', icon: '😠' },
                ] as IReactionType[]
            }
        },

        // Добавляет реакцию на сообщение
        async addReaction(messageId: number, reactionId: number): Promise<void> {
            if (!this.currentChat) return
            try {
                await axios.post(
                    `${BASE_URL}/api/chat/chat/${this.currentChat.id}/message/${messageId}/reactions/`,
                    {
                        reaction_type_id: reactionId,
                    },
                )
                // Убираем перезагрузку сообщений - реакции обновятся через WebSocket
            } catch (error) {
                // При ошибке все же перезагружаем для корректного состояния
                await this.fetchMessages(this.currentChat.id)
                throw error
            }
        },

        // Удаляет реакцию с сообщения
        async removeReaction(messageId: number): Promise<void> {
            if (!this.currentChat) return
            try {
                // ✅ Параметры не передаем - API автоматически удалит реакцию текущего пользователя
                await axios.delete(
                    `${BASE_URL}/api/chat/chat/${this.currentChat.id}/message/${messageId}/reactions/`,
                )
                // Убираем перезагрузку сообщений - реакции обновятся через WebSocket
            } catch (error) {
                // При ошибке все же перезагружаем для корректного состояния
                await this.fetchMessages(this.currentChat.id)
                throw error
            }
        },

        // Устанавливает эксклюзивную реакцию (удаляет старую и добавляет новую)
        async setExclusiveReaction(messageId: number, reactionId: number): Promise<void> {
            if (!this.currentChat) return
            try {
                // Сначала удаляем все мои реакции
                await this.clearMyReactions(messageId)
                // Затем добавляем новую
                await this.addReaction(messageId, reactionId)
            } catch (error) {
                throw error
            }
        },

        // Очищает все мои реакции с сообщения
        async clearMyReactions(messageId: number): Promise<void> {
            if (!this.currentChat) return
            try {
                // ✅ Используем тот же DELETE эндпоинт без параметров
                await axios.delete(
                    `${BASE_URL}/api/chat/chat/${this.currentChat.id}/message/${messageId}/reactions/`,
                )
                // Убираем перезагрузку сообщений - реакции обновятся через WebSocket
            } catch (error) {
                // Игнорируем ошибки при очистке (возможно реакции уже нет)
                // При ошибке все же перезагружаем для корректного состояния
                await this.fetchMessages(this.currentChat.id)
            }
        },

        // ============ ПРИГЛАШЕНИЯ В ЧАТЫ ============

        // Получает список приглашений в чаты
        async fetchInvitations(): Promise<void> {
            try {
                const res = await axios.get(`${BASE_URL}/api/chat/invite/`)
                const invitationsData = res.data?.results ?? res.data

                // Проверяем что получили массив и сохраняем в состояние
                if (Array.isArray(invitationsData)) {
                    // Получаем данные текущего пользователя
                    const userStore = useUserStore()
                    const currentUser = userStore.user

                    // Дополняем каждое приглашение полем invited_user если его нет
                    this.invitations = invitationsData.map((invitation) => {
                        // Если invited_user отсутствует, добавляем данные текущего пользователя
                        if (!invitation.invited_user && currentUser) {
                            return {
                                ...invitation,
                                invited_user: {
                                    id: currentUser.uuid || currentUser.id?.toString() || '',
                                    first_name: currentUser.first_name || '',
                                    last_name: currentUser.last_name || '',
                                    middle_name: currentUser.middle_name || '',
                                    phone_number: currentUser.phone_number || '',
                                    birth_date: currentUser.birth_date || null,
                                },
                            }
                        }
                        return invitation
                    })
                } else {
                    this.invitations = []
                }
            } catch (error) {
                // При ошибке устанавливаем пустой массив
                this.invitations = []
            }
        },

        // Приглашает участников в чат
        async inviteUsersToChat(chatId: number, userIds: string[]): Promise<void> {
            try {
                await axios.post(`${BASE_URL}/api/chat/invite/`, {
                    chat_id: chatId,
                    user_ids: userIds,
                })

                // Обновляем информацию о чате после приглашения
                const updatedChat = await this.fetchChat(chatId)
                const chatIndex = this.chats.findIndex((chat) => chat.id === chatId)
                if (chatIndex !== -1) {
                    this.chats.splice(chatIndex, 1, updatedChat)
                    // Пересортируем список после обновления
                    this.chats = sortChatsByLastMessage(this.chats)
                }

                // Обновляем текущий чат, если это он
                if (this.currentChat?.id === chatId) {
                    this.currentChat = updatedChat
                }

                useFeedbackStore().showToast({
                    type: 'success',
                    title: 'Успешно',
                    message: `Пользователи приглашены в чат`,
                    time: 3000,
                })
            } catch (error) {
                useFeedbackStore().showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: 'Не удалось пригласить пользователей',
                    time: 7000,
                })
                throw error
            }
        },

        // Принимает приглашение в чат
        async acceptInvitation(invitationId: number): Promise<void> {
            try {
                await axios.post(`${BASE_URL}/api/chat/invite/${invitationId}/accept/`)

                // Удаляем приглашение из списка
                this.invitations = this.invitations.filter((inv) => inv.id !== invitationId)

                // Обновляем список чатов после принятия приглашения
                await this.fetchChats()

                useFeedbackStore().showToast({
                    type: 'success',
                    title: 'Успешно',
                    message: 'Приглашение принято',
                    time: 3000,
                })
            } catch (error) {
                useFeedbackStore().showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: 'Не удалось принять приглашение',
                    time: 7000,
                })
                throw error
            }
        },

        // Отклоняет полученное приглашение
        async declineInvitation(invitationId: number): Promise<void> {
            try {
                // Используем правильный endpoint для отклонения приглашения
                await axios.delete(`${BASE_URL}/api/chat/invite/${invitationId}/decline/`)

                // Удаляем приглашение из списка
                this.invitations = this.invitations.filter((inv) => inv.id !== invitationId)

                useFeedbackStore().showToast({
                    type: 'info',
                    title: 'Отклонено',
                    message: 'Приглашение отклонено',
                    time: 3000,
                })
            } catch (error) {
                useFeedbackStore().showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: 'Не удалось отклонить приглашение',
                    time: 7000,
                })
                throw error
            }
        },

        // Удаляет отправленное приглашение
        async removeInvitation(invitationId: number): Promise<void> {
            try {
                await axios.delete(`${BASE_URL}/api/chat/invite/${invitationId}/remove/`)

                useFeedbackStore().showToast({
                    type: 'info',
                    title: 'Удалено',
                    message: 'Приглашение отозвано',
                    time: 3000,
                })
            } catch (error) {
                useFeedbackStore().showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: 'Не удалось отозвать приглашение',
                    time: 7000,
                })
                throw error
            }
        },

        // ============ ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ============

        // Загружает файл-вложение для указанного сообщения
        async uploadAttachment(messageId: number, file: File): Promise<void> {
            if (!this.currentChat) throw new Error('Нет выбранного чата')

            try {
                const form = new FormData()
                form.append('file', file)

                await axios.post(
                    `${BASE_URL}/api/chat/chat/${this.currentChat.id}/message/${messageId}/attachments/`,
                    form,
                    {
                        headers: { 'Content-Type': 'multipart/form-data' },
                    },
                )

                // Перезагружаем сообщения после загрузки вложения
                await this.fetchMessages(this.currentChat.id)

                useFeedbackStore().showToast({
                    type: 'success',
                    title: 'Загружено',
                    message: 'Файл успешно загружен',
                    time: 3000,
                })
            } catch (error) {
                useFeedbackStore().showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: 'Не удалось загрузить файл',
                    time: 7000,
                })
                throw error
            }
        },
    },

    getters: {
        // Общее количество непрочитанных сообщений
        totalUnreadCount: (state) =>
            state.chats.reduce((total, chat) => total + (chat.unread_count || 0), 0),

        // Количество непрочитанных сообщений в заголовке
        titleUnreadCount: () => globalUnreadMessages.unreadCount.value,

        // Текущий пользователь UUID/ID
        currentUserId(): string | null {
            const userStore = useUserStore()
            return userStore.user?.uuid || userStore.user?.id?.toString() || null
        },

        // Фильтрованные чаты по типу (с сохранением сортировки)
        chatsByType: (state) => (type: string) => {
            const filteredChats = (() => {
                if (type === 'all') return state.chats
                if (type === 'direct')
                    return state.chats.filter(
                        (chat) => chat.type === 'direct' || chat.type === 'dialog',
                    )
                return state.chats.filter((chat) => chat.type === type)
            })()

            // Возвращаем отфильтрованные чаты в том же порядке (уже отсортированные)
            return filteredChats
        },

        // Непрочитанные чаты (с сохранением сортировки)
        unreadChats: (state) => state.chats.filter((chat) => (chat.unread_count || 0) > 0),

        // Активные чаты (с недавней активностью, с сохранением сортировки)
        activeChats: (state) => state.chats.filter((chat) => chat.last_message_id),
    },
})

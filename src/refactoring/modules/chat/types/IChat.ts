export type ChatType = 'direct' | 'dialog' | 'group' | 'channel'

// Типы для пользователя (обновлено под новый API)
export interface IUser {
    id: string
    first_name: string
    last_name: string
    middle_name?: string
    phone_number?: string
    birth_date?: string | null
    // Данные о должности и подразделении
    position?: {
        id: string
        name: string
    }
    department?: {
        id: string
        name: string
    }
    // Поле для аватарки
    avatar?: string | null
    // Дополнительные поля для совместимости со старой системой
    uuid?: string
    full_name?: string
    user_name?: string
    username?: string
    email?: string
}

// Медиа-запросы
export interface MediaQueryMethods {
    addEventListener?(type: string, listener: () => void): void
    removeEventListener?(type: string, listener: () => void): void
    addListener?(listener: () => void): void
    removeListener?(listener: () => void): void
}

// Обновленная структура участника чата
export interface IChatMember {
    user: IUser // Теперь полный объект пользователя, а не просто ID
    is_admin: boolean
    joined_at: string
    // Поля для обратной совместимости (будем заполнять из user)
    user_uuid?: string
    user_name?: string
}

// Структура приглашения в чат
export interface IChatInvite {
    id: number
    invited_user: IUser
    is_accepted: boolean
}

// Обновленная структура чата
export interface IChat {
    id: number
    type: ChatType
    title: string
    description: string
    icon: string | null
    members: IChatMember[] // Теперь с полными объектами пользователей
    invites: IChatInvite[] // Новое поле - список приглашений
    created_by: IUser // Новое поле - создатель чата

    // Поля для совместимости и дополнительной функциональности
    owner?: string // Может быть заполнено из created_by.id
    created_at?: string
    unread_count?: number
    last_message_id?: number
    last_read_message_id?: number
    last_message?: IMessage
    last_activity_time?: string
}

export interface IEmployee {
    id: string
    full_name: string
    email: string | null
    department: {
        id: string
        name: string
    } | null
    position: string | null
    can_create_dialog: boolean
}

export interface ISearchResults {
    chats: IChat[]
    new_dialogs: IEmployee[]
}

export interface IMessageAttachment {
    id: number
    file: string
}

export interface IMessage {
    id: number
    content: string
    author: string
    author_id?: string | number
    author_name?: string
    user_id?: string | number
    name?: string
    created_by?: {
        id: string
        first_name?: string
        last_name?: string
        full_name?: string
        user_name?: string
        username?: string
        email?: string
    }
    attachments: IMessageAttachment[]
    created_at: string
    updated_at?: string
    reaction_updated_at?: string
    reactions?: IMessageReaction[]
    message_reactions?: IMessageReaction[]
    is_read?: boolean
}

export interface IMessageReaction {
    id: number
    reaction_type: number
    user: string
    user_name?: string
    created_at: string
}

export interface IReactionType {
    id: number
    name: string
    icon: string | null
}

// Обновленный интерфейс приглашений (глобальные приглашения)
export interface IChatInvitation {
    id: number | null
    chat: IChat
    created_by: IUser
    invited_user?: IUser
    is_accepted: boolean
    created_at?: string
}

export interface IChatStoreState {
    chats: IChat[]
    currentChat: IChat | null
    messages: IMessage[]
    reactionTypes: IReactionType[]
    isSending: boolean
    searchResults: ISearchResults | null
    isSearching: boolean
    isInitialized: boolean
    isInitializing: boolean
    invitations: IChatInvitation[]
    isLoadingMessages: boolean
    isLoadingChats: boolean
}

// Улучшенные типы для реакций
export interface ReactionUser {
    id: string | number
    name: string
    avatar?: string | null
}

export interface ReactionGroup {
    key: string
    emoji: string
    users: ReactionUser[]
    tooltip: string
    isThumb?: boolean
}

export interface OptimisticReaction {
    id: string
    name: string
    icon: string | null
    user: ReactionUser
}

// Типы для PhotoSwipe
export interface PhotoSwipeInstance {
    init(): void
    destroy(): void
}

export interface PhotoSwipeOptions {
    gallery: string
    children: string
    pswpModule?: () => Promise<any>
}

// Расширение window для PhotoSwipe
declare global {
    interface Window {
        __chatPswp?: PhotoSwipeInstance | null
    }
}

// Фильтры чатов
export type ChatFilterType = 'all' | 'direct' | 'dialog' | 'group' | 'channel'

export interface ChatFilter {
    readonly value: ChatFilterType
    readonly label: string
}

// Мобильные состояния
export type MobileViewType = 'list' | 'chat'

// Утилитарные функции для работы с новой структурой
export class ChatAdapter {
    /**
     * Конвертирует новую структуру чата в формат, совместимый со старым кодом
     */
    static adaptChat(chat: IChat): IChat {
        return {
            ...chat,
            owner: chat.created_by?.id || chat.owner,
            // Добавляем поля для обратной совместимости в members
            members:
                chat.members?.map((member) => ({
                    ...member,
                    user_uuid: member.user?.id,
                    user_name: ChatAdapter.getFullUserName(member.user),
                    // Сохраняем старые поля для совместимости
                    user: member.user?.id || (member as any).user,
                })) || [],
        }
    }

    /**
     * Получает полное имя пользователя
     */
    static getFullUserName(user: IUser): string {
        if (!user) return 'Неизвестный пользователь'

        // Если есть готовое полное имя
        if (user.full_name) return user.full_name

        // Составляем из частей
        const parts = [user.first_name, user.middle_name, user.last_name].filter(Boolean)

        return parts.length > 0
            ? parts.join(' ')
            : user.user_name || user.username || user.email || 'Неизвестный пользователь'
    }

    /**
     * Получает отображаемое имя пользователя для чата
     */
    static getChatDisplayName(user: IUser): string {
        // Для чата обычно используем Имя + Фамилия
        const firstName = user.first_name?.trim()
        const lastName = user.last_name?.trim()

        if (firstName && lastName) {
            return `${firstName} ${lastName}`
        }

        return ChatAdapter.getFullUserName(user)
    }

    /**
     * Проверяет, является ли пользователь администратором чата
     */
    static isUserAdmin(chat: IChat, userId: string): boolean {
        return (
            chat.members?.some((member) => member.user?.id === userId && member.is_admin) || false
        )
    }

    /**
     * Получает собеседника в диалоге
     */
    static getDialogCompanion(chat: IChat, currentUserId: string): IChatMember | null {
        if (chat.type !== 'dialog' && chat.type !== 'direct') {
            return null
        }

        return chat.members?.find((member) => member.user?.id !== currentUserId) || null
    }
}

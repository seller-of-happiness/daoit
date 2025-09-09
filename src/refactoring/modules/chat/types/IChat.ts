export type ChatType = 'direct' | 'dialog' | 'group' | 'channel'

// Типы для пользователя
export interface IUser {
    id: string | number
    uuid?: string
    full_name?: string
    first_name?: string
    last_name?: string
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

export interface IChatMember {
    user: string
    user_uuid?: string
    user_name: string
    is_admin: boolean
    joined_at: string
}

export interface IChat {
    id: number
    type: ChatType
    title: string
    description: string
    icon: string | null
    owner: string
    members: IChatMember[]
    created_at: string
    unread_count?: number
    last_message_id?: number
    last_read_message_id?: number
    last_message?: IMessage
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

export interface IChatStoreState {
    chats: IChat[]
    currentChat: IChat | null
    messages: IMessage[]
    reactionTypes: IReactionType[]
    isSending: boolean
    searchResults: ISearchResults | null
    isSearching: boolean
    // Флаги для предотвращения дублирования инициализации
    isInitialized: boolean
    isInitializing: boolean
    // Debounce для перезагрузки сообщений при реакциях
    reactionReloadTimeout: number | null
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

// Типы для эмодзи пикера
export interface EmojiGroupNames {
    readonly smileys_people: string
    readonly animals_nature: string
    readonly food_drink: string
    readonly activities: string
    readonly travel_places: string
    readonly objects: string
    readonly symbols: string
    readonly flags: string
}

export interface EmojiStaticTexts {
    readonly placeholder: string
    readonly skinTone: string
}

// Фильтры чатов
export type ChatFilterType = 'all' | 'direct' | 'dialog' | 'group' | 'channel'

export interface ChatFilter {
    readonly value: ChatFilterType
    readonly label: string
}

// Мобильные состояния
export type MobileViewType = 'list' | 'chat'

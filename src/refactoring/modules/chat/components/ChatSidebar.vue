<template>
    <aside class="w-full md:max-w-sm xl:max-w-md card p-0 overflow-hidden" :class="mobileClass">
        <!-- Поиск -->
        <div
            class="py-4 border-b border-surface-200 dark:border-surface-800 flex items-center gap-2"
        >
            <app-inputtext
                v-model="searchQuery"
                class="w-full"
                placeholder="Поиск чатов и сотрудников"
                @input="onSearchInput"
                @keyup.enter="onSearchSubmit"
            />
            <nav class="flex gap-2">
                <Button
                    class="aside-btn"
                    icon="pi pi-search"
                    severity="secondary"
                    text
                    rounded
                    v-tooltip.bottom="'Поиск чатов и сотрудников'"
                    @click="onSearchSubmit"
                />
                <Button
                    class="aside-btn"
                    icon="pi pi-plus"
                    severity="success"
                    text
                    rounded
                    v-tooltip.bottom="'Создать группу или канал'"
                    @click="$emit('create-chat')"
                />
            </nav>
        </div>

        <!-- Фильтры типов чатов -->
        <div class="flex gap-2 px-3 py-2 border-b border-surface-200 dark:border-surface-800">
            <Button
                v-for="filter in chatFilters"
                :key="filter.value"
                size="small"
                :text="activeFilter !== filter.value"
                :label="filter.label"
                @click="activeFilter = filter.value"
            />
        </div>

        <!-- Результаты поиска -->
        <div
            v-if="searchResults && searchQuery.trim()"
            class="search-results p-3 border-b border-surface-200 dark:border-surface-800"
        >
            <div v-if="isSearching" class="text-center py-4">
                <i class="pi pi-spin pi-spinner"></i> Поиск...
            </div>

            <!-- Найденные чаты (в которых пользователь состоит) -->
            <div v-if="foundChats.length > 0" class="mb-4">
                <h4 class="text-sm font-semibold text-surface-600 mb-2">Мои чаты:</h4>
                <ChatListItem
                    v-for="chat in foundChats"
                    :key="chat.id"
                    :chat="chat"
                    :is-active="currentChatId === chat.id"
                    @select="$emit('select-chat', chat)"
                />
            </div>

            <!-- Публичные каналы для присоединения -->
            <div v-if="publicChats.length > 0" class="mb-4">
                <h4 class="text-sm font-semibold text-surface-600 mb-2">
                    Присоединиться к каналу:
                </h4>
                <div
                    v-for="chat in publicChats"
                    :key="`public-${chat.id}`"
                    class="chat-item public-chat"
                >
                    <div v-if="chat.icon" class="chat-icon">
                        <img :src="withBase(chat.icon)" alt="icon" />
                    </div>
                    <div v-else class="chat-icon-initials">
                        {{ getChatInitials(chat) }}
                    </div>

                    <div class="flex-1 min-w-0">
                        <div class="chat-title">{{ chat.title }}</div>
                        <div class="chat-sub">{{ chat.description }}</div>
                    </div>

                    <!-- Join functionality removed - use invitations instead -->
                </div>
            </div>

            <!-- Создание новых диалогов -->
            <div v-if="newDialogEmployees.length > 0" class="mb-4">
                <h4 class="text-sm font-semibold text-surface-600 mb-2">Создать диалог с:</h4>
                <EmployeeListItem
                    v-for="employee in newDialogEmployees"
                    :key="employee.id"
                    :employee="employee"
                    @create-dialog="handleCreateDialog(employee)"
                />
            </div>

            <div
                v-if="
                    !isSearching &&
                    foundChats.length === 0 &&
                    publicChats.length === 0 &&
                    newDialogEmployees.length === 0 &&
                    searchQuery.trim()
                "
                class="text-center py-4 text-surface-500"
            >
                <div class="mb-2">Ничего не найдено</div>
                <div class="text-xs">Введите имя сотрудника для создания диалога</div>
            </div>
        </div>

        <!-- Список чатов -->
        <div v-else class="chat-list">
            <!-- Показываем скелетоны во время загрузки -->
            <template v-if="isLoadingChats">
                <ChatListSkeletonGroup :count="8" />
            </template>
            
            <!-- Показываем реальные чаты после загрузки -->
            <template v-else>
                <!-- Приглашения в чаты -->
                <div v-if="invitations.length > 0" class="invitations-section">
                    <div class="section-header">
                        <h4 class="section-title">
                            <i class="pi pi-bell mr-2"></i>
                            Приглашения ({{ invitations.length }})
                        </h4>
                    </div>
                    <InvitationListItem
                        v-for="invitation in invitations"
                        :key="`invitation-${invitation.chat.id}-${invitation.invited_user?.id || invitation.id}`"
                        :invitation="invitation"
                        @accept="$emit('accept-invitation', invitation)"
                        @decline="$emit('decline-invitation', invitation)"
                    />
                </div>

                <!-- Обычные чаты -->
                <div v-if="filteredChats.length > 0" class="chats-section">
                    <div v-if="invitations.length > 0" class="section-header">
                        <h4 class="section-title">
                            <i class="pi pi-comments mr-2"></i>
                            Чаты
                        </h4>
                    </div>
                    <ChatListItem
                        v-for="chat in filteredChats"
                        :key="chat.id"
                        :chat="chat"
                        :is-active="currentChatId === chat.id"
                        @select="$emit('select-chat', chat)"
                    />
                </div>

                <!-- Подсказка для пустого списка -->
                <div v-if="filteredChats.length === 0 && invitations.length === 0" class="text-center py-8 text-surface-500">
                    <div class="mb-2">
                        <i class="pi pi-comments text-4xl mb-4 block"></i>
                    </div>
                    <div class="mb-2 font-semibold">Нет чатов</div>
                    <div class="text-xs space-y-1">
                        <div>
                            • Нажмите <i class="pi pi-plus text-green-500"></i> чтобы создать
                            группу/канал
                        </div>
                        <div>• Найдите сотрудника в поиске для диалога</div>
                    </div>
                </div>
            </template>
        </div>
    </aside>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { generateChatInitials, withBase } from '@/refactoring/modules/chat/utils/chatHelpers'
import ChatListItem from './ChatListItem.vue'
import EmployeeListItem from './EmployeeListItem.vue'
import InvitationListItem from './InvitationListItem.vue'
import ChatListSkeletonGroup from './ChatListSkeletonGroup.vue'
import type { IChat, IEmployee, ISearchResults, IChatInvitation } from '@/refactoring/modules/chat/types/IChat'

interface Props {
    chats: IChat[]
    currentChatId: number | null
    searchResults: ISearchResults | null
    isSearching: boolean
    isLoadingChats?: boolean
    mobileClass?: string[]
    invitations: IChatInvitation[]
}

interface Emits {
    (e: 'select-chat', chat: IChat): void
    (e: 'create-chat'): void
    (e: 'create-dialog', employee: IEmployee): void
    (e: 'search', query: string): void
    (e: 'clear-search'): void
    (e: 'join-public-chat', chat: IChat): void
    (e: 'accept-invitation', invitation: IChatInvitation): void
    (e: 'decline-invitation', invitation: IChatInvitation): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Состояние компонента
const searchQuery = ref('')
const activeFilter = ref<'all' | 'direct' | 'group' | 'channel'>('all')

// Конфигурация фильтров
const chatFilters = [
    { value: 'all', label: 'Все' },
    { value: 'direct', label: 'Личные' },
    { value: 'group', label: 'Группы' },
    { value: 'channel', label: 'Каналы' },
] as const

// Вычисляемые свойства
const filteredChats = computed(() => {
    return props.chats.filter((chat) => {
        // Фильтр по типу
        if (activeFilter.value !== 'all') {
            // Для фильтра "direct" показываем как 'direct', так и 'dialog' чаты
            if (activeFilter.value === 'direct') {
                if (chat.type !== 'direct' && chat.type !== 'dialog') {
                    return false
                }
            } else if (chat.type !== activeFilter.value) {
                return false
            }
        }

        // Фильтр по поисковому запросу (локальный поиск)
        const query = searchQuery.value.trim().toLowerCase()
        if (!query) return true

        return (
            chat.title?.toLowerCase().includes(query) ||
            chat.description?.toLowerCase().includes(query) ||
            ((chat.type === 'direct' || chat.type === 'dialog') &&
                chat.members.some((member) => member.user_name?.toLowerCase().includes(query)))
        )
    })
})

const foundChats = computed(() => {
    if (!props.searchResults) return []

    // Показываем только те чаты, в которых пользователь уже состоит
    const userChats = props.chats.map((c) => c.id)

    const result = props.searchResults.chats.filter((chat) => {
        const typeMatch = activeFilter.value === 'all' || chat.type === activeFilter.value
        const isMember = userChats.includes(chat.id)
        return typeMatch && isMember
    })


    return result
})

const publicChats = computed(() => {
    if (!props.searchResults) return []

    // Показываем только публичные каналы, в которых пользователь НЕ состоит
    const userChats = props.chats.map((c) => c.id)

    const result = props.searchResults.chats.filter((chat) => {
        const typeMatch = activeFilter.value === 'all' || chat.type === activeFilter.value
        const isNotMember = !userChats.includes(chat.id)
        const isPublic = chat.type === 'channel' || chat.type === 'group'
        return typeMatch && isNotMember && isPublic
    })

    return result
})

const newDialogEmployees = computed(() => {
    return props.searchResults?.new_dialogs || []
})

// Обработчики событий
const onSearchInput = () => {
    // Реактивный поиск может быть добавлен здесь
}

const onSearchSubmit = () => {
    if (searchQuery.value.trim()) {
        emit('search', searchQuery.value.trim())
    }
}

const clearSearch = () => {
    searchQuery.value = ''
    emit('clear-search')
}

const handleCreateDialog = (employee: IEmployee) => {
    emit('create-dialog', employee)
    // Сбрасываем поиск после создания диалога
    clearSearch()
}

// Получение инициалов для иконки чата
const getChatInitials = (chat: IChat) => {
    return generateChatInitials(chat.title)
}

// Удалена функция joinPublicChat - используйте приглашения

// Реактивный поиск с задержкой
let searchDebounceId: number | null = null
watch(
    () => searchQuery.value,
    (newQuery) => {
        if (searchDebounceId) {
            window.clearTimeout(searchDebounceId)
            searchDebounceId = null
        }

        const query = newQuery.trim()
        if (!query) {
            return
        }

        searchDebounceId = window.setTimeout(() => {
            emit('search', query)
        }, 300)
    },
)
</script>

<style scoped>
/* Секции */
.invitations-section,
.chats-section {
    border-bottom: 1px solid var(--p-content-border-color);
}

.section-header {
    padding: 8px 14px;
    background: var(--p-surface-100);
    border-bottom: 1px solid var(--p-content-border-color);
}

.section-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--p-surface-700);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 0;
    display: flex;
    align-items: center;
}

/* Стили для публичных каналов */
.public-chat {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--p-content-border-color);
    min-height: 64px;
    transition: background-color 0.2s;
}

.public-chat:hover {
    background: var(--p-content-hover-background);
}

.public-chat .chat-icon {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    object-fit: cover;
    background: var(--p-surface-200);
    flex-shrink: 0;
}

.public-chat .chat-icon img {
    width: 100%;
    height: 100%;
    border-radius: 8px;
    object-fit: cover;
}

.public-chat .chat-icon-initials {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: var(--p-surface-200);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--p-surface-600);
    font-size: 14px;
    font-weight: 600;
    flex-shrink: 0;
}

.public-chat .chat-title {
    font-weight: 600;
    color: var(--text-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.public-chat .chat-sub {
    color: var(--text-secondary-color);
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
</style>

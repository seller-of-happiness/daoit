<template>
    <Dialog
        :visible="visible"
        :header="`Пригласить пользователей в ${chatTitle}`"
        :modal="true"
        :style="{ width: '600px', maxHeight: '80vh' }"
        :appendTo="'body'"
        :baseZIndex="9995"
        class="sliding-chat-modal"
        @update:visible="$emit('update:visible', $event)"
    >
        <div class="space-y-4">
            <!-- Информация о чате -->
            <div v-if="props.chat" class="chat-info-section">
                <div class="flex items-center gap-3 p-3 bg-surface-50 rounded-lg">
                    <img
                        v-if="props.chat.icon"
                        :src="withBase(props.chat.icon)"
                        alt="icon"
                        class="chat-icon-small"
                    />
                    <div v-else class="chat-icon-initials-small">
                        {{ getChatInitials() }}
                    </div>
                    <div>
                        <div class="font-semibold">{{ chatTitle }}</div>
                        <div class="text-sm text-surface-600">
                            {{ getReadableChatType(props.chat.type) }} •
                            {{ currentMemberCount }} участников
                        </div>
                    </div>
                </div>
            </div>

            <!-- Поиск пользователей -->
            <div>
                <div class="label">
                    Поиск пользователей
                    <span
                        v-if="
                            searchQuery.trim() && !isSearching && filteredAvailableUsers.length > 0
                        "
                        class="result-count"
                    >
                        (найдено: {{ filteredAvailableUsers.length }})
                    </span>
                </div>
                <app-inputtext
                    v-model="searchQuery"
                    placeholder="Введите имя, email, должность или отделение..."
                    class="w-full"
                    @input="onSearchInput"
                />
            </div>

            <!-- Область результатов поиска с фиксированной высотой -->
            <div class="user-search-results">
                <div class="search-results-container">
                    <div v-if="!searchQuery.trim()" class="text-center py-8 text-surface-400">
                        <i class="pi pi-search text-2xl mb-2"></i>
                        <div>Введите имя для поиска пользователей</div>
                    </div>

                    <div v-else-if="isSearching" class="text-center py-8">
                        <i class="pi pi-spin pi-spinner text-xl"></i>
                        <div class="mt-2">Поиск...</div>
                    </div>

                    <div
                        v-else-if="filteredAvailableUsers.length === 0"
                        class="text-center py-8 text-surface-500"
                    >
                        <i class="pi pi-users text-2xl mb-2"></i>
                        <div>Пользователи не найдены</div>
                    </div>

                    <div v-else class="user-list">
                        <div
                            v-for="user in filteredAvailableUsers"
                            :key="user.id"
                            class="user-item"
                            @click="toggleUserSelection(user)"
                        >
                            <div class="user-avatar">
                                <i class="pi pi-user"></i>
                            </div>

                            <div class="flex-1 min-w-0">
                                <div class="user-name">{{ user.full_name }}</div>
                                <div class="user-info">
                                    <span v-if="user.position" class="position">
                                        {{ user.position }}
                                    </span>
                                    <span v-if="user.department" class="department">
                                        {{ user.department.name }}
                                    </span>
                                    <span v-if="user.email" class="email">
                                        {{ user.email }}
                                    </span>
                                </div>
                            </div>

                            <Button
                                :icon="isUserSelected(user) ? 'pi pi-check' : 'pi pi-plus'"
                                :severity="isUserSelected(user) ? 'success' : 'secondary'"
                                size="small"
                                text
                                rounded
                            />
                        </div>
                    </div>
                </div>
            </div>

            <!-- Текущие участники чата (для справки) -->
            <div v-if="currentMembers.length > 0" class="current-members-section">
                <div class="label">Текущие участники ({{ currentMembers.length }})</div>
                <div class="members-list">
                    <div
                        v-for="member in currentMembers.slice(0, 5)"
                        :key="member.user.id"
                        class="member-chip"
                    >
                        <div class="member-avatar">
                            <i class="pi pi-user"></i>
                        </div>
                        <span class="member-name">{{ getMemberDisplayName(member) }}</span>
                        <i
                            v-if="member.is_admin"
                            class="pi pi-crown admin-icon"
                            title="Администратор"
                        ></i>
                    </div>
                    <div v-if="currentMembers.length > 5" class="text-sm text-surface-500">
                        и ещё {{ currentMembers.length - 5 }} участников...
                    </div>
                </div>
            </div>

            <!-- Выбранные пользователи -->
            <div v-if="selectedUsers.length > 0" class="selected-users">
                <div class="label">Выбранные пользователи ({{ selectedUsers.length }})</div>
                <div class="selected-users-list">
                    <div v-for="user in selectedUsers" :key="user.id" class="selected-user-chip">
                        <span>{{ user.full_name }}</span>
                        <Button
                            icon="pi pi-times"
                            size="small"
                            text
                            rounded
                            class="remove-user-btn"
                            @click="removeUserFromSelection(user)"
                        />
                    </div>
                </div>
            </div>

            <!-- Кнопки -->
            <div class="flex justify-end gap-2 pt-4">
                <Button label="Отмена" severity="secondary" text @click="closeDialog" />
                <Button
                    label="Пригласить"
                    :disabled="selectedUsers.length === 0 || isInviting"
                    :loading="isInviting"
                    @click="inviteUsers"
                />
            </div>
        </div>
    </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { debounce } from 'lodash-es'
import { useChatStore } from '@/refactoring/modules/chat/stores/chatStore'
import { useApiStore } from '@/refactoring/modules/apiStore/stores/apiStore'
import {
    generateChatInitials,
    withBase,
    getReadableChatType,
} from '@/refactoring/modules/chat/utils/chatHelpers'
import { ChatAdapter } from '@/refactoring/modules/chat/types/IChat'
import type { IChat, IEmployee, IChatMember } from '@/refactoring/modules/chat/types/IChat'

interface Props {
    visible: boolean
    chat: IChat | null
}

interface Emits {
    (e: 'update:visible', visible: boolean): void
    (e: 'invite-users', userIds: string[]): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Хранилища
const chatStore = useChatStore()
const apiStore = useApiStore()

// Состояние компонента
const searchQuery = ref('')
const availableUsers = ref<IEmployee[]>([])
const selectedUsers = ref<IEmployee[]>([])
const isSearching = ref(false)
const isInviting = ref(false)

// Вычисляемые свойства
const chatTitle = computed(() => {
    if (!props.chat) return ''
    return props.chat.title || `Чат #${props.chat.id}`
})

// Получаем текущих участников чата
const currentMembers = computed<IChatMember[]>(() => {
    if (!props.chat || !props.chat.members) return []
    return props.chat.members
})

// Количество текущих участников
const currentMemberCount = computed(() => {
    return currentMembers.value.length
})

// Проверка, выбран ли пользователь
const isUserSelected = (user: IEmployee) => {
    return selectedUsers.value.some((selected) => selected.id === user.id)
}

// Фильтруем пользователей, которые уже есть в чате (используем новую структуру)
const filteredAvailableUsers = computed(() => {
    if (!props.chat || !props.chat.members) return availableUsers.value

    // Получаем список ID участников чата из новой структуры
    const existingMemberIds = props.chat.members.map((member) => member.user.id)

    // Исключаем пользователей, которые уже есть в чате
    return availableUsers.value.filter((user) => !existingMemberIds.includes(user.id))
})

// Получаем инициалы чата
const getChatInitials = () => {
    if (!props.chat) return ''
    return generateChatInitials(props.chat.title)
}

// Получаем отображаемое имя участника
const getMemberDisplayName = (member: IChatMember): string => {
    return ChatAdapter.getChatDisplayName(member.user)
}

// Обработчики событий
const toggleUserSelection = (user: IEmployee) => {
    const index = selectedUsers.value.findIndex((selected) => selected.id === user.id)
    if (index >= 0) {
        selectedUsers.value.splice(index, 1)
    } else {
        selectedUsers.value.push(user)
    }
}

const removeUserFromSelection = (user: IEmployee) => {
    const index = selectedUsers.value.findIndex((selected) => selected.id === user.id)
    if (index >= 0) {
        selectedUsers.value.splice(index, 1)
    }
}

// Функция поиска по локальным данным сотрудников
const searchLocalEmployees = (query: string): IEmployee[] => {
    if (!query.trim()) return []

    const searchTerm = query.toLowerCase().trim()

    // Преобразуем сотрудников из хранилища API в формат IEmployee для чата
    return apiStore.employees
        .filter((employee) => {
            // Формируем полное имя для поиска
            const fullName =
                `${employee.first_name} ${employee.middle_name || ''} ${employee.last_name}`.toLowerCase()
            const email = employee.email?.toLowerCase() || ''
            const position = employee.position?.name?.toLowerCase() || ''
            const department = employee.department?.name?.toLowerCase() || ''

            // Поиск по имени, электронной почте, должности или отделению
            return (
                fullName.includes(searchTerm) ||
                email.includes(searchTerm) ||
                position.includes(searchTerm) ||
                department.includes(searchTerm)
            )
        })
        .map((employee) => ({
            id: employee.id,
            full_name:
                `${employee.first_name} ${employee.middle_name || ''} ${employee.last_name}`.trim(),
            email: employee.email,
            department: employee.department
                ? {
                      id: employee.department.id,
                      name: employee.department.name,
                  }
                : null,
            position: employee.position?.name || null,
            can_create_dialog: true, // Предполагаем что все сотрудники могут создавать диалоги
        }))
        .slice(0, 50) // Ограничиваем количество результатов для производительности
}

// Поиск пользователей с задержкой - теперь использует локальные данные
const debouncedSearch = debounce(async (query: string) => {
    if (!query.trim()) {
        availableUsers.value = []
        return
    }

    isSearching.value = true
    try {
        // Проверяем, загружены ли данные сотрудников
        if (apiStore.employees.length === 0) {
            await apiStore.fetchAllEmployees()
        }

        // Используем локальный поиск вместо запроса к серверу
        availableUsers.value = searchLocalEmployees(query)
    } catch (error) {
        // Ошибка поиска пользователей
        availableUsers.value = []

        // Если локальный поиск не удался, можно использовать резервный серверный поиск
        try {
            const results = await chatStore.searchChats(query)
            availableUsers.value = results.new_dialogs || []
        } catch (fallbackError) {
            // Ошибка резервного поиска
        }
    } finally {
        isSearching.value = false
    }
}, 100) // Уменьшили время задержки, так как поиск теперь локальный

const onSearchInput = () => {
    debouncedSearch(searchQuery.value)
}

const inviteUsers = async () => {
    if (selectedUsers.value.length === 0) return

    isInviting.value = true
    try {
        const userIds = selectedUsers.value.map((user) => user.id)
        emit('invite-users', userIds)
        closeDialog()
    } catch (error) {
        // Ошибка приглашения пользователей
    } finally {
        isInviting.value = false
    }
}

const closeDialog = () => {
    emit('update:visible', false)
    resetForm()
}

const resetForm = () => {
    searchQuery.value = ''
    availableUsers.value = []
    selectedUsers.value = []
    isSearching.value = false
    isInviting.value = false
}

// Сброс формы при закрытии диалога и предзагрузка данных при открытии
watch(
    () => props.visible,
    async (visible) => {
        if (!visible) {
            resetForm()
        } else {
            // Предварительно загружаем данные сотрудников при открытии диалога
            if (apiStore.employees.length === 0) {
                try {
                    await apiStore.fetchAllEmployees()
                } catch (error) {
                    // Не удалось предварительно загрузить данные сотрудников
                }
            }
        }
    },
)
</script>

<style scoped>
.chat-info-section {
    margin-bottom: 1rem;
}

.chat-icon-small {
    width: 2rem;
    height: 2rem;
    border-radius: 6px;
    object-fit: cover;
}

.chat-icon-initials-small {
    width: 2rem;
    height: 2rem;
    border-radius: 6px;
    background-color: var(--surface-200);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--surface-600);
    font-size: 0.75rem;
    font-weight: 600;
}

.current-members-section {
    border-top: 1px solid var(--surface-border);
    padding-top: 1rem;
}

.members-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    max-height: 100px;
    overflow-y: auto;
}

.member-chip {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background-color: var(--surface-100);
    border: 1px solid var(--surface-border);
    padding: 0.25rem 0.5rem;
    border-radius: 1rem;
    font-size: 0.75rem;
}

.member-avatar {
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 50%;
    background-color: var(--surface-200);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--surface-600);
    font-size: 0.625rem;
}

.member-name {
    font-weight: 500;
}

.admin-icon {
    color: var(--yellow-500);
    font-size: 0.75rem;
}

.user-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    cursor: pointer;
    border-radius: 0.5rem;
    transition: background-color 0.2s;
    border-bottom: 1px solid var(--surface-border);
}

.user-item:hover {
    background-color: var(--surface-100);
}

.user-item:last-child {
    border-bottom: none;
}

.user-avatar {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    background-color: var(--surface-200);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-color-secondary);
    flex-shrink: 0;
}

.user-name {
    font-weight: 500;
    color: var(--text-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.user-info {
    font-size: 0.875rem;
    color: var(--text-color-secondary);
    display: flex;
    flex-direction: column;
}

.position,
.department,
.email {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.email {
    font-style: italic;
    opacity: 0.8;
}

.selected-users-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    max-height: 120px;
    overflow-y: auto;
}

.selected-user-chip {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background-color: var(--primary-100);
    color: var(--primary-700);
    padding: 0.375rem 0.75rem;
    border-radius: 1rem;
    font-size: 0.875rem;
    border: 1px solid var(--primary-200);
}

.remove-user-btn {
    width: 1.25rem !important;
    height: 1.25rem !important;
    min-width: 1.25rem !important;
    color: var(--primary-600) !important;
}

.space-y-4 > * + * {
    margin-top: 1rem;
}

.user-search-results {
    border: 1px solid var(--surface-border);
    border-radius: 0.5rem;
    background: var(--surface-0);
}

.search-results-container {
    height: 300px;
    display: flex;
    flex-direction: column;
}

.user-list {
    flex: 1;
    overflow-y: auto;
    padding: 0.25rem 0;
}

/* Улучшение состояний поиска */
.search-results-container > div:first-child {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

/* Стили для иконок состояний */
.text-2xl {
    font-size: 1.5rem;
    color: var(--text-color-secondary);
}

.text-xl {
    font-size: 1.25rem;
}

.mb-2 {
    margin-bottom: 0.5rem;
}

.mt-2 {
    margin-top: 0.5rem;
}

.result-count {
    font-size: 0.875rem;
    color: var(--text-color-secondary);
    font-weight: normal;
}
</style>

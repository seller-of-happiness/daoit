<template>
    <Dialog
        :visible="visible"
        header="Управление"
        :modal="true"
        :style="{ width: '700px', maxHeight: '80vh' }"
        :appendTo="'body'"
        :baseZIndex="9995"
        class="sliding-chat-modal"
        @update:visible="$emit('update:visible', $event)"
    >
        <div class="space-y-4">
            <!-- Информация о чате -->
            <div v-if="chat" class="chat-info bg-surface-50 dark:bg-surface-800 p-4 rounded-lg">
                <div class="flex items-center gap-3">
                    <img v-if="chat.icon" :src="withBase(chat.icon)" alt="icon" class="chat-icon" />
                    <div v-else class="chat-icon-initials">
                        {{ chatInitials }}
                    </div>
                    <div>
                        <h3 class="font-semibold text-lg">{{ chat.title }}</h3>
                        <p class="text-sm text-surface-600 dark:text-surface-400">
                            {{ chatTypeLabel }} • {{ totalMembers }} участников
                        </p>
                    </div>
                </div>
            </div>

            <!-- Вкладки -->
            <div class="flex border-b border-surface-200 dark:border-surface-800">
                <button
                    v-for="tab in tabs"
                    :key="tab.key"
                    :class="[
                        'px-4 py-2 font-medium text-sm border-b-2 transition-colors',
                        activeTab === tab.key
                            ? 'border-primary-500 text-primary-500'
                            : 'border-transparent text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100',
                    ]"
                    @click="activeTab = tab.key"
                >
                    {{ tab.label }}
                    <span v-if="tab.count !== undefined" class="ml-1 text-xs opacity-75">
                        ({{ tab.count }})
                    </span>
                </button>
            </div>

            <!-- Участники -->
            <div v-if="activeTab === 'members'" class="members-tab">
                <!-- Поиск участников -->
                <div class="mb-4">
                    <app-inputtext
                        v-model="membersSearchQuery"
                        placeholder="Поиск участников..."
                        class="w-full"
                    >
                        <template #prefix>
                            <i class="pi pi-search text-surface-400"></i>
                        </template>
                    </app-inputtext>
                </div>

                <!-- Список участников -->
                <div class="members-list max-h-96 overflow-y-auto">
                    <div
                        v-for="member in filteredMembers"
                        :key="member.user.id"
                        class="member-item flex items-center justify-between bg-surface-50 dark:bg-surface-800 p-4 rounded-lg mt-4"
                    >
                        <div class="flex items-center gap-3">
                            <div class="member-avatar">
                                <i class="pi pi-user"></i>
                            </div>
                            <div>
                                <div class="font-medium">
                                    {{ getMemberDisplayName(member) }}
                                    <span v-if="member.is_admin" class="admin-badge">
                                        <i class="pi pi-crown text-xs"></i>
                                        Admin
                                    </span>
                                </div>
                                <div class="text-sm text-surface-500">
                                    Присоединился {{ formatJoinDate(member.joined_at) }}
                                </div>
                            </div>
                        </div>

                        <!-- Действия с участником -->
                        <div class="flex items-center gap-2">
                            <Button
                                v-if="
                                    canManageMembers && !member.is_admin && !isCurrentUser(member)
                                "
                                icon="pi pi-crown"
                                size="small"
                                severity="secondary"
                                text
                                v-tooltip.left="'Сделать администратором'"
                                @click="makeAdmin(member)"
                            />
                            <Button
                                v-if="canManageMembers && !isCurrentUser(member)"
                                icon="pi pi-trash"
                                size="small"
                                severity="danger"
                                text
                                v-tooltip.left="'Удалить из чата'"
                                @click="removeMember(member)"
                                :loading="removingMembers.has(member.user.id)"
                            />
                        </div>
                    </div>

                    <!-- Пустое состояние -->
                    <div
                        v-if="filteredMembers.length === 0"
                        class="text-center py-8 text-surface-500"
                    >
                        <i class="pi pi-users text-4xl mb-4 block"></i>
                        <div>Участники не найдены</div>
                    </div>
                </div>
            </div>

            <!-- Приглашения -->
            <div v-if="activeTab === 'invites'" class="invites-tab">
                <!-- Кнопка добавления участников -->
                <div class="mb-4">
                    <Button
                        icon="pi pi-user-plus"
                        label="Пригласить участников"
                        @click="showInviteDialog = true"
                        :disabled="!canManageMembers"
                    />
                </div>

                <!-- Список приглашений -->
                <div class="invites-list max-h-96 overflow-y-auto">
                    <div
                        v-for="invite in pendingInvites"
                        :key="invite.id"
                        class="invite-item flex items-center justify-between p-3 border-b border-surface-100 dark:border-surface-700"
                    >
                        <div class="flex items-center gap-3">
                            <div class="member-avatar">
                                <i class="pi pi-clock text-orange-500"></i>
                            </div>
                            <div>
                                <div class="font-medium">
                                    {{ getInviteeDisplayName(invite) }}
                                </div>
                                <div class="text-sm text-surface-500">
                                    Приглашен
                                    {{
                                        invite.created_by
                                            ? getCreatedByName(invite.created_by)
                                            : 'неизвестно когда'
                                    }}
                                </div>
                            </div>
                        </div>

                        <!-- Действия с приглашением -->
                        <div class="flex items-center gap-2">
                            <Button
                                v-if="canManageMembers"
                                icon="pi pi-times"
                                size="small"
                                severity="danger"
                                text
                                v-tooltip.left="'Отозвать приглашение'"
                                @click="removeInvite(invite)"
                                :loading="removingInvites.has(invite.id || 0)"
                            />
                        </div>
                    </div>

                    <!-- Пустое состояние -->
                    <div
                        v-if="pendingInvites.length === 0"
                        class="text-center py-8 text-surface-500"
                    >
                        <i class="pi pi-envelope text-4xl mb-4 block"></i>
                        <div>Нет ожидающих приглашений</div>
                    </div>
                </div>
            </div>

            <!-- Настройки -->
            <div v-if="activeTab === 'settings'" class="settings-tab">
                <div class="space-y-4">
                    <!-- Редактирование информации о чате -->
                    <div class="setting-group">
                        <h4 class="font-semibold mb-3">
                            Информация о {{ chatTypeLabel.toLowerCase() }}
                        </h4>

                        <div class="space-y-3">
                            <div>
                                <label class="block text-sm font-medium mb-1">Название</label>
                                <app-inputtext
                                    v-model="editedTitle"
                                    :disabled="!canEditChat"
                                    class="w-full"
                                />
                            </div>

                            <div>
                                <label class="block text-sm font-medium mb-1">Описание</label>
                                <textarea
                                    v-model="editedDescription"
                                    :disabled="!canEditChat"
                                    class="p-inputtext p-inputtextarea w-full"
                                    rows="3"
                                />
                            </div>
                        </div>

                        <div v-if="canEditChat" class="flex justify-end gap-2 mt-4">
                            <Button
                                label="Отменить"
                                severity="secondary"
                                text
                                size="small"
                                @click="resetEditedInfo"
                                :disabled="!hasInfoChanges"
                            />
                            <Button
                                label="Сохранить"
                                size="small"
                                @click="saveEditedInfo"
                                :disabled="!hasInfoChanges || isSavingInfo"
                                :loading="isSavingInfo"
                            />
                        </div>
                    </div>

                    <!-- Опасные действия -->
                    <div v-if="canEditChat" class="setting-group pt-4">
                        <div
                            class="bg-red-50 dark:bg-red-900/20 border border-[#ff5252] dark:border-red-800 rounded-lg p-4"
                        >
                            <div class="flex items-start gap-3">
                                <i
                                    class="pi pi-exclamation-triangle !text-5xl text-[#ff5252] mt-1"
                                ></i>
                                <div class="flex-1 ml-3">
                                    <h5 class="font-medium text-red-800 dark:text-red-200">
                                        Удалить
                                    </h5>
                                    <p class="text-sm text-red-700 dark:text-red-300 mt-1">
                                        Это действие нельзя отменить. Все сообщения и файлы будут
                                        удалены безвозвратно.
                                    </p>
                                    <Button
                                        label="Удалить"
                                        severity="danger"
                                        size="small"
                                        class="mt-3"
                                        @click="deleteChat"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Подтверждение удаления участника -->
        <Dialog
            :visible="showRemoveMemberDialog"
            header="Удалить участника"
            :modal="true"
            :style="{ width: '400px' }"
            @update:visible="showRemoveMemberDialog = $event"
        >
            <div class="flex items-start gap-3">
                <i class="pi pi-exclamation-triangle text-orange-500 text-xl mt-1"></i>
                <div>
                    <p class="mb-3">
                        Вы действительно хотите удалить
                        <strong
                            >{{ memberToRemove?.user.first_name }}
                            {{ memberToRemove?.user.last_name }}</strong
                        >
                        из {{ chatTypeLabel.toLowerCase() }}?
                    </p>
                    <p class="text-sm text-surface-600 dark:text-surface-400">
                        Участник сможет быть приглашен повторно.
                    </p>
                </div>
            </div>

            <template #footer>
                <div class="flex justify-end gap-2">
                    <Button
                        label="Отмена"
                        severity="secondary"
                        text
                        @click="showRemoveMemberDialog = false"
                    />
                    <Button
                        label="Удалить"
                        severity="danger"
                        @click="confirmRemoveMember"
                        :loading="isRemovingMember"
                    />
                </div>
            </template>
        </Dialog>
    </Dialog>

    <!-- Диалог приглашения пользователей -->
    <InviteUsersDialog
        v-model:visible="showInviteDialog"
        :chat="chat"
        @invite-users="handleInviteUsers"
    />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { generateChatInitials, withBase } from '@/refactoring/modules/chat/utils/chatHelpers'
import { useChatStore } from '@/refactoring/modules/chat/stores/chatStore'
import { useCurrentUser } from '@/refactoring/modules/chat/composables/useCurrentUser'
import { useFeedbackStore } from '@/refactoring/modules/feedback/stores/feedbackStore'
import InviteUsersDialog from './InviteUsersDialog.vue'
import type { IChat, IChatMember, IChatInvitation } from '@/refactoring/modules/chat/types/IChat'

interface Props {
    visible: boolean
    chat: IChat | null
}

interface Emits {
    (e: 'update:visible', visible: boolean): void
    (e: 'chat-updated', chat: IChat): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Хранилища
const chatStore = useChatStore()
const feedbackStore = useFeedbackStore()
const { id: currentUserId } = useCurrentUser()

// Состояние компонента
const activeTab = ref<'members' | 'invites' | 'settings'>('members')
const membersSearchQuery = ref('')
const showRemoveMemberDialog = ref(false)
const memberToRemove = ref<IChatMember | null>(null)
const isRemovingMember = ref(false)
const removingMembers = ref(new Set<string>())
const removingInvites = ref(new Set<number>())
const showInviteDialog = ref(false)

// Редактирование информации о чате
const editedTitle = ref('')
const editedDescription = ref('')
const isSavingInfo = ref(false)

const chatInitials = computed(() => {
    return props.chat ? generateChatInitials(props.chat.title) : ''
})

const chatTypeLabel = computed(() => {
    if (!props.chat) return 'Чат'
    switch (props.chat.type) {
        case 'group':
            return 'Группа'
        case 'channel':
            return 'Канал'
        case 'direct':
        case 'dialog':
            return 'Диалог'
        default:
            return 'Чат'
    }
})

const totalMembers = computed(() => {
    return props.chat?.members?.length || 0
})

const pendingInvites = computed(() => {
    return props.chat?.invites?.filter((invite) => !invite.is_accepted) || []
})

const tabs = computed(() => [
    {
        key: 'members' as const,
        label: 'Участники',
        count: totalMembers.value,
    },
    {
        key: 'invites' as const,
        label: 'Приглашения',
        count: pendingInvites.value.length,
    },
    {
        key: 'settings' as const,
        label: 'Настройки',
    },
])

const filteredMembers = computed(() => {
    if (!props.chat?.members) return []

    const query = membersSearchQuery.value.toLowerCase().trim()
    if (!query) return props.chat.members

    return props.chat.members.filter((member) => {
        const displayName = getMemberDisplayName(member).toLowerCase()
        return displayName.includes(query)
    })
})

const canManageMembers = computed(() => {
    if (!props.chat || !currentUserId.value) return false

    // Проверяем, является ли текущий пользователь администратором
    const currentMember = props.chat.members?.find(
        (member) => member.user.id === currentUserId.value,
    )

    return currentMember?.is_admin || false
})

const canEditChat = computed(() => {
    return canManageMembers.value
})

const hasInfoChanges = computed(() => {
    if (!props.chat) return false
    return (
        editedTitle.value !== props.chat.title ||
        editedDescription.value !== (props.chat.description || '')
    )
})

// Вспомогательные функции
const getMemberDisplayName = (member: IChatMember): string => {
    const { first_name, last_name, middle_name } = member.user
    return [first_name, middle_name, last_name].filter(Boolean).join(' ') || 'Пользователь'
}

const getInviteeDisplayName = (invite: IChatInvitation): string => {
    if (!invite.invited_user) return 'Неизвестный пользователь'
    const { first_name, last_name, middle_name } = invite.invited_user
    return [first_name, middle_name, last_name].filter(Boolean).join(' ') || 'Пользователь'
}

const getCreatedByName = (createdBy: any): string => {
    const { first_name, last_name, middle_name } = createdBy
    return [first_name, middle_name, last_name].filter(Boolean).join(' ') || 'неизвестно кем'
}

const isCurrentUser = (member: IChatMember): boolean => {
    return member.user.id === currentUserId.value
}

const formatJoinDate = (dateString: string): string => {
    try {
        const date = new Date(dateString)
        return date.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        })
    } catch {
        return 'неизвестно когда'
    }
}

// Обработчики событий
const removeMember = (member: IChatMember) => {
    memberToRemove.value = member
    showRemoveMemberDialog.value = true
}

const confirmRemoveMember = async () => {
    if (!memberToRemove.value || !props.chat) return

    isRemovingMember.value = true
    removingMembers.value.add(memberToRemove.value.user.id)

    try {
        await chatStore.removeMemberFromChat(props.chat.id, memberToRemove.value.user.id)

        // Обновляем локальное состояние чата
        const updatedChat = await chatStore.fetchChat(props.chat.id)
        emit('chat-updated', updatedChat)

        showRemoveMemberDialog.value = false
        memberToRemove.value = null

        feedbackStore.showToast({
            type: 'success',
            title: 'Успешно',
            message: 'Участник удален из чата',
            time: 3000,
        })
    } catch (error) {
        feedbackStore.showToast({
            type: 'error',
            title: 'Ошибка',
            message: 'Не удалось удалить участника',
            time: 5000,
        })
    } finally {
        isRemovingMember.value = false
        removingMembers.value.delete(memberToRemove.value?.user.id || '')
    }
}

const makeAdmin = async (member: IChatMember) => {
    // TODO: Реализовать назначение администратора когда API будет готово
    feedbackStore.showToast({
        type: 'info',
        title: 'В разработке',
        message: 'Функция назначения администратора будет добавлена позже',
        time: 3000,
    })
}

const removeInvite = async (invite: IChatInvitation) => {
    if (!invite.id) return

    removingInvites.value.add(invite.id)

    try {
        await chatStore.removeInvitation(invite.id)

        // Обновляем локальное состояние чата
        if (props.chat) {
            const updatedChat = await chatStore.fetchChat(props.chat.id)
            emit('chat-updated', updatedChat)
        }

        feedbackStore.showToast({
            type: 'success',
            title: 'Успешно',
            message: 'Приглашение отозвано',
            time: 3000,
        })
    } catch (error) {
        feedbackStore.showToast({
            type: 'error',
            title: 'Ошибка',
            message: 'Не удалось отозвать приглашение',
            time: 5000,
        })
    } finally {
        removingInvites.value.delete(invite.id)
    }
}

const handleInviteUsers = async (userIds: string[]) => {
    if (!props.chat) return

    try {
        await chatStore.addMembersToChat(props.chat.id, userIds)

        // Обновляем локальное состояние чата
        const updatedChat = await chatStore.fetchChat(props.chat.id)
        emit('chat-updated', updatedChat)

        showInviteDialog.value = false
    } catch (error) {
        // Ошибка обрабатывается в chatStore
    }
}

const saveEditedInfo = async () => {
    if (!props.chat || !hasInfoChanges.value) return

    isSavingInfo.value = true

    try {
        const updatedChat = await chatStore.updateChat(props.chat.id, {
            title: editedTitle.value.trim(),
            description: editedDescription.value.trim(),
        })

        emit('chat-updated', updatedChat)

        feedbackStore.showToast({
            type: 'success',
            title: 'Сохранено',
            message: 'Информация о чате обновлена',
            time: 3000,
        })
    } catch (error) {
        // Ошибка обрабатывается в chatStore
    } finally {
        isSavingInfo.value = false
    }
}

const resetEditedInfo = () => {
    if (props.chat) {
        editedTitle.value = props.chat.title
        editedDescription.value = props.chat.description || ''
    }
}

const deleteChat = async () => {
    if (!props.chat) return

    const confirmed = confirm(
        `Вы действительно хотите удалить ${chatTypeLabel.value.toLowerCase()} "${props.chat.title}"? Это действие нельзя отменить.`,
    )
    if (!confirmed) return

    try {
        // TODO: Реализовать удаление чата когда API будет готово
        feedbackStore.showToast({
            type: 'info',
            title: 'В разработке',
            message: 'Функция удаления чата будет добавлена позже',
            time: 3000,
        })
    } catch (error) {
        feedbackStore.showToast({
            type: 'error',
            title: 'Ошибка',
            message: 'Не удалось удалить чат',
            time: 5000,
        })
    }
}

// Наблюдатели
watch(
    () => props.visible,
    (visible) => {
        if (visible && props.chat) {
            // Инициализируем поля редактирования при открытии
            editedTitle.value = props.chat.title
            editedDescription.value = props.chat.description || ''
            activeTab.value = 'members'
            membersSearchQuery.value = ''
        }
    },
)

watch(
    () => props.chat,
    (newChat) => {
        if (newChat) {
            editedTitle.value = newChat.title
            editedDescription.value = newChat.description || ''
        }
    },
)
</script>

<style scoped>
.chat-icon {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    object-fit: cover;
    flex-shrink: 0;
}

.chat-icon-initials {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    background: var(--p-primary-color);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    font-weight: 600;
    flex-shrink: 0;
}

.member-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background-color: var(--p-surface-200);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--p-surface-600);
    flex-shrink: 0;
}

.admin-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: var(--p-primary-100);
    color: var(--p-primary-700);
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 12px;
    font-weight: 500;
    margin-left: 8px;
}

.invite-item:hover {
    background: var(--p-surface-100);
}

.space-y-4 > * + * {
    margin-top: 1rem;
}

.space-y-3 > * + * {
    margin-top: 0.75rem;
}

.setting-group {
    padding-bottom: 1rem;
}

.setting-group:not(:last-child) {
    border-bottom: 1px solid var(--p-surface-200);
    margin-bottom: 1rem;
}

/* Улучшенные стили для вкладок */
.flex.border-b button {
    position: relative;
    transition: all 0.2s ease;
}

.flex.border-b button:hover {
    background: var(--p-surface-50);
}

/* Стили для темной темы */
.app-dark .member-avatar {
    background-color: var(--p-surface-700);
    color: var(--p-surface-300);
}

.app-dark .admin-badge {
    background: var(--p-primary-900);
    color: var(--p-primary-100);
}

.app-dark .member-item:hover,
.app-dark .invite-item:hover {
    background: var(--p-surface-800);
}

/* Адаптивные стили */
@media (max-width: 768px) {
    .member-item,
    .invite-item {
        padding: 1rem;
    }

    .chat-icon,
    .chat-icon-initials {
        width: 40px;
        height: 40px;
        font-size: 16px;
    }

    .member-avatar {
        width: 36px;
        height: 36px;
    }
}

/* Кастомный скроллбар */
.members-list::-webkit-scrollbar,
.invites-list::-webkit-scrollbar {
    width: 6px;
}

.members-list::-webkit-scrollbar-track,
.invites-list::-webkit-scrollbar-track {
    background: transparent;
}

.members-list::-webkit-scrollbar-thumb,
.invites-list::-webkit-scrollbar-thumb {
    background-color: var(--p-surface-300);
    border-radius: 3px;
}

.app-dark .members-list::-webkit-scrollbar-thumb,
.app-dark .invites-list::-webkit-scrollbar-thumb {
    background-color: var(--p-surface-600);
}
</style>

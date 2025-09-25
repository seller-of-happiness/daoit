<template>
    <Dialog
        :visible="visible"
        :header="dialogTitle"
        :modal="true"
        :style="{ width: '600px', maxHeight: '80vh' }"
        :appendTo="'body'"
        :baseZIndex="9995"
        class="members-list-modal"
        @update:visible="$emit('update:visible', $event)"
    >
        <div class="members-container">
            <!-- Заголовок со счетчиком -->
            <div class="members-header mb-4">
                <h3 class="text-lg font-semibold">
                    Участники {{ chatTypeLabel.toLowerCase() }}
                </h3>
                <p class="text-sm text-surface-500">
                    Всего участников: {{ totalMembers }}
                </p>
            </div>

            <!-- Список участников с внутренним скроллом -->
            <div class="members-list max-h-96 overflow-y-auto border border-surface-200 dark:border-surface-700 rounded-lg">
                <div
                    v-for="member in members"
                    :key="member.user.id"
                    class="member-item flex items-center justify-between p-4 border-b border-surface-100 dark:border-surface-700 last:border-b-0"
                >
                    <!-- Информация об участнике -->
                    <div class="flex items-center gap-3 flex-1 min-w-0">
                        <!-- Аватарка -->
                        <div class="member-avatar">
                            <img 
                                v-if="getMemberAvatar(member)"
                                :src="getMemberAvatar(member)"
                                :alt="getMemberDisplayName(member)"
                                class="avatar-image"
                            />
                            <div v-else class="avatar-initials">
                                {{ getMemberInitials(member) }}
                            </div>
                        </div>

                        <!-- Данные участника -->
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2">
                                <h4 class="font-semibold text-base truncate">
                                    {{ getMemberDisplayName(member) }}
                                </h4>
                                <span v-if="member.is_admin" class="admin-badge">
                                    <i class="pi pi-crown text-xs"></i>
                                    Admin
                                </span>
                            </div>
                            
                            <!-- Должность -->
                            <p v-if="getMemberPosition(member)" class="text-sm text-surface-600 dark:text-surface-400 truncate">
                                {{ getMemberPosition(member) }}
                            </p>
                            
                            <!-- Подразделение -->
                            <p v-if="getMemberDepartment(member)" class="text-xs text-surface-500 truncate">
                                {{ getMemberDepartment(member) }}
                            </p>
                        </div>
                    </div>

                    <!-- Кнопка исключения -->
                    <div class="flex-shrink-0 ml-3">
                        <Button
                            v-if="canRemoveMember(member)"
                            :label="getRemoveButtonText()"
                            severity="danger"
                            size="small"
                            outlined
                            :loading="removingMembers.has(member.user.id)"
                            @click="removeMember(member)"
                        />
                    </div>
                </div>

                <!-- Пустое состояние -->
                <div
                    v-if="members.length === 0"
                    class="text-center py-8 text-surface-500"
                >
                    <i class="pi pi-users text-4xl mb-4 block"></i>
                    <div>Участники не найдены</div>
                </div>
            </div>
        </div>

        <!-- Подтверждение удаления участника -->
        <Dialog
            :visible="showRemoveConfirm"
            header="Исключить участника"
            :modal="true"
            :style="{ width: '400px' }"
            @update:visible="showRemoveConfirm = $event"
        >
            <div class="flex items-start gap-3">
                <i class="pi pi-exclamation-triangle text-orange-500 text-xl mt-1"></i>
                <div>
                    <p class="mb-3">
                        Вы действительно хотите исключить
                        <strong>{{ getMemberDisplayName(memberToRemove) }}</strong>
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
                        @click="showRemoveConfirm = false"
                    />
                    <Button
                        label="Исключить"
                        severity="danger"
                        @click="confirmRemoveMember"
                        :loading="isRemovingMember"
                    />
                </div>
            </template>
        </Dialog>
    </Dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useChatStore } from '@/refactoring/modules/chat/stores/chatStore'
import { useCurrentUser } from '@/refactoring/modules/chat/composables/useCurrentUser'
import { useFeedbackStore } from '@/refactoring/modules/feedback/stores/feedbackStore'
import { UserService } from '@/refactoring/modules/chat/utils/UserService'
import type { IChat, IChatMember } from '@/refactoring/modules/chat/types/IChat'
import type { IEmployee } from '@/refactoring/modules/apiStore/types/employees/IEmployee'

interface Props {
    visible: boolean
    chat: IChat | null
}

interface Emits {
    (e: 'update:visible', visible: boolean): void
    (e: 'member-removed', member: IChatMember): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Хранилища
const chatStore = useChatStore()
const feedbackStore = useFeedbackStore()
const { id: currentUserId } = useCurrentUser()

// Состояние компонента
const showRemoveConfirm = ref(false)
const memberToRemove = ref<IChatMember | null>(null)
const isRemovingMember = ref(false)
const removingMembers = ref(new Set<string>())

// Вычисляемые свойства
const dialogTitle = computed(() => {
    if (!props.chat) return 'Участники'
    return `Участники: ${props.chat.title}`
})

const chatTypeLabel = computed(() => {
    if (!props.chat) return 'Чат'
    switch (props.chat.type) {
        case 'group':
            return 'Группы'
        case 'channel':
            return 'Канала'
        case 'direct':
        case 'dialog':
            return 'Диалога'
        default:
            return 'Чата'
    }
})

const members = computed(() => {
    return props.chat?.members || []
})

const totalMembers = computed(() => {
    return members.value.length
})

const canManageMembers = computed(() => {
    if (!props.chat || !currentUserId.value) return false

    // Проверяем, является ли текущий пользователь администратором
    const currentMember = props.chat.members?.find(
        (member) => member.user.id === currentUserId.value,
    )

    return currentMember?.is_admin || false
})

// Вспомогательные функции
const getMemberDisplayName = (member: IChatMember | null): string => {
    if (!member) return 'Неизвестный пользователь'
    const { first_name, last_name, middle_name } = member.user
    return [first_name, middle_name, last_name].filter(Boolean).join(' ') || 'Пользователь'
}

const getMemberInitials = (member: IChatMember): string => {
    const displayName = getMemberDisplayName(member)
    return UserService.generateInitialsFromString(displayName)
}

const getMemberAvatar = (member: IChatMember): string | null => {
    // Получаем аватарку пользователя
    return member.user.avatar || null
}

const getMemberPosition = (member: IChatMember): string | null => {
    // Получаем должность из данных пользователя
    return member.user.position?.name || null
}

const getMemberDepartment = (member: IChatMember): string | null => {
    // Получаем подразделение из данных пользователя
    return member.user.department?.name || null
}

const canRemoveMember = (member: IChatMember): boolean => {
    // Нельзя удалить самого себя и нужны права администратора
    if (member.user.id === currentUserId.value) return false
    return canManageMembers.value
}

const isCurrentUser = (member: IChatMember): boolean => {
    return member.user.id === currentUserId.value
}

const getRemoveButtonText = (): string => {
    if (!props.chat) return 'Исключить'
    
    switch (props.chat.type) {
        case 'group':
            return 'Исключить из группы'
        case 'channel':
            return 'Исключить из канала'
        default:
            return 'Исключить'
    }
}

// Обработчики событий
const removeMember = (member: IChatMember) => {
    memberToRemove.value = member
    showRemoveConfirm.value = true
}

const confirmRemoveMember = async () => {
    if (!memberToRemove.value || !props.chat) return

    isRemovingMember.value = true
    removingMembers.value.add(memberToRemove.value.user.id)

    try {
        await chatStore.removeMemberFromChat(props.chat.id, memberToRemove.value.user.id)

        showRemoveConfirm.value = false
        emit('member-removed', memberToRemove.value)
        memberToRemove.value = null

        feedbackStore.showToast({
            type: 'success',
            title: 'Успешно',
            message: 'Участник исключен из группы/канала',
            time: 3000,
        })
    } catch (error) {
        feedbackStore.showToast({
            type: 'error',
            title: 'Ошибка',
            message: 'Не удалось исключить участника',
            time: 5000,
        })
    } finally {
        isRemovingMember.value = false
        removingMembers.value.delete(memberToRemove.value?.user.id || '')
    }
}
</script>

<style scoped>
.member-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    flex-shrink: 0;
    overflow: hidden;
}

.avatar-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.avatar-initials {
    width: 100%;
    height: 100%;
    background: var(--p-primary-color);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    font-weight: 600;
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
    flex-shrink: 0;
}

.member-item:hover {
    background: var(--p-surface-50);
}

.members-list {
    background: var(--p-surface-0);
}

/* Кастомный скроллбар */
.members-list::-webkit-scrollbar {
    width: 6px;
}

.members-list::-webkit-scrollbar-track {
    background: transparent;
}

.members-list::-webkit-scrollbar-thumb {
    background-color: var(--p-surface-300);
    border-radius: 3px;
}

/* Стили для темной темы */
:global(.dark) .member-item:hover {
    background: var(--p-surface-800);
}

:global(.dark) .members-list {
    background: var(--p-surface-900);
}

:global(.dark) .admin-badge {
    background: var(--p-primary-900);
    color: var(--p-primary-100);
}

:global(.dark) .members-list::-webkit-scrollbar-thumb {
    background-color: var(--p-surface-600);
}

/* Адаптивные стили */
@media (max-width: 768px) {
    .member-item {
        padding: 1rem;
    }

    .member-avatar {
        width: 40px;
        height: 40px;
    }

    .avatar-initials {
        font-size: 14px;
    }
}
</style>
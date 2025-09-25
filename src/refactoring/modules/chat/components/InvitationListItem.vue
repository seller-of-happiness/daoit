<template>
    <div class="invitation-item">
        <!-- Иконка чата -->
        <img v-if="invitation.chat.icon" :src="withBase(invitation.chat.icon)" alt="icon" class="chat-icon" />
        <div v-else class="chat-icon-initials">
            {{ chatInitials }}
        </div>

        <!-- Информация о приглашении -->
        <div class="flex-1 min-w-0">
            <div class="invitation-title">{{ invitation.chat.title }}</div>
            <div class="invitation-sub">
                <span class="invitation-message">
                    {{ stripHtmlTags(invitation.created_by.first_name) }} {{ stripHtmlTags(invitation.created_by.last_name) }} приглашает вас
                </span>
            </div>
        </div>

        <!-- Действия -->
        <div class="invitation-actions">
            <Button
                icon="pi pi-check"
                severity="success"
                size="small"
                rounded
                outlined
                v-tooltip.left="'Принять'"
                @click="handleAccept"
                :loading="isProcessing"
                :disabled="isProcessing"
            />
            <Button
                icon="pi pi-times"
                severity="danger"
                size="small"
                rounded
                outlined
                v-tooltip.left="'Отклонить'"
                @click="handleDecline"
                :loading="isProcessing"
                :disabled="isProcessing"
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { generateChatInitials, withBase } from '@/refactoring/modules/chat/utils/chatHelpers'
import type { IChatInvitation } from '@/refactoring/modules/chat/types/IChat'

interface Props {
    invitation: IChatInvitation
}

interface Emits {
    (e: 'accept'): void
    (e: 'decline'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const isProcessing = ref(false)

// Обработчики для кнопок
const handleAccept = async () => {
    if (isProcessing.value || !props.invitation.id) {
        console.warn('[InvitationListItem] handleAccept: кнопка заблокирована или нет ID', {
            isProcessing: isProcessing.value,
            invitationId: props.invitation.id
        })
        return
    }
    
    console.log('[InvitationListItem] handleAccept: принимаем приглашение', props.invitation.id)
    isProcessing.value = true
    try {
        emit('accept')
    } finally {
        // Не сбрасываем флаг сразу, так как приглашение должно исчезнуть из списка
        // isProcessing.value = false
    }
}

const handleDecline = async () => {
    if (isProcessing.value || !props.invitation.id) {
        console.warn('[InvitationListItem] handleDecline: кнопка заблокирована или нет ID', {
            isProcessing: isProcessing.value,
            invitationId: props.invitation.id
        })
        return
    }
    
    console.log('[InvitationListItem] handleDecline: отклоняем приглашение', props.invitation.id)
    isProcessing.value = true
    try {
        emit('decline')
    } finally {
        // Не сбрасываем флаг сразу, так как приглашение должно исчезнуть из списка
        // isProcessing.value = false
    }
}

/**
 * Очищает HTML теги из строки, оставляя только текст
 */
const stripHtmlTags = (str: string): string => {
    if (!str) return str
    return str.replace(/<[^>]*>/g, '')
}

// Получение инициалов для иконки
const chatInitials = computed(() => {
    return generateChatInitials(props.invitation.chat.title)
})
</script>

<style lang="scss" scoped>
.invitation-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--p-content-border-color);
    min-height: 64px;
    background: var(--p-surface-50);
    border-left: 3px solid var(--p-primary-color);
    transition: all 0.2s;

    &:hover {
        background: var(--p-surface-100);
    }
}

.chat-icon {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    object-fit: cover;
    flex-shrink: 0;
}

.chat-icon-initials {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: var(--p-primary-color);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 600;
    flex-shrink: 0;
}

.invitation-title {
    font-weight: 600;
    color: var(--text-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 2px;
}

.invitation-sub {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    flex: 1;
}

.invitation-message {
    color: var(--text-secondary-color);
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
}

.invitation-actions {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
}
</style>
<template>
    <div
        class="chat-item"
        :class="{ 'chat-item--active': isActive, 'chat-item--unread': unreadCount > 0 }"
        @click="$emit('select')"
    >
        <img v-if="chatIcon" :src="withBase(chatIcon)" alt="icon" class="chat-icon" />
        <div v-else class="chat-icon-initials">
            {{ chatInitials }}
        </div>

        <div class="flex-1 min-w-0">
            <div class="chat-title">{{ chatTitle }}</div>
            <div class="chat-sub">
                <span v-if="lastMessageDisplay" class="last-message">
                    <span v-if="isLastMessageFromCurrentUser" class="message-direction-indicator"
                        >↳</span
                    >
                    {{ lastMessageDisplay }}
                </span>
                <span v-if="lastMessageTime" class="message-time">{{ lastMessageTime }}</span>
            </div>
        </div>

        <!-- Индикатор непрочитанных сообщений -->
        <div v-if="unreadCount > 0" class="chat-item__badge">
            {{ unreadCount > 99 ? '99+' : unreadCount }}
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { generateChatInitialsForChat, withBase } from '@/refactoring/modules/chat/utils/chatHelpers'
import type { IChat } from '@/refactoring/modules/chat/types/IChat'
import { useCurrentUser, isMyMessage } from '@/refactoring/modules/chat/composables/useCurrentUser'
import { useChatTitle } from '@/refactoring/modules/chat/composables/useChatTitle'
import {
    formatMessagePreview,
    getMessageDisplayText,
} from '@/refactoring/modules/chat/utils/messageFormatter'

interface Props {
    chat: IChat
    isActive: boolean
}

interface Emits {
    (e: 'select'): void
}

const props = defineProps<Props>()
defineEmits<Emits>()

const { id: currentUserId, name: currentUserName } = useCurrentUser()

// Определяем название и иконку чата с использованием обновленного композабла
const currentChatRef = computed(() => props.chat)
const { chatTitle, chatIcon } = useChatTitle(currentChatRef)

// Получение инициалов для иконки с учетом новой структуры
const chatInitials = computed(() => {
    return generateChatInitialsForChat(props.chat, currentUserId.value)
})

// Количество непрочитанных сообщений
const unreadCount = computed(() => {
    return props.chat.unread_count || 0
})

// Отображение последнего сообщения
const lastMessageDisplay = computed(() => {
    if (!props.chat.last_message) {
        return null
    }

    const messageText = getMessageDisplayText(props.chat.last_message)
    return formatMessagePreview(messageText, 55)
})

// Проверка, является ли последнее сообщение от текущего пользователя
const isLastMessageFromCurrentUser = computed(() => {
    if (!props.chat.last_message) {
        return false
    }

    // Показываем стрелочку только если это действительно последнее сообщение от текущего пользователя
    return isMyMessage(props.chat.last_message, currentUserId.value, currentUserName.value)
})

// Форматирование времени последнего сообщения
const lastMessageTime = computed(() => {
    if (!props.chat.last_message?.created_at) {
        return null
    }

    const messageDate = new Date(props.chat.last_message.created_at)
    const now = new Date()

    // Сброс времени для корректного сравнения дат
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const msgDate = new Date(
        messageDate.getFullYear(),
        messageDate.getMonth(),
        messageDate.getDate(),
    )

    // Вычисляем разность в днях
    const diffTime = today.getTime() - msgDate.getTime()
    const diffDays = diffTime / (1000 * 60 * 60 * 24)

    // Если сообщение сегодня - показываем время
    if (diffDays === 0) {
        return messageDate.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
        })
    }

    // Если сообщение на этой неделе (1-6 дней назад) - показываем день недели
    if (diffDays <= 6) {
        return messageDate.toLocaleDateString('ru-RU', {
            weekday: 'short',
        })
    }

    // Если сообщение старше недели - показываем дату
    return messageDate.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
    })
})
</script>

<style lang="scss" scoped>
.last-message {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: wrap;
}

.message-direction-indicator {
    color: var(--p-primary-color);
    font-weight: 600;
    flex-shrink: 0;
    margin-top: -6px;
    transform: rotate(180deg);
}

.message-time {
    color: var(--text-secondary-color);
    font-size: 11px;
    flex-shrink: 0;
    opacity: 0.8;
}

.unread-badge {
    background: var(--p-primary-color);
    color: white;
    border-radius: 12px;
    padding: 2px 8px;
    font-size: 11px;
    font-weight: 600;
    min-width: 20px;
    text-align: center;
    flex-shrink: 0;
    line-height: 1.4;
}
</style>

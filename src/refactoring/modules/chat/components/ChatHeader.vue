<template>
    <div class="py-4 border-b border-surface-200 dark:border-surface-800 flex items-center gap-3">
        <template v-if="currentChat">
            <Button
                v-if="isMobile && mobileView === 'chat'"
                icon="pi pi-arrow-left"
                text
                class="mr-1 md:hidden"
                @click="$emit('back-to-list')"
            />

            <img v-if="chatIcon" :src="withBase(chatIcon)" alt="icon" class="chat-icon" />
            <div v-else class="chat-icon-initials">
                {{ chatInitials }}
            </div>

            <div class="font-semibold text-lg truncate">
                {{ chatName }}
            </div>
        </template>

        <div v-else class="font-semibold text-lg truncate">Выберите чат</div>

        <div class="ml-auto flex items-center gap-3">
            <!-- Дополнительные кнопки (слот для кастомизации) -->
            <slot name="extra-buttons" />

            <!-- Кнопка управления звуком -->
            <Button
                :icon="soundIcon"
                :severity="soundSeverity"
                text
                rounded
                size="small"
                :class="{ 'sound-needs-activation': !soundUnlocked && soundEnabled }"
                v-tooltip.bottom="soundTooltip"
                @click="toggleSound"
            />

            <!-- Кнопка приглашения пользователей для групп и каналов -->
            <Button
                v-if="canInviteUsers"
                icon="pi pi-user-plus"
                severity="secondary"
                text
                rounded
                size="small"
                class="ml-auto mr-2"
                v-tooltip.bottom="'Пригласить пользователей'"
                @click="$emit('invite-users')"
            />

            <span class="text-sm text-surface-500"> Участников: {{ memberCount }} </span>

            <!-- Индикатор статуса соединения -->
            <div
                class="connection-status"
                :class="connectionStatusClass"
                v-tooltip.bottom="connectionStatusText"
            >
                <i :class="connectionStatusIcon"></i>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { generateChatInitials, withBase } from '@/refactoring/modules/chat/utils/chatHelpers'
import { useCurrentUser } from '@/refactoring/modules/chat/composables/useCurrentUser'
import { useCentrifugeStore } from '@/refactoring/modules/centrifuge/stores/centrifugeStore'
import { useSound } from '@/refactoring/modules/chat/composables/useSound'
import { useChatTitle } from '@/refactoring/modules/chat/composables/useChatTitle'
import type { IChat, MobileViewType } from '@/refactoring/modules/chat/types/IChat'

interface Props {
    currentChat: IChat | null
    isMobile: boolean
    mobileView: MobileViewType
}

interface Emits {
    (e: 'back-to-list'): void
    (e: 'invite-users'): void
}

const props = defineProps<Props>()
defineEmits<Emits>()

const { id: currentUserId } = useCurrentUser()
const centrifugeStore = useCentrifugeStore()

// Используем composable для звука
const {
    isEnabled: soundEnabled,
    isUnlocked: soundUnlocked,
    soundIcon,
    soundSeverity,
    soundTooltip,
    toggleSound,
} = useSound()

// Получение собеседника для личных диалогов
const directChatCompanion = computed(() => {
    if (props.currentChat?.type !== 'direct' && props.currentChat?.type !== 'dialog') return null

    // Добавляем проверку на существование members
    const members = props.currentChat.members
    if (!members || !Array.isArray(members)) return null

    return (
        members.find((member) => {
            if (!member) return false // Проверка на существование member

            // Проверяем и по user, и по user_uuid, приводя к строке для сравнения
            const memberUserId = String(member.user || member.user_uuid || '')
            const currentUserIdStr = String(currentUserId || '')
            return memberUserId !== currentUserIdStr && memberUserId !== ''
        }) || null
    )
})

// Используем композабл для определения названия и иконки
const currentChatRef = computed(() => props.currentChat)
const { chatTitle: chatName, chatIcon } = useChatTitle(currentChatRef)

// Инициалы для чата
const chatInitials = computed(() => {
    return generateChatInitials(chatName.value)
})

// Безопасное получение количества участников
const memberCount = computed(() => {
    if (!props.currentChat) return 0

    // Добавляем проверки на существование и является ли массивом
    const members = props.currentChat.members
    if (!members || !Array.isArray(members)) return 0

    return members.length
})

// Определяем, можно ли приглашать пользователей
const canInviteUsers = computed(() => {
    if (!props.currentChat) return false

    // Приглашать можно только в группы и каналы
    return props.currentChat.type === 'group' || props.currentChat.type === 'channel'
})

// Статус соединения WebSocket
const connectionStatusClass = computed(() => {
    const status = centrifugeStore.connectionStatus
    return {
        'status-connected': status === 'connected',
        'status-connecting': status === 'connecting',
        'status-reconnecting': status === 'reconnecting',
        'status-disconnected': status === 'disconnected',
    }
})

const connectionStatusIcon = computed(() => {
    const status = centrifugeStore.connectionStatus
    switch (status) {
        case 'connected':
            return 'pi pi-check-circle'
        case 'connecting':
            return 'pi pi-spin pi-spinner'
        case 'reconnecting':
            return 'pi pi-spin pi-refresh'
        default:
            return 'pi pi-exclamation-triangle'
    }
})

const connectionStatusText = computed(() => {
    const status = centrifugeStore.connectionStatus
    const attempts = centrifugeStore.reconnectAttempts

    switch (status) {
        case 'connected':
            return 'Соединение установлено'
        case 'connecting':
            return 'Подключение...'
        case 'reconnecting':
            return `Переподключение... (попытка ${attempts})`
        default:
            return 'Соединение потеряно'
    }
})

// Вспомогательные функции
function getChatTitleByType(type: string, id: number): string {
    switch (type) {
        case 'direct':
        case 'dialog':
            return `Диалог #${id}`
        case 'group':
            return `Группа #${id}`
        case 'channel':
            return `Канал #${id}`
        default:
            return `Чат #${id}`
    }
}
</script>

<style lang="scss" scoped>
.connection-status {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    font-size: 12px;
    transition: all 0.3s ease;
}

.status-connected {
    color: #10b981;
    background-color: rgba(16, 185, 129, 0.1);
}

.status-connecting {
    color: #f59e0b;
    background-color: rgba(245, 158, 11, 0.1);
}

.status-reconnecting {
    color: #f97316;
    background-color: rgba(249, 115, 22, 0.1);
}

.status-disconnected {
    color: #ef4444;
    background-color: rgba(239, 68, 68, 0.1);
}

// Стили для кнопки звука, требующей активации
.sound-needs-activation {
    position: relative;
    animation: soundPulse 2s infinite;

    &::after {
        content: '';
        position: absolute;
        top: -2px;
        right: -2px;
        width: 8px;
        height: 8px;
        background: #ff6b6b;
        border-radius: 50%;
        animation: soundBlink 1s infinite;
    }
}

@keyframes soundPulse {
    0%,
    100% {
        transform: scale(1);
    }
    50% {
        transform: scale(1.05);
    }
}

@keyframes soundBlink {
    0%,
    50% {
        opacity: 1;
    }
    51%,
    100% {
        opacity: 0;
    }
}
</style>

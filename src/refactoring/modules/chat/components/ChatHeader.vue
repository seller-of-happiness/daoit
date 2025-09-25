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

            <div class="flex-1 min-w-0">
                <div class="font-semibold text-lg truncate">
                    {{ chatName }}
                </div>
                <div v-if="chatSubtitle" class="text-sm text-surface-500 truncate">
                    {{ chatSubtitle }}
                </div>
            </div>
        </template>

        <div v-else class="font-semibold text-lg truncate">Выберите чат</div>

        <div class="ml-auto flex items-center gap-2">
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

            <!-- Кнопка управления чатом для групп и каналов -->
            <Button
                v-if="canManageChat"
                icon="pi pi-cog"
                severity="secondary"
                text
                rounded
                size="small"
                v-tooltip.bottom="'Управление чатом'"
                @click="$emit('manage-chat')"
            />

            <!-- Кнопка приглашения пользователей для групп и каналов -->
            <Button
                v-if="canInviteUsers"
                icon="pi pi-user-plus"
                severity="secondary"
                text
                rounded
                size="small"
                v-tooltip.bottom="'Пригласить пользователей'"
                @click="$emit('invite-users')"
            />
            
            <!-- Кнопка диагностики WebSocket (только в dev режиме) -->
            <Button
                v-if="isDevelopment || showDebugTools"
                icon="pi pi-cog"
                severity="help"
                text
                rounded
                size="small"
                v-tooltip.bottom="'Диагностика WebSocket'"
                @click="$emit('debug-websocket')"
            />

            <!-- Счетчик участников -->
            <div 
                v-if="showMemberCount" 
                class="text-sm text-surface-500 px-2 cursor-pointer hover:text-surface-700 dark:hover:text-surface-300 transition-colors rounded-md hover:bg-surface-100 dark:hover:bg-surface-700"
                @click="$emit('show-members')"
                v-tooltip.bottom="'Показать участников'"
            >
                <i class="pi pi-users mr-1"></i>
                Участников: {{ memberCount }}
            </div>


        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { withBase, canUserPerformAction } from '@/refactoring/modules/chat/utils/chatHelpers'
import { UserService } from '@/refactoring/modules/chat/utils/UserService'
import { useCurrentUser } from '@/refactoring/modules/chat/composables/useCurrentUser'
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
    (e: 'manage-chat'): void
    (e: 'show-members'): void
    (e: 'debug-websocket'): void
}

const props = defineProps<Props>()
defineEmits<Emits>()

const { id: currentUserId } = useCurrentUser()

// Показываем debug инструменты в dev режиме или при необходимости
const showDebugTools = ref(false)

// Проверка dev режима (для использования в template)
const isDevelopment = computed(() => import.meta.env.DEV)


// Используем композабл для звука
const {
    isEnabled: soundEnabled,
    isUnlocked: soundUnlocked,
    soundIcon,
    soundSeverity,
    soundTooltip,
    toggleSound,
} = useSound()

// Используем композабл для определения названия и иконки
const currentChatRef = computed(() => props.currentChat)
const { chatTitle: chatName, chatIcon, isCurrentUserAdmin } = useChatTitle(currentChatRef)


// Инициалы для чата
const chatInitials = computed(() => {
    return UserService.generateInitialsFromString(chatName.value)
})

// Подзаголовок чата
const chatSubtitle = computed(() => {
    if (!props.currentChat) return ''

    const chat = props.currentChat

    // Для личных диалогов не показываем подзаголовок
    if (chat.type === 'direct' || chat.type === 'dialog') {
        return ''
    }

    // Для групп и каналов показываем описание если есть
    return chat.description || ''
})

// Безопасное получение количества участников
const memberCount = computed(() => {
    if (!props.currentChat) return 0

    const members = props.currentChat.members
    if (!members || !Array.isArray(members)) return 0

    return members.length
})

// Показывать ли счетчик участников
const showMemberCount = computed(() => {
    if (!props.currentChat) return false
    return props.currentChat.type === 'group' || props.currentChat.type === 'channel'
})

// Определяем, можно ли приглашать пользователей
const canInviteUsers = computed(() => {
    if (!props.currentChat || !currentUserId.value) {
        return false
    }

    // Приглашать можно только в группы и каналы
    if (props.currentChat.type !== 'group' && props.currentChat.type !== 'channel') {
        return false
    }

    // Используем исправленную функцию проверки прав
    const canInvite = canUserPerformAction(props.currentChat, currentUserId.value, 'invite')
    return canInvite
})

// Определяем, можно ли управлять чатом
const canManageChat = computed(() => {
    if (!props.currentChat || !currentUserId.value) {
        return false
    }

    // Управлять можно только группами и каналами
    if (props.currentChat.type !== 'group' && props.currentChat.type !== 'channel') {
        return false
    }

    // Используем исправленную функцию проверки прав
    const canEdit = canUserPerformAction(props.currentChat, currentUserId.value, 'edit')
    return canEdit
})

</script>

<style lang="scss" scoped>
.chat-icon {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    object-fit: cover;
    flex-shrink: 0;
}

.chat-icon-initials {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    background: var(--p-primary-color);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    font-weight: 600;
    flex-shrink: 0;
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

// Адаптивные стили
@media (max-width: 768px) {
    .chat-icon,
    .chat-icon-initials {
        width: 36px;
        height: 36px;
        font-size: 14px;
    }
}
</style>

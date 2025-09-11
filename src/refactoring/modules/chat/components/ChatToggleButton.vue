<template>
    <!-- Основная кнопка -->
    <Button
        :class="buttonClass"
        :icon="buttonIcon"
        :severity="buttonSeverity"
        :size="size"
        rounded
        v-tooltip.left="tooltipText"
        @click="toggleChat"
    >
        <!-- Бейдж с количеством непрочитанных сообщений -->
        <span
            v-if="unreadCount > 0"
            class="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full min-w-[1.2rem] h-5 flex items-center justify-center px-1 font-semibold shadow-lg"
            :class="{ 'animate-pulse': hasNewMessages }"
        >
            {{ unreadCount > 99 ? '99+' : unreadCount }}
        </span>
    </Button>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useChatStore } from '@/refactoring/modules/chat/stores/chatStore'

interface Props {
    /** Размер кнопки */
    size?: 'small' | 'normal' | 'large'
    /** Позиционирование кнопки */
    position?: 'fixed' | 'relative'
    /** Расположение при фиксированном позиционировании */
    placement?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
    /** Отступы от краев экрана при фиксированном позиционировании */
    offset?: { x: number; y: number }
    /** Начальный ID чата для открытия */
    initialChatId?: number | null
    /** Начальный ID пользователя для создания диалога */
    initialUserId?: string | null
    /** Ширина чата на desktop */
    chatWidth?: number
    /** Класс для кастомизации стилей */
    customClass?: string
    /** Показывать ли количество непрочитанных сообщений */
    showUnreadCount?: boolean
}

interface Emits {
    (e: 'toggle-chat', chatId?: number, userId?: string): void
}

const props = withDefaults(defineProps<Props>(), {
    size: 'normal',
    position: 'fixed',
    placement: 'bottom-right',
    offset: () => ({ x: 24, y: 24 }),
    initialChatId: null,
    initialUserId: null,
    chatWidth: 500,
    customClass: '',
    showUnreadCount: true,
})

const emit = defineEmits<Emits>()

// Хранилища
const chatStore = useChatStore()

// Состояние
const hasNewMessages = ref(false)

// Имитация непрочитанных сообщений (можно заменить на реальную логику)
const unreadCount = computed(() => {
    if (!props.showUnreadCount) return 0

    // Здесь можно добавить реальную логику подсчета непрочитанных сообщений
    // Например, из хранилища или API
    return 0 // Заглушка
})

// Вычисляемые свойства для стилей
const buttonClass = computed(() => {
    const classes = ['chat-toggle-button', 'relative']

    if (props.position === 'fixed') {
        classes.push('fixed', 'z-40')

        // Позиционирование
        switch (props.placement) {
            case 'bottom-right':
                classes.push('bottom-6', 'right-6')
                break
            case 'bottom-left':
                classes.push('bottom-6', 'left-6')
                break
            case 'top-right':
                classes.push('top-6', 'right-6')
                break
            case 'top-left':
                classes.push('top-6', 'left-6')
                break
        }
    }

    if (props.customClass) {
        classes.push(props.customClass)
    }

    return classes
})

const buttonIcon = computed(() => 'pi pi-comments')

const buttonSeverity = computed(() => (unreadCount.value > 0 ? 'warning' : 'secondary'))

const tooltipText = computed(() => {
    return unreadCount.value > 0
        ? `Открыть чат (${unreadCount.value} непрочитанных)`
        : 'Открыть чат'
})

// Обработчики событий
const toggleChat = () => {
    emit('toggle-chat', props.initialChatId || undefined, props.initialUserId || undefined)
    hasNewMessages.value = false
}
</script>

<style scoped lang="scss">

.chat-toggle-button {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transition: all 0.3s ease;

    &:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
    }

    &:active {
        transform: translateY(0);
    }
}

// Анимация для пульсации при новых сообщениях
@keyframes pulse {
    0%,
    100% {
        transform: scale(1);
    }
    50% {
        transform: scale(1.1);
    }
}


// Адаптивные размеры для кнопки
.chat-toggle-container {
    position: relative;
}

// Настройка отступов для фиксированного позиционирования
.fixed {
    z-index: 40;
}

// Дополнительные стили для позиционирования с учетом смещения
.chat-toggle-button.fixed {
    &.bottom-6 {
        bottom: v-bind('props.offset.y + "px"');
    }

    &.right-6 {
        right: v-bind('props.offset.x + "px"');
    }

    &.left-6 {
        left: v-bind('props.offset.x + "px"');
    }

    &.top-6 {
        top: v-bind('props.offset.y + "px"');
    }
}

</style>

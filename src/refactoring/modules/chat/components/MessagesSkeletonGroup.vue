<template>
    <div class="messages-skeleton-group">
        <!-- Заголовок даты -->
        <div class="text-center text-sm text-surface-500 my-2 select-none">
            <div class="skeleton-date"></div>
        </div>

        <!-- Группа скелетонов сообщений -->
        <MessageSkeleton
            v-for="(skeleton, index) in skeletons"
            :key="`skeleton-${index}`"
            :type="skeleton.type"
            :lines-count="skeleton.linesCount"
        />
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import MessageSkeleton from './MessageSkeleton.vue'

interface SkeletonMessage {
    type: 'mine' | 'theirs'
    linesCount: number
}

interface Props {
    /** Количество скелетонов для отображения */
    count?: number
}

const props = withDefaults(defineProps<Props>(), {
    count: 5,
})

// Генерируем случайную последовательность скелетонов сообщений
const skeletons = computed<SkeletonMessage[]>(() => {
    const result: SkeletonMessage[] = []

    for (let i = 0; i < props.count; i++) {
        // Чередуем типы сообщений с небольшой случайностью
        const isTheirs = Math.random() > 0.4 // 60% сообщений от собеседника
        const linesCount = Math.floor(Math.random() * 3) + 1 // 1-3 строки

        result.push({
            type: isTheirs ? 'theirs' : 'mine',
            linesCount,
        })
    }

    return result
})
</script>

<style scoped lang="scss">
.skeleton-date {
    width: 4rem;
    height: 1rem;
    background: var(--surface-300);
    border-radius: 0.5rem;
    margin: 0 auto;
    animation: pulse 1.5s ease-in-out infinite;
}

html.p-dark .skeleton-date {
    background: var(--surface-600);
}

@keyframes pulse {
    0%,
    100% {
        opacity: 1;
    }
    50% {
        opacity: 0.5;
    }
}
</style>

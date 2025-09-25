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
@use '../styles/skeletons' as *;

.skeleton-date {
    @extend .skeleton-text;
    width: 4rem;
    margin: 0 auto;
}
</style>

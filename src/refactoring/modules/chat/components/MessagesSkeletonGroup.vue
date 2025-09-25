<template>
    <div class="messages-skeleton-group">
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

// Генерируем фиксированную последовательность скелетонов сообщений, похожую на реальный чат
const skeletons = computed<SkeletonMessage[]>(() => {
    // Предопределенные паттерны для более реалистичного отображения
    const patterns: SkeletonMessage[] = [
        { type: 'theirs', linesCount: 1 },
        { type: 'theirs', linesCount: 2 },
        { type: 'mine', linesCount: 1 },
        { type: 'theirs', linesCount: 1 },
        { type: 'mine', linesCount: 2 },
        { type: 'mine', linesCount: 1 },
        { type: 'theirs', linesCount: 3 },
        { type: 'mine', linesCount: 1 },
    ]

    return patterns.slice(0, props.count)
})
</script>

<style scoped lang="scss">
@use '../styles/skeletons' as *;

.messages-skeleton-group {
    /* Стили группы скелетонов сообщений */
}
</style>

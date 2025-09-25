<template>
    <div class="chat-list-skeleton-group">
        <ChatListItemSkeleton
            v-for="index in count"
            :key="`chat-skeleton-${index}`"
        />
    </div>
</template>

<script setup lang="ts">
import ChatListItemSkeleton from './ChatListItemSkeleton.vue'

interface Props {
    /** Количество скелетонов для отображения */
    count?: number
}

const props = withDefaults(defineProps<Props>(), {
    count: 5,
})
</script>

<style scoped lang="scss">
.chat-list-skeleton-group {
    /* Стили группы если нужны */
}
</style>
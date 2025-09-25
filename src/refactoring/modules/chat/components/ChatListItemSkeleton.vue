<template>
    <div class="chat-item-skeleton">
        <div class="chat-skeleton-avatar"></div>
        <div class="chat-skeleton-content">
            <div class="chat-skeleton-header">
                <div class="chat-skeleton-title"></div>
                <div class="chat-skeleton-time"></div>
            </div>
            <div class="chat-skeleton-message"></div>
        </div>
    </div>
</template>

<script setup lang="ts">
// Простой скелетон без пропсов - одинаковый везде
</script>

<style scoped lang="scss">
@use '../styles/skeletons' as *;

.chat-item-skeleton {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--p-content-border-color);
    min-height: 64px;
    @include skeleton-animation;
}

.chat-skeleton-avatar {
    @extend .skeleton-avatar;
}

.chat-skeleton-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.chat-skeleton-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
}

.chat-skeleton-title {
    @extend .skeleton-text;
    height: 14px;
    width: 60%;
    background: var(--skeleton-bg-secondary);
}

.chat-skeleton-time {
    @extend .skeleton-text--small;
    width: 40px;
    flex-shrink: 0;
}

.chat-skeleton-message {
    @extend .skeleton-text--small;
    width: 80%;
}
</style>
<template>
    <div :class="['attachment-file-card', mine ? 'mine' : 'theirs']">
        <div class="thumb">
            <i class="pi pi-file" />
        </div>
        <div class="info">
            <div class="name" :title="name">{{ name }}</div>
            <div class="meta">
                <a :href="href" target="_blank" rel="noopener" class="open-link">Открыть</a>
            </div>
        </div>
        <div class="time-inline">{{ time }}</div>
    </div>
</template>

<script setup lang="ts">
defineProps<{ href: string; name: string; time: string; mine: boolean }>()
</script>

<style scoped>
.attachment-file-card {
    width: 300px;
    display: grid;
    grid-template-columns: 56px 1fr auto;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 14px;
}
.attachment-file-card.mine {
    background: #34d399;
    color: #0f172a;
    box-shadow: 0 2px 8px rgba(52, 211, 153, 0.3);
}
.attachment-file-card.theirs {
    background: #f1f5f9;
    color: #334155;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    border: 1px solid rgba(0, 0, 0, 0.06);
}
.attachment-file-card .thumb {
    width: 56px;
    height: 56px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
}
.attachment-file-card .info {
    min-width: 0;
}
.attachment-file-card .name {
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.attachment-file-card .meta {
    font-size: 12px;
    opacity: 0.9;
}
.attachment-file-card .open-link {
    text-decoration: underline;
}
.attachment-file-card .time-inline {
    font-size: 12px;
    opacity: 0.85;
}

/* Стили для темной темы */
:root[class*='app-dark'] .attachment-file-card.theirs {
    background: #374151;
    color: #f3f4f6;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.1);
}
</style>

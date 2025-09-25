<template>
    <div class="message-skeleton mb-6">
        <!-- Скелетон сообщения слева (от собеседника) -->
        <div class="message-skeleton-wrapper message-skeleton--theirs" v-if="type === 'theirs'">
            <div class="message-skeleton-bubble">
                <div class="message-skeleton-content py-4 px-4">
                    <div class="skeleton-text-lines">
                        <div class="skeleton-line skeleton-line--long"></div>
                        <div class="skeleton-line skeleton-line--medium" v-if="linesCount > 1"></div>
                        <div class="skeleton-line skeleton-line--short" v-if="linesCount > 2"></div>
                    </div>
                    <div class="skeleton-time"></div>
                </div>
            </div>
        </div>

        <!-- Скелетон сообщения справа (от себя) -->
        <div class="message-skeleton-wrapper message-skeleton--mine" v-else>
            <div class="message-skeleton-bubble">
                <div class="message-skeleton-content py-4 px-4">
                    <div class="skeleton-text-lines">
                        <div class="skeleton-line skeleton-line--medium"></div>
                        <div class="skeleton-line skeleton-line--long" v-if="linesCount > 1"></div>
                        <div class="skeleton-line skeleton-line--short" v-if="linesCount > 2"></div>
                    </div>
                    <div class="skeleton-time"></div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
    /** Тип сообщения: 'mine' (от себя) или 'theirs' (от собеседника) */
    type?: 'mine' | 'theirs'
    /** Количество строк текста в скелетоне */
    linesCount?: number
}

const props = withDefaults(defineProps<Props>(), {
    type: 'theirs',
    linesCount: 2,
})
</script>

<style scoped lang="scss">
.message-skeleton {
    animation: pulse 1.5s ease-in-out infinite;
}

.message-skeleton-wrapper {
    display: flex;
    margin-bottom: 1rem;
}

.message-skeleton--theirs {
    justify-content: flex-start;
    
    .message-skeleton-bubble {
        background: var(--surface-card);
        border-radius: 1rem 1rem 1rem 0.25rem;
        max-width: 70%;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    }
}

.message-skeleton--mine {
    justify-content: flex-end;
    
    .message-skeleton-bubble {
        background: var(--primary-color);
        border-radius: 1rem 1rem 0.25rem 1rem;
        max-width: 70%;
        opacity: 0.8;
    }
}

.message-skeleton-content {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.skeleton-text-lines {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.skeleton-line {
    height: 1rem;
    border-radius: 0.5rem;
    background: rgba(255, 255, 255, 0.2);
    
    &--short {
        width: 40%;
    }
    
    &--medium {
        width: 65%;
    }
    
    &--long {
        width: 85%;
    }
}

.skeleton-time {
    width: 3rem;
    height: 0.75rem;
    border-radius: 0.375rem;
    background: rgba(255, 255, 255, 0.15);
    align-self: flex-end;
    margin-top: 0.25rem;
}

@keyframes pulse {
    0%, 100% {
        opacity: 1;
    }
    50% {
        opacity: 0.5;
    }
}

/* Темная тема */
html.p-dark {
    .message-skeleton--theirs .skeleton-line,
    .message-skeleton--theirs .skeleton-time {
        background: rgba(255, 255, 255, 0.1);
    }
    
    .message-skeleton--mine .skeleton-line,
    .message-skeleton--mine .skeleton-time {
        background: rgba(255, 255, 255, 0.3);
    }
}
</style>
</template>
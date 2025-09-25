<template>
    <div class="message-skeleton mb-6">
        <!-- Скелетон сообщения слева (от собеседника) -->
        <div class="message-skeleton-wrapper message-skeleton--theirs" v-if="type === 'theirs'">
            <div class="message-skeleton-bubble">
                <div class="message-skeleton-content py-4 px-4">
                    <div class="skeleton-text-lines">
                        <div class="skeleton-line skeleton-line--long"></div>
                        <div
                            class="skeleton-line skeleton-line--medium"
                            v-if="linesCount > 1"
                        ></div>
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
@use '../styles/skeletons' as *;

.message-skeleton {
    @include skeleton-animation;
    margin-bottom: 1.5rem;
}

.message-skeleton-wrapper {
    display: flex;
    margin-bottom: 1rem;
}

.message-skeleton--theirs {
    justify-content: flex-start;

    .message-skeleton-bubble {
        @extend .skeleton-message-bubble--theirs;
    }
}

.message-skeleton--mine {
    justify-content: flex-end;

    .message-skeleton-bubble {
        @extend .skeleton-message-bubble--mine;
    }
}

.message-skeleton-content {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
}

.skeleton-text-lines {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.skeleton-line {
    @extend .skeleton-line;
}

.skeleton-time {
    @extend .skeleton-time;
    align-self: flex-end;
    margin-top: 0.25rem;
}
</style>

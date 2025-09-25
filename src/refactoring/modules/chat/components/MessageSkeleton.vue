<template>
    <div 
        :class="['message-skeleton', 'mb-6', `message-skeleton--${type}`]"
        :data-dir="type === 'mine' ? 'out' : 'in'"
    >
        <div class="message-skeleton-wrapper">
            <div class="message-skeleton-bubble">
                <div class="message-skeleton-content">
                    <div class="skeleton-content-left">
                        <div class="skeleton-text-lines">
                            <div class="skeleton-line skeleton-line--long"></div>
                            <div
                                class="skeleton-line skeleton-line--medium"
                                v-if="linesCount > 1"
                            ></div>
                            <div class="skeleton-line skeleton-line--short" v-if="linesCount > 2"></div>
                        </div>
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
    display: flex;
    color: #334155;
    max-width: 70%;
    line-height: 1.2;
    font-size: 16px;
    width: fit-content;
    @include skeleton-animation;

    &--mine {
        align-self: flex-end;
        margin-left: auto;
        flex-direction: row-reverse;
    
        .message-skeleton-bubble {
            background: rgba(5, 150, 105, 0.3) !important;
            border-radius: 16px 4px 16px 16px !important;
            box-shadow: 0 2px 8px rgba(5, 150, 105, 0.2);
        }
        
        .skeleton-line,
        .skeleton-time {
            background: rgba(255, 255, 255, 0.4) !important;
        }
    }
  
    &--theirs {
        align-self: flex-start;
        margin-right: auto;
    
        .message-skeleton-bubble {
            background: #f1f5f9 !important;
            border-radius: 4px 16px 16px 16px !important;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
            border: 1px solid rgba(0, 0, 0, 0.06);
        }
        
        .skeleton-line,
        .skeleton-time {
            background: rgba(0, 0, 0, 0.1) !important;
        }
    }
}

.message-skeleton-wrapper {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.25rem;
}

.message-skeleton-bubble {
    position: relative;
    display: block;
    width: fit-content;
    border-radius: 16px;
    @include skeleton-animation;
}

.message-skeleton-content {
    padding: 0.5rem 0.75rem;
    display: flex;
    justify-content: space-between;
    align-items: end;
    gap: 1rem;
    min-width: 120px;
}

.skeleton-content-left {
    flex: 1;
}

.skeleton-text-lines {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
}

.skeleton-line {
    @extend .skeleton-text;
    border-radius: 0.25rem;
    
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
    border-radius: 0.25rem;
    flex-shrink: 0;
    @include skeleton-animation;
}
</style>

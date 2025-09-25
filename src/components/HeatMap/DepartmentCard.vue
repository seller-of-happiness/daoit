<script setup lang="ts">
import { defineProps } from 'vue'
import RiskSquare from '@/components/HeatMap/RiskSquare.vue'

import type { ISquare } from '@/components/HeatMap/types/ISquare'

/**
 * Свойства компонента
 *
 * @property title Заголовок блока
 * @property items Массив квадратов (ISquare[])
 * @property meta Дополнительная информация (опционально)
 * @property cols Количество колонок для отображения (опционально)
 * @property squareSize Размер квадрата: 'sm' | 'md' | 'lg' (по умолчанию 'md')
 */
const props = defineProps<{
    title: string
    items: ISquare[]
    meta?: string
    cols?: number
    squareSize?: 'sm' | 'md' | 'lg'
}>()

/**
 * Заголовок блока, переданный через props
 */
const title = props.title

/**
 * Массив квадратов для отображения
 */
const items = props.items

/**
 * Размер квадрата:
 * - Берётся из props.squareSize
 * - Если не задан — используется 'md'
 */
const squareSize = props.squareSize ?? 'md'
</script>

<template>
    <section class="department-card bg-white rounded-lg p-4 shadow-md">
        <header class="department-card__header flex items-center justify-between mb-3">
            <h3 class="department-card__title text-base font-semibold">{{ title }}</h3>
            <div class="department-card__meta text-sm text-gray-500" v-if="meta">{{ meta }}</div>
        </header>

        <div class="department-card__grid">
            <div class="heatmap-flex">
                <div v-for="sq in items" :key="sq.id" class="heatmap-flex__cell">
                    <RiskSquare :square="sq" :size="squareSize" />
                </div>
            </div>
        </div>
    </section>
</template>

<style lang="scss" scoped>
.department-card {
    background: var(--surface-card);
    border-radius: 0.5rem;
    padding: 1rem;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);

    &__header { @apply items-center;}
    &__title { @apply leading-5; color: var(--text-color); margin: 0  }
    &__meta { @apply text-sm; color: var(--text-color-secondary); white-space: nowrap}
}

.heatmap-flex {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: flex-start;
    justify-content: flex-start;
}

.heatmap-flex__cell {
    width: 84px;
    height: 84px;
    flex: 0 0 auto;
}
</style>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useApiStore  } from '@/refactoring/modules/apiStore/stores/apiStore'
import { useFeedbackStore } from '@/refactoring/modules/feedback/stores/feedbackStore'

import DepartmentCard from '@/components/HeatMap/DepartmentCard.vue'

import type {IHeatMap } from '@/refactoring/modules/apiStore/types/IHeatMap'
import type { ISquare } from '@/components/HeatMap/types/ISquare'

const apiStore = useApiStore()
const feedbackStore = useFeedbackStore()

/**
 * Преобразует массив объектов в массив квадратов (ISquare)
 *
 * Последовательность действий:
 * 1. Проверяет входной массив, при `null`/`undefined` подставляет пустой
 * 2. Для каждого элемента формирует объект ISquare:
 *    - id: идентификатор объекта
 *    - risk: значение риска или null
 *    - detail: строковое описание детали (по умолчанию пустая строка)
 *    - recurrence: значение повторяемости (по умолчанию пустая строка)
 *    - label: приоритетно recurrence, иначе detail, иначе пустая строка
 * 3. Возвращает массив объектов ISquare
 *
 * @param arr Массив произвольных объектов
 * @returns ISquare[] массив квадратов
 */
const mapToSquares = (arr: Array<Record<string, any>>): ISquare[] => {
    return (arr ?? []).map((a) => ({
        id: a.id,
        risk: a.risk ?? null,
        detail: a.detail ?? '',
        recurrence: a.recurrence ?? '',
        label: a.recurrence ?? a.detail ?? '',
        description: a.description ?? ''
    }))
}

/**
 * Хук жизненного цикла `onMounted`
 *
 * Последовательность действий:
 * 1. При монтировании проверяет данные тепловой карты (heatmap) в хранилище
 * 2. Если heatmap отсутствует или пустая:
 *    - Выполняет загрузку данных через `fetchHeatmapSummary`
 * 3. Игнорирует ошибки (пустой блок catch)
 */
onMounted(async () => {
    try {
        if (!apiStore.heatmap || apiStore.heatmap.length === 0) {
            await apiStore.fetchHeatmapSummary()
        }
    } catch (e) {
    }
})
</script>

<template>
    <div class="departments-heatmap space-y-4">
        <div v-if="feedbackStore.isGlobalLoading" class="departments-heatmap__loading">Загрузка...</div>

        <div v-else class="grid gap-4 custom-grid">
            <DepartmentCard
                v-for="d in apiStore.heatmap as IHeatMap[]"
                :key="d.department"
                :title="d.department"
                :items="mapToSquares(d.adverse_events)"
                :meta="`${(d.adverse_events ?? []).length} НС`"
            />
        </div>
    </div>
</template>

<style lang="scss" scoped>
.custom-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

@media (min-width: 1400px) {
  .custom-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
</style>

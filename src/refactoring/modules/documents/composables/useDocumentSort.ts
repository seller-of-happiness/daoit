/**
 * Composable для сортировки документов
 *
 * Предоставляет логику для:
 * - Управления сортировкой документов
 * - Переключения направления сортировки
 * - Генерации CSS классов для UI
 */

import { ref, computed, type Ref } from 'vue'
import { useDocumentsStore } from '@/refactoring/modules/documents/stores/documentsStore'

export type SortField = 'name' | 'size' | 'extension' | 'updated_at' | null
export type SortOrder = 'ascending' | 'descending'

export interface SortState {
    field: SortField
    order: SortOrder
}

export function useDocumentSort() {
    const documentsStore = useDocumentsStore()

    const currentSort = ref<SortState>({
        field: null,
        order: 'ascending',
    })

    /**
     * Обрабатывает клик по заголовку колонки для сортировки
     */
    const handleSort = (field: Exclude<SortField, null>): void => {
        if (currentSort.value.field === field) {
            // Если кликнули по тому же полю, меняем порядок
            currentSort.value.order =
                currentSort.value.order === 'ascending' ? 'descending' : 'ascending'
        } else {
            // Если кликнули по новому полю, устанавливаем по возрастанию
            currentSort.value.field = field
            currentSort.value.order = 'ascending'
        }

        // Обновляем данные с новой сортировкой
        refreshDocuments()
    }

    /**
     * Обновляет документы с текущими параметрами сортировки
     */
    const refreshDocuments = async (): Promise<void> => {
        try {
            const payload: any = {}

            // Добавляем параметры сортировки, если они установлены
            if (currentSort.value.field) {
                payload.sort_by = currentSort.value.field
                payload.sort_order = currentSort.value.order
            }

            // Используем новый метод принудительного обновления
            await documentsStore.forceRefreshDocuments(payload)
        } catch (error) {}
    }

    /**
     * Сбрасывает сортировку
     */
    const resetSort = (): void => {
        currentSort.value = {
            field: null,
            order: 'ascending',
        }
    }

    /**
     * Получает CSS класс для кнопки сортировки
     */
    const getSortButtonClass = (field: string) => {
        return {
            'sort-active': currentSort.value.field === field,
        }
    }

    /**
     * Получает CSS класс для иконки сортировки
     */
    const getSortIconClass = (field: string) => {
        if (currentSort.value.field !== field) {
            return 'pi pi-sort-alt text-surface-400'
        }

        return currentSort.value.order === 'ascending'
            ? 'pi pi-sort-up text-primary'
            : 'pi pi-sort-down text-primary'
    }

    /**
     * Проверяет, активна ли сортировка по полю
     */
    const isSortActive = (field: string): boolean => {
        return currentSort.value.field === field
    }

    /**
     * Получает направление сортировки для поля
     */
    const getSortOrder = (field: string): SortOrder | null => {
        return currentSort.value.field === field ? currentSort.value.order : null
    }

    /**
     * Устанавливает сортировку программно
     */
    const setSort = (field: SortField, order: SortOrder = 'ascending'): void => {
        currentSort.value = { field, order }
    }

    /**
     * Текущее поле сортировки
     */
    const sortField = computed(() => currentSort.value.field)

    /**
     * Текущий порядок сортировки
     */
    const sortOrder = computed(() => currentSort.value.order)

    /**
     * Есть ли активная сортировка
     */
    const hasActiveSort = computed(() => currentSort.value.field !== null)

    return {
        // Состояние
        currentSort: currentSort as Ref<SortState>,

        // Вычисляемые свойства
        sortField,
        sortOrder,
        hasActiveSort,

        // Методы
        handleSort,
        refreshDocuments,
        resetSort,
        setSort,

        // UI утилиты
        getSortButtonClass,
        getSortIconClass,
        isSortActive,
        getSortOrder,
    }
}

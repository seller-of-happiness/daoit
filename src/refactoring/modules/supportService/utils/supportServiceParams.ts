import { toApiDate } from '@/refactoring/utils/formatters'
import type { ISupportServiceFilters } from '@/refactoring/modules/supportService/types/ISupportServiceFilters'

// Генерация параметров фильтрации для ВС.

export const getSupportServiceParams = (
    filters: ISupportServiceFilters,
    cursor?: string,
): Record<string, string | number | boolean | undefined> => {
    const params: Record<string, string | number | boolean | undefined> = {}

    // Всегда множественное число для фильтров-массивов
    if (filters.group.length) params.groups = filters.group.join(',')
    if (filters.category.length) params.categories = filters.category.join(',')
    if (filters.department.length) params.departments = filters.department.join(',')
    if (filters.manager.length) params.managers = filters.manager.join(',')

    // Остальные параметры
    if (filters.number !== null) params.number = filters.number
    if (filters.search) params.search = filters.search

    // Даты
    if (filters.created_after) {
        const createdAfter = toApiDate(filters.created_after)
        if (createdAfter) params.created_after = createdAfter
    }
    if (filters.created_before) {
        const createdBefore = toApiDate(filters.created_before)
        if (createdBefore) params.created_before = createdBefore
    }

    // Флаги
    if (filters.is_active !== undefined) params.is_active = filters.is_active

    // Пагинация
    if (cursor) params.cursor = cursor

    return params
}

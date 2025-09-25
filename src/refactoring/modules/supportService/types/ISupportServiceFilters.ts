// Типизация фильтров для ВС
export interface ISupportServiceFilters {
    group: number[]             // id группы ВС
    category: number[]          // id категорий работ
    department: number[]        // id подразделений
    manager: number[]           // id постановщиков
    search: string              // общий поисковый запрос (description + cause)
    number: number | null       // номер заявки
    created_after: Date | null  // фильтр по дате
    created_before: Date | null // фильтр по дате
    is_active?: boolean
}

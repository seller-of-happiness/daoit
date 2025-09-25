export interface IFilters {
    department: string[]        // выбранные id отделений
    event_type: number[]         // выбранные id “видов НС”
    category: number[]          // выбранные id категорий НС
    search: string              // общий поисковый запрос (description + cause)
    number: number | null       // для фильтрации по номеру НС
    created_after: Date | null  // для фильтрации по дате
    created_before: Date | null // для фильтрации по дате
    is_active?: boolean         // для фильтрации по персональным активным НС
    is_high_risk?: boolean      // для фильтрации по высокому риску
}

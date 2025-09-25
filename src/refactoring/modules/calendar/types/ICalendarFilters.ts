export interface ICalendarFilters {
    type?: number[]
    timezone?: string[]
    is_public?: boolean
    created_after?: string | null
    created_before?: string | null
}

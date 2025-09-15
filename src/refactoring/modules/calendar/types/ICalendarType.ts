export interface ICalendarType {
    id: number
    name: string
    code: string
    description?: string
    default_settings?: string | Record<string, unknown>
    created_at?: string
    updated_at?: string
}

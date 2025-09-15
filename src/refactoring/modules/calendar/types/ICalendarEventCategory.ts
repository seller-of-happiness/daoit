export interface ICalendarEventCategory {
    id: number
    name: string
    color: string
    calendar_type: {
        id: number
        name?: string
    }
}

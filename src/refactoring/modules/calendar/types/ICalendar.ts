import type { ICalendarSetting } from '@/refactoring/modules/calendar/types/ICalendarSetting'

export interface ICalendar {
    id: number
    name: string
    description?: string
    type: {
        id: number
        name?: string
    }
    color: string
    is_public: boolean
    timezone?: string
    created_by?: number
    updated_at?: string
    settings?: ICalendarSetting[]
}

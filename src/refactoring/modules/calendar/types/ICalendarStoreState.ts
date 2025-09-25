import type { ICalendar } from '@/refactoring/modules/calendar/types/ICalendar'
import type { ICalendarType } from '@/refactoring/modules/calendar/types/ICalendarType'
import type { ICalendarEventCategory } from '@/refactoring/modules/calendar/types/ICalendarEventCategory'
import type { ICalendarFilters } from '@/refactoring/modules/calendar/types/ICalendarFilters'
import type { ICalendarEvent } from '@/refactoring/modules/calendar/types/ICalendarEvent'

export interface ICalendarStoreState {
    nextCalendarCursor: string | null
    calendars: ICalendar[]
    calendarTypes: ICalendarType[]
    calendarEventCategories: ICalendarEventCategory[]
    filters: ICalendarFilters
    currentCalendar: ICalendar | null
    currentCalendarEvent: ICalendarEvent
    isShowFormCalendar: boolean
    isViewMode: boolean
}

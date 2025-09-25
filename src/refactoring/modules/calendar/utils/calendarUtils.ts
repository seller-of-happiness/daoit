/**
 * Утилиты для работы с календарями
 */

import type { ICalendar } from '@/refactoring/modules/calendar/types/ICalendar'

/**
 * Получает значение настройки календаря
 * @param calendar - Календарь
 * @param settingName - Название настройки
 * @returns Значение настройки или null если не найдено
 */
export function getCalendarSetting(
    calendar: ICalendar,
    settingName: string
): string | null {
    if (!calendar.settings) return null

    const setting = calendar.settings.find(s => s.setting_name === settingName)
    return setting ? setting.setting_value : null
}

/**
 * Форматирует дату для отображения
 * @param dateString - Строка с датой
 * @returns Отформатированная дата
 */
export function formatCalendarDate(dateString: string): string {
    const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }

    return new Date(dateString).toLocaleDateString('ru-RU', options)
}

/**
 * Проверяет, является ли календарь публичным
 * @param calendar - Календарь
 * @returns true если календарь публичный
 */
export function isPublicCalendar(calendar: ICalendar): boolean {
    return calendar.is_public
}

/**
 * Функция-хелпер для проверки возможности редактирования однодневного события
 *
 * Назначение:
 * - Определяет, является ли событие однодневным и доступно ли для редактирования
 * - Используется для управления UI (стили, доступность действий)
 *
 * Параметры:
 * @param {ICalendarEvent | EventImpl} event - Объект события (из API или FullCalendar)
 * @param {(e: any) => boolean} checkEdit - Функция проверки прав редактирования из хранилища
 *
 * Возвращает:
 * @returns {boolean} - true если событие:
 *   - Длится не более одного дня
 *   - Пользователь имеет права на редактирование
 *
 * Особенности работы:
 * 1. Обрабатывает два формата событий:
 *    - ICalendarEvent (из API)
 *    - EventImpl (из FullCalendar)
 * 2. Для API событий:
 *    - Парсит даты из строковых полей start_datetime/end_datetime
 *    - Проверяет права через переданную функцию checkEdit
 * 3. Для событий FullCalendar:
 *    - Использует готовые Date объекты
 *    - Проверяет права через extendedProps
 * 4. Сравнивает даты начала и окончания (без учета времени)
 *
 * Примеры использования:
 * - Определение стилей события в календаре
 * - Проверка перед разрешением перетаскивания
 * - Валидация при изменении длительности
 */

import { ICalendarEvent } from '@/refactoring/modules/calendar/types/ICalendarEvent'
import { EventImpl } from '@fullcalendar/core/internal'

export function isSingleDayEditable(event: ICalendarEvent | EventImpl, checkEdit: (e: any) => boolean): boolean {
    let start: Date
    let end: Date
    let canEdit: boolean

    // Обработка формата ICalendarEvent (из API)
    if ('start_datetime' in event) {
        start = new Date(event.start_datetime)
        end = event.end_datetime ? new Date(event.end_datetime) : start
        canEdit = checkEdit(event)

        // Обработка формата EventImpl (из FullCalendar)
    } else {
        start = event.start!
        end = event.end || start
        canEdit = checkEdit(event.extendedProps)
    }

    return canEdit && start.toDateString() === end.toDateString()
}

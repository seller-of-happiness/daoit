<script setup lang="ts">
/*
 * Компонент-обертка над FullCalendar для отображения событий
 *
 * Основные функции:
 * - Отображение событий в различных видах (день/неделя/месяц)
 * - Перетаскивание и изменение дат событий
 * - Обработка кликов по событиям и датам
 * - Создание новых событий через выделение периода
 * - Кастомизация внешнего вида и поведения календаря
 *
 * Особенности:
 * - Поддержка русского языка
 * - Кастомные стили для событий
 * - Разделение редактируемых и нередактируемых событий
 * - Интеграция с хранилищами Pinia
 * - Гибкая настройка через props
 *
 * Используемые хранилища:
 * - feedbackStore: для показа уведомлений
 * - calendarStore: для работы с событиями календаря
 *
 * Плагины FullCalendar:
 * - dayGridPlugin: отображение по дням/неделям/месяцам
 * - timeGridPlugin: вид по времени
 * - interactionPlugin: перетаскивание и выделение
 */

// Импорты Vue и сторонних библиотек
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import ruLocale from '@fullcalendar/core/locales/ru'

// Импорты хранилищ Pinia
import { useFeedbackStore } from '@/refactoring/modules/feedback/stores/feedbackStore'
import { useCalendarStore } from '@/refactoring/modules/calendar/stores/calendarStore'

// Вспомогательные функции и типы
import { isSingleDayEditable } from "@/refactoring/utils/isSingleDayEditable"
import type { ICalendarEvent } from '@/refactoring/modules/calendar/types/ICalendarEvent'
import type { CalendarOptions, EventDropArg, EventInput } from '@fullcalendar/core'

const feedbackStore = useFeedbackStore()
const calendarStore = useCalendarStore()
const route = useRoute()


/**
 * Определение кастомных событий компонента
 * - date-click: клик по конкретной дате
 * - event-click: клик по событию
 * - select: выделение диапазона дат
 * - create-event: запрос на создание нового события
 */
const emit = defineEmits<{
    (e: 'date-click', payload: string): void
    (e: 'event-click', payload: ICalendarEvent): void
    (e: 'select', payload: { start: string; end: string }): void
    (e: 'create-event'): void
}>()

/**
 * Обрабатывает перетаскивание события в календаре
 * - Проверяет валидность дат начала/окончания
 * - Отменяет действие для многодневных событий
 * - Формирует обновленный объект события
 * - Отправляет изменения на сервер через calendarStore
 * - В случае ошибки возвращает событие на место
 * - Показывает соответствующие уведомления
 */
const handleEventDrop = async (info: EventDropArg) => {
    const start = info.event.start
    const end = info.event.end || start

    if (!start || !end) {
        // На всякий случай, если нет даты — откатываем и предупреждаем
        info.revert()
        feedbackStore.showToast({
            type: 'error',
            title: 'Ошибка',
            message: 'Невозможно получить дату события',
            time: 7000,
        })
        return
    }

    if (!isSingleDayEditable(info.event, calendarStore.checkEditPermission)) {
        info.revert()
        feedbackStore.showToast({
            type: 'warn',
            title: 'Нельзя перемещать многодневные события',
            message: '',
            time: 7000
        })
        return
    }

    try {
        const calendarId = Number(route.params.id)
        const eventId = Number(info.event.id)

        const updatedEvent: ICalendarEvent = {
            ...info.event.extendedProps,
            id: Number(info.event.id),
            name: info.event.title,
            start_datetime: start.toISOString(),
            end_datetime: end.toISOString(),
            is_all_day: info.event.allDay,
            categories: info.event.extendedProps.categories || [],       // обязательно
            priority: info.event.extendedProps.priority || 'low',        // по дефолту
            status: info.event.extendedProps.status || 'planned',        // по дефолту
            participants: info.event.extendedProps.participants || [],   // обязательно
        }

        await calendarStore.updateCalendarEvent(calendarId, eventId, updatedEvent)
        feedbackStore.showToast({
            type: 'success',
            title: 'Событие обновлено',
            message: '',
            time: 3000
        })
    } catch (err) {
        info.revert()
        feedbackStore.showToast({
            type: 'error',
            title: 'Ошибка при обновлении события',
            message: '',
            time: 5000
        })
    }
}

/**
 * Пропсы компонента для кастомизации календаря
 * - events: массив событий для отображения
 * - initialView: начальный вид (dayGridMonth/timeGridWeek/timeGridDay)
 * - editable: разрешено ли редактирование
 * - selectable: разрешено ли выделение периодов
 * - headerToolbar: настройки панели инструментов
 * - height: высота календаря
 * - weekends: показывать ли выходные
 * - nowIndicator: показывать ли индикатор текущего времени
 * - initialDate: начальная дата отображения
 * - locale: локаль (язык)
 * - timeZone: временная зона
 * - eventColor: цвет событий
 * - eventTextColor: цвет текста событий
 */
interface IProps {
    events?: EventInput[]
    initialView?: string
    editable?: boolean
    selectable?: boolean
    headerToolbar?: {
        left?: string
        center?: string
        right?: string
    }
    height?: string | number
    weekends?: boolean
    nowIndicator?: boolean
    initialDate?: Date | string
    locale?: string
    timeZone?: string
    eventColor?: string
    eventTextColor?: string
}

const props = withDefaults(defineProps<IProps>(), {
    events: () => [],
    initialView: 'dayGridMonth',
    editable: true,
    selectable: true,
    headerToolbar: () => ({
        left: 'prev,next today myCustomButton',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,timeGridDay'
    }),
    height: 'auto',
    weekends: true,
    nowIndicator: true,
    initialDate: new Date().toISOString(),
    locale: 'ru',
    timeZone: 'local',
    eventColor: '',
    eventTextColor: ''
})

/**
 * Реактивные переменные компонента
 * - calendarRef: ссылка на экземпляр FullCalendar
 * - calendarOptions: конфигурационные опции календаря
 */
const calendarRef = ref()
const calendarOptions = ref<CalendarOptions>({
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
    initialView: props.initialView,
    headerToolbar: props.headerToolbar,
    height: props.height,
    editable: props.editable,
    selectable: props.selectable,
    weekends: props.weekends,
    nowIndicator: props.nowIndicator,
    initialDate: props.initialDate,
    locale: props.locale,
    locales: [ruLocale],
    timeZone: props.timeZone,
    events: props.events,
    eventColor: props.eventColor,
    eventTextColor: props.eventTextColor,
    customButtons: {
        myCustomButton: {
            text: 'Создать Событие Календаря',
            click: () => {
                emit('create-event')
            }
        }
    },
    buttonText: {
        today: 'Сегодня',
        month: 'Месяц',
        week: 'Неделя',
        day: 'День'
    },
    allDayText: 'Весь день',
    moreLinkText: 'ещё',
    noEventsText: 'Нет событий для отображения',
    dateClick: (arg) => emit('date-click', arg.dateStr),
    eventClick: (arg) => {
        const convertedEvent: ICalendarEvent = {
            id: Number(arg.event.id),
            name: arg.event.title,
            start_datetime: arg.event.startStr,
            end_datetime: arg.event.endStr,
            is_all_day: arg.event.allDay,
            categories: arg.event.extendedProps.categories || [],
            priority: arg.event.extendedProps.priority || 'low',
            location: arg.event.extendedProps.location || '',
            description: arg.event.extendedProps.description || '',
            participants: [],
            status: arg.event.extendedProps.status || 'planned',
            created_by: Number(arg.event.extendedProps.created_by)
        }
        emit('event-click', convertedEvent)
    },
    eventDrop: handleEventDrop,
    select: (arg) => emit('select', {
        start: arg.startStr,
        end: arg.endStr
    }),
    eventDragStart: () => {
        document.documentElement.classList.add('grabbing')
    },

    eventDragStop: () => {
        document.documentElement.classList.remove('grabbing')
    },
})

/**
 * Вотчер для обновления конфигурации при изменении пропсов
 * - Реагирует на все изменения в props
 * - Обновляет calendarOptions при изменении любых параметров
 * - Обеспечивает реактивность настроек календаря
 */
watch(props, (newProps) => {
    calendarOptions.value = {
        ...calendarOptions.value,
        initialView: newProps.initialView,
        headerToolbar: newProps.headerToolbar,
        height: newProps.height,
        editable: newProps.editable,
        selectable: newProps.selectable,
        weekends: newProps.weekends,
        nowIndicator: newProps.nowIndicator,
        initialDate: newProps.initialDate,
        locale: newProps.locale,
        timeZone: newProps.timeZone,
        events: newProps.events,
        eventColor: newProps.eventColor,
        eventTextColor: newProps.eventTextColor
    }
})



/**
 * Экспоз методов API календаря для родительского компонента
 * - getCalendarApi: возвращает API FullCalendar
 * - Позволяет управлять календарем извне
 */
defineExpose({
    getCalendarApi: () => calendarRef.value?.getApi()
})
</script>

<template>
    <FullCalendar
        ref="calendarRef"
        :options="calendarOptions"
        class="calendar-container"
    />
</template>

<style>
.calendar-container {
    width: 100%;
    height: 100%;
    min-height: 600px;
    font-family: inherit;
}

.fc-event-title {
    white-space: normal !important;
    overflow-wrap: anywhere;
    word-break: break-word;
}

.fc .fc-button-group {
    gap: 8px
}

.fc-myCustomButton-button {
    background: var(--primary-color) !important;
}

/* Нередактируемые события — курсор pointer */
.fc-event.noneditable-event {
    cursor: pointer;
}

/* Редактируемые события — курсор pointer (обычный) */
.fc-event.editable-event {
    cursor: pointer;
}

/* При наведении на редактируемое событие — курсор "рука" (grab) */
.fc-event.editable-event:hover {
    cursor: pointer;
}

/* Во время нажатия и перетаскивания (удержания) — курсор "сжатая рука" (grabbing) */
html.grabbing,
html.grabbing * {
    cursor: grabbing !important;
}

.fc-daygrid-day-number {
    position: relative;
    padding-left: 24px;
    cursor: pointer;
}

.fc-daygrid-day:has(.editable-event) .fc-daygrid-day-number::before {
    content: "";
    position: absolute;
    left: -15px;
    top: 3px;
    width: 14px;
    height: 14px;
    background-repeat: no-repeat;
    background-size: contain;
    pointer-events: none;
    user-select: none;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' fill='%2334D399' viewBox='0 0 512 512'><path fill-rule='currentColor' d='M332.649 72.558c5.869 6.101 5.681 15.806-.421 21.675-6.101 5.868-15.806 5.68-21.675-.421l-38.878-40.213v187.336h187.253l-33.908-32.656c-6.101-5.869-6.29-15.574-.421-21.676 5.869-6.101 15.574-6.289 21.675-.42l61.445 59.19c5.868 6.101 5.68 15.807-.421 21.675l-67.856 65.601c-6.101 5.869-15.806 5.681-21.675-.421-5.868-6.101-5.68-15.806.421-21.675l40.213-38.878H271.675v186.726l38.878-40.213c5.869-6.101 15.574-6.289 21.675-.421 6.102 5.869 6.29 15.574.421 21.675l-65.601 67.856c-5.868 6.101-15.574 6.289-21.675.421l-66.022-68.277c-5.869-6.101-5.681-15.806.421-21.675 6.101-5.868 15.806-5.68 21.675.421l39.488 40.846V271.675H53.599l40.213 38.878c6.101 5.869 6.289 15.574.421 21.675-5.869 6.102-15.574 6.29-21.675.421L4.702 267.048c-6.101-5.868-6.289-15.574-.421-21.675l68.277-66.022c6.101-5.869 15.806-5.681 21.675.421 5.868 6.101 5.68 15.806-.421 21.675l-40.846 39.488h187.969V52.966l-39.488 40.846c-5.869 6.101-15.574 6.289-21.675.421-6.102-5.869-6.29-15.574-.421-21.675l66.022-68.277c6.101-5.868 15.807-5.68 21.675.421l65.601 67.856z'/></svg>");
}
</style>

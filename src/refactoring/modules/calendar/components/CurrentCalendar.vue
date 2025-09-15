<script setup lang="ts">
/*
 * Компонент для отображения и управления календарем событий
 *
 * Основные функции:
 * - Загрузка и отображение календаря по ID
 * - Преобразование событий для FullCalendar
 * - Обработка кликов по событиям (просмотр/редактирование)
 * - Создание новых событий
 * - Выделение диапазона дат для создания события
 *
 * Особенности:
 * - Разные стили для редактируемых и нередактируемых событий
 * - Проверка прав на редактирование
 * - Поддержка публичных и приватных календарей
 *
 * Используемые хранилища:
 * - calendarStore: управление данными календаря и событий
 * - feedbackStore: обработка ошибок и уведомлений
 * - apiStore: доступ к данным больницы
 *
 * Подключенные компоненты:
 * - CalendarComponent: основной компонент FullCalendar
 */


// Импорты Vue и сторонних библиотек
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

// Импорты хранилищ Pinia
import { useCalendarStore } from '@/refactoring/modules/calendar/stores/calendarStore'
import { useFeedbackStore } from '@/refactoring/modules/feedback/stores/feedbackStore'
import { useApiStore } from '@/refactoring/modules/apiStore/stores/apiStore'

// Вспомогательные функции и типы
import { ERouteNames } from "@/router/ERouteNames"
import { formatCalendarDate, isPublicCalendar } from '@/refactoring/modules/calendar/utils/calendarUtils'
import { isSingleDayEditable } from "@/refactoring/utils/isSingleDayEditable"
import type { ICalendar } from '@/refactoring/modules/calendar/types/ICalendar'
import type { ICalendarEvent } from "@/refactoring/modules/calendar/types/ICalendarEvent"
import type { EventInput } from '@fullcalendar/core'

// Импорты дочерних компонентов
import CalendarComponent from "@/refactoring/modules/calendar/components/CalendarComponent.vue"

// Инициализация хранилищ и роутера
const route = useRoute()
const router = useRouter()
const calendarStore = useCalendarStore()
const feedbackStore = useFeedbackStore()
const apiStore = useApiStore()

// Реактивные переменные компонента
const calendar = ref<ICalendar | null>(null) // Текущий загруженный календарь
const calendarEvents = ref<EventInput[]>([]) // События календаря в формате FullCalendar


/**
 * Преобразует массив событий из формата API в формат FullCalendar
 * - Проверяет права на редактирование через isSingleDayEditable
 * - Маппит поля API (name -> title, start_datetime -> start и т.д.)
 * - Сохраняет технические данные (id, calendarId) для дальнейшей работы
 * - Добавляет классы CSS для визуального различия редактируемых событий
 * - Переносит дополнительные данные (комнаты, этажи) в extendedProps
 * - Форматирует приоритет в числовой формат (high=2, medium=1, low=0)
 */
function transformEvents(apiEvents: any[]): EventInput[] {

    return apiEvents.map(event => {
        const canEdit = isSingleDayEditable(event, calendarStore.checkEditPermission)

        return {
            id: event.id,
            title: event.name, // Для FullCalendar используем title
            start: event.start_datetime,
            end: event.end_datetime,
            allDay: event.is_all_day,
            calendarId: Number(route.params.id),
            categories: event.categories.map((c: any) => c.id),
            priority: event.priority === 'high' ? 2 : event.priority === 'medium' ? 1 : 0,
            location: event.location || '',
            description: event.description || '',
            extendedProps: {
                status: event.status,
                room: event.room,
                block: event.block,
                floor: event.floor,
                created_by: event.created_by
            },
            editable: canEdit,
            classNames: canEdit ? ['editable-event'] : ['noneditable-event'],
        }
    })
}

/**
 * Watch-функция для отслеживания изменения ID календаря в URL
 * - Реагирует на изменение параметра id в маршруте
 * - Автоматически загружает новые данные календаря при изменении ID
 * - Использует асинхронный вызов loadCalendarData
 * - Не требует ручного вызова, работает автоматически
 * - Важно для корректной работы при прямом переходе между календарями
 */
watch(
    () => route.params.id,
    async () => await loadCalendarData()
)

/**
 * Загружает данные календаря и связанные события
 * - Получает ID календаря из параметров роута
 * - Загружает категории календаря через calendarStore
 * - Получает основную информацию о календаре
 * - Загружает список событий и преобразует их для отображения
 * - Обрабатывает ошибки загрузки, показывает уведомления
 * - Обновляет реактивные переменные компонента
 */
async function loadCalendarData() {
    try {
        const calendarId = Number(route.params.id)
        if (isNaN(calendarId)) return

        await calendarStore.fetchCalendarCategoryById(calendarId)

        await calendarStore.fetchCalendarById(calendarId)
        calendar.value = calendarStore.currentCalendar

        const events = await calendarStore.fetchCalendarEvents(calendarId)
        calendarEvents.value = transformEvents(events)
    } catch (error) {
        feedbackStore.showToast({
            type: 'error',
            title: 'Ошибка',
            message: 'Не удалось загрузить данные календаря',
            time: 7000
        })
    }
}

/**
 * Обрабатывает клик пользователя по событию в календаре
 * - Определяет режим просмотра (isViewMode) на основе прав доступа
 * - Устанавливает флаги в calendarStore для отображения формы
 * - Перенаправляет на соответствующий маршрут:
 *   - EDIT_CALENDAR_EVENT при наличии прав
 *   - VIEW_CALENDAR_EVENT в режиме только для чтения
 * - Сохраняет ID календаря и события в параметрах роута
 */
async function handleEventClick(event: ICalendarEvent) {
    const calendarId = route.params.id
    const isEditAllowed = calendarStore.checkEditPermission(event)

    calendarStore.isViewMode = !isEditAllowed
    calendarStore.isShowFormCalendar = true

    await router.push({
        name: isEditAllowed
            ? ERouteNames.EDIT_CALENDAR_EVENT
            : ERouteNames.VIEW_CALENDAR_EVENT,
        params: {
            calendarId,
            eventId: event.id
        }
    })
}

/**
 * Обрабатывает выделение диапазона дат в календаре
 * - Используется при создании нового события через выделение области
 * - Сбрасывает текущее событие в хранилище
 * - Устанавливает выбранные даты (start/end) в хранилище
 * - Активирует флаг отображения формы создания события
 * - Не выполняет навигацию - форма открывается в модальном окне
 */
function handleSelect(range: { start: string; end: string }) {
    calendarStore.resetCurrentEvent()
    calendarStore.$patch({
        currentCalendarEvent: {
            ...calendarStore.currentCalendarEvent,
            start_datetime: range.start,
            end_datetime: range.end
        }
    })
    calendarStore.isShowFormCalendar = true
}

/**
 * Инициирует процесс создания нового события
 * - Сбрасывает текущее событие в хранилище
 * - Перенаправляет на маршрут CREATE_CALENDAR_EVENT
 * - Устанавливает ID календаря из параметров роута
 * - Активирует флаг отображения формы isShowFormCalendar
 * - В отличие от handleSelect, не устанавливает начальные даты
 */
function handleCreateEvent() {
    const calendarId = route.params.id
    router.push({
        name: ERouteNames.CREATE_CALENDAR_EVENT,
        params: { calendarId }
    })
    calendarStore.isShowFormCalendar = true
}

/**
 * Хук жизненного цикла onMounted
 * - Выполняется однократно после монтирования компонента
 * - Загружает начальные данные календаря через loadCalendarData
 * - Дополнительно загружает структуру больницы через apiStore
 * - Обеспечивает полную инициализацию компонента при первом открытии
 * - Обрабатывает случаи, когда загрузка данных занимает время
 */
onMounted(async () => {
    await loadCalendarData()
    if (!apiStore.hospitalSkeleton?.length) {
        await apiStore.fetchHospitalSkeleton()
    }
})
</script>

<template>
    <div class="current-calendar">
        <div v-if="feedbackStore.isGlobalLoading && !calendar" class="text-center py-8">
            Загрузка календаря...
        </div>

        <template v-else-if="calendar">
            <div class="mb-6">
                <div class="flex items-center">
                    <div
                        class="w-4 h-4 rounded-full mr-3"
                        :style="{ backgroundColor: calendar.color }"
                    />
                    <h2 class="text-2xl font-bold">
                        {{ calendar.name }}
                    </h2>
                </div>
                <p class="text-gray-600 mt-1">{{ calendar.description }}</p>
                <p class="text-sm text-gray-500 mt-2">
                    Обновлено: {{ formatCalendarDate(calendar.updated_at || new Date().toISOString()) }} |
                    {{ isPublicCalendar(calendar) ? 'Публичный' : 'Приватный' }}
                </p>
            </div>

            <div class="card p-4">
                <CalendarComponent
                    :events="calendarEvents"
                    :initial-view="'dayGridMonth'"
                    :editable="true"
                    :selectable="true"
                    :event-color="calendar.color"
                    @event-click="handleEventClick"
                    @select="handleSelect"
                    @create-event="handleCreateEvent"
                />
            </div>
        </template>

        <div v-else class="text-center py-8">
            <h3 class="text-lg font-semibold mb-2">Календарь не найден</h3>
            <p class="text-gray-500">Пожалуйста, выберите существующий календарь</p>
        </div>
    </div>
</template>


/*
 * Хранилище для работы с календарями
 *
 * Основные функции:
 * - Управление календарями (создание, редактирование, удаление)
 * - Управление типами календарей и категориями событий
 * - Фильтрация и пагинация списка календарей
 *
 * Особенности:
 * - Поддерживает пагинацию через cursor-based навигацию
 * - Интегрируется с системой уведомлений и логгирования
 * - Управляет состоянием загрузки через feedbackStore
 */

import axios from 'axios'
import { defineStore } from 'pinia'
import { BASE_URL } from '@/refactoring/environment/environment'
import { logger } from '@/refactoring/utils/eventLogger'
import { useFeedbackStore } from '@/refactoring/modules/feedback/stores/feedbackStore'
import { useUserStore } from "@/refactoring/modules/user/stores/userStore";

import type { ICalendarStoreState } from '@/refactoring/modules/calendar/types/ICalendarStoreState'
import type { ICalendar } from '@/refactoring/modules/calendar/types/ICalendar'
import type { ICalendarType } from '@/refactoring/modules/calendar/types/ICalendarType'
import type { ICalendarEventCategory } from '@/refactoring/modules/calendar/types/ICalendarEventCategory'
import type { ICalendarEvent } from '@/refactoring/modules/calendar/types/ICalendarEvent'

export const useCalendarStore = defineStore('calendarStore', {
    state: (): ICalendarStoreState => ({
        nextCalendarCursor: null,
        calendars: [],
        calendarTypes: [],
        calendarEventCategories: [],
        filters: {},
        currentCalendar: null,
        isViewMode: false,
        currentCalendarEvent: {
            name: '',
            start_datetime: '',
            end_datetime: '',
            is_all_day: false,
            categories: [],
            priority: 'low',
            status: 'planned',
            participants: [],
            location: '',
            block: null,
            floor: null,
            room: null,
        } as ICalendarEvent,
        isShowFormCalendar: false
    }),
    actions: {
        /**
         * Загружает список календарей с возможностью фильтрации
         * @param {string} [cursor] - Курсор для пагинации
         */
        async fetchCalendars(cursor?: string): Promise<void> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true

            try {
                const params = this.getFilterParams()
                if (cursor) params.cursor = cursor

                const response = await axios.get(`${BASE_URL}/api/calendar/calendar/`, { params })

                this.calendars = cursor
                    ? [...this.calendars, ...response.data.results]
                    : response.data.results

                this.nextCalendarCursor = response.data.next
            } catch (error) {
                logger.error('fetchCalendars_error', {
                    file: 'calendarStore',
                    function: 'fetchCalendars',
                    condition: `❌ Ошибка загрузки календарей: ${error}`,
                })
                feedbackStore.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: `Не удалось загрузить календари: ${error}`,
                    time: 7000,
                })
                throw error
            } finally {
                feedbackStore.isGlobalLoading = false
            }
        },

        /**
         * Создает новый календарь
         * @param {Omit<ICalendar, 'id' | 'updated_at'>} payload - Данные для создания календаря
         */
        async createCalendar(payload: Omit<ICalendar, 'id' | 'updated_at'>): Promise<ICalendar> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true

            try {
                const response = await axios.post(`${BASE_URL}/api/calendar/calendar/`, payload)

                feedbackStore.showToast({
                    type: 'success',
                    title: 'Успех',
                    message: 'Календарь успешно создан',
                    time: 7000,
                })

                await this.fetchCalendars()
                return response.data
            } catch (error) {
                logger.error('createCalendar_error', {
                    file: 'calendarStore',
                    function: 'createCalendar',
                    condition: `❌ Ошибка создания календаря: ${error}`,
                })
                feedbackStore.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: `Не удалось создать календарь: ${error}`,
                    time: 7000,
                })
                throw error
            } finally {
                feedbackStore.isGlobalLoading = false
            }
        },

        /**
         * Удаляет календарь по ID
         * @param {number} id - ID календаря
         */
        async deleteCalendar(id: number): Promise<void> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true

            try {
                await axios.delete(`${BASE_URL}/api/calendar/calendar/${id}/`)

                feedbackStore.showToast({
                    type: 'success',
                    title: 'Успех',
                    message: 'Календарь успешно удален',
                    time: 7000,
                })

                await this.fetchCalendars()
            } catch (error) {
                logger.error('deleteCalendar_error', {
                    file: 'calendarStore',
                    function: 'deleteCalendar',
                    condition: `❌ Ошибка удаления календаря: ${error}`,
                })
                feedbackStore.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: `Не удалось удалить календарь: ${error}`,
                    time: 7000,
                })
                throw error
            } finally {
                feedbackStore.isGlobalLoading = false
            }
        },

        /**
         * Загружает календарь по ID
         * @param {number} id - ID календаря
         */
        async fetchCalendarById(id: number): Promise<void> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true

            try {
                const response = await axios.get(`${BASE_URL}/api/calendar/calendar/${id}/`)
                this.currentCalendar = response.data
            } catch (error) {
                logger.error('fetchCalendarById_error', {
                    file: 'calendarStore',
                    function: 'fetchCalendarById',
                    condition: `❌ Ошибка загрузки календаря: ${error}`,
                })
                feedbackStore.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: `Не удалось загрузить календарь: ${error}`,
                    time: 7000,
                })
                throw error
            } finally {
                feedbackStore.isGlobalLoading = false
            }
        },

        /**
         * Загружает список типов календарей
         */
        async fetchCalendarTypes(): Promise<void> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true

            try {
                const response = await axios.get(`${BASE_URL}/api/calendar/calendar-type/`)
                this.calendarTypes = response.data.results
            } catch (error) {
                logger.error('fetchCalendarTypes_error', {
                    file: 'calendarStore',
                    function: 'fetchCalendarTypes',
                    condition: `❌ Ошибка загрузки типов календарей: ${error}`,
                })
                feedbackStore.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: `Не удалось загрузить типы календарей: ${error}`,
                    time: 7000,
                })
                throw error
            } finally {
                feedbackStore.isGlobalLoading = false
            }
        },

        /**
         * Загружает список категорий календаря
         */
        async fetchCalendarCategoryById(calendarId: number,): Promise<void> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true

            try {
                const response = await axios.get(`${BASE_URL}/api/calendar/calendar/${calendarId}/event-categories/`)
                this.calendarEventCategories = response.data.results
            } catch (error) {
                logger.error('fetchCalendarEventCategories_error', {
                    file: 'calendarStore',
                    function: 'fetchCalendarEventCategories',
                    condition: `❌ Ошибка загрузки категорий событий: ${error}`,
                })
                feedbackStore.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: `Не удалось загрузить категории событий: ${error}`,
                    time: 7000,
                })
                throw error
            } finally {
                feedbackStore.isGlobalLoading = false
            }
        },

        /**
         * Создает новый тип календаря
         * @param {Omit<ICalendarType, 'id' | 'created_at' | 'updated_at'>} payload - Данные типа
         */
        async createCalendarType(payload: Omit<ICalendarType, 'id' | 'created_at' | 'updated_at'>): Promise<ICalendarType> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true

            try {
                const response = await axios.post(`${BASE_URL}/api/calendar/calendar-type/`, payload)

                feedbackStore.showToast({
                    type: 'success',
                    title: 'Успех',
                    message: 'Тип календаря успешно создан',
                    time: 7000,
                })

                await this.fetchCalendarTypes()
                return response.data
            } catch (error) {
                logger.error('createCalendarType_error', {
                    file: 'calendarStore',
                    function: 'createCalendarType',
                    condition: `❌ Ошибка создания типа календаря: ${error}`,
                })
                feedbackStore.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: `Не удалось создать тип календаря: ${error}`,
                    time: 7000,
                })
                throw error
            } finally {
                feedbackStore.isGlobalLoading = false
            }
        },

        /**
         * Создает новую категорию событий
         * @param {Omit<ICalendarEventCategory, 'id'>} payload - Данные категории
         */
        async createCalendarEventCategory(payload: Omit<ICalendarEventCategory, 'id'>): Promise<ICalendarEventCategory> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true

            try {
                const response = await axios.post(`${BASE_URL}/api/calendar/calendar-event-category/`, payload)

                feedbackStore.showToast({
                    type: 'success',
                    title: 'Успех',
                    message: 'Категория событий успешно создана',
                    time: 7000,
                })

                return response.data
            } catch (error) {
                logger.error('createCalendarEventCategory_error', {
                    file: 'calendarStore',
                    function: 'createCalendarEventCategory',
                    condition: `❌ Ошибка создания категории событий: ${error}`,
                })
                feedbackStore.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: `Не удалось создать категорию событий: ${error}`,
                    time: 7000,
                })
                throw error
            } finally {
                feedbackStore.isGlobalLoading = false
            }
        },

        /**
         * Сбрасывает фильтры к значениям по умолчанию
         */
        resetFilters(): void {
            this.filters = {}
            void this.fetchCalendars()
        },

        /**
         * Формирует параметры фильтрации для запроса
         * @returns {Record<string, any>} Объект с параметрами фильтрации
         */
        getFilterParams(): Record<string, any> {
            const params: Record<string, any> = {}

            if (this.filters.type?.length) {
                params.type = this.filters.type.join(',')
            }

            if (this.filters.timezone?.length) {
                params.timezone = this.filters.timezone.join(',')
            }

            if (typeof this.filters.is_public !== 'undefined') {
                params.is_public = this.filters.is_public
            }

            if (this.filters.created_after) {
                params.created_after = this.filters.created_after
            }

            if (this.filters.created_before) {
                params.created_before = this.filters.created_before
            }

            return params
        },

        /**
         * Загружает события календаря по ID календаря
         * - Не включает обработку ошибок и состояний загрузки
         * - Используется для получения списка событий конкретного календаря
         * - Возвращает массив событий в формате API
         */
        async fetchCalendarEvents(calendarId: number): Promise<ICalendarEvent[]> {
            const response = await axios.get(`${BASE_URL}/api/calendar/calendar/${calendarId}/events/`)
            return response.data.results
        },

        /**
         * Создает новое событие в указанном календаре
         * - Управляет состоянием загрузки через feedbackStore
         * - Логирует ошибки при возникновении
         * - Отправляет POST запрос с данными события
         * - Возвращает созданное событие с сервера
         */
        async createCalendarEvent(calendarId: number, payload: Omit<ICalendarEvent, 'id'>): Promise<ICalendarEvent> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true

            try {
                const response = await axios.post(
                    `${BASE_URL}/api/calendar/calendar/${calendarId}/events/`,
                    payload
                )
                return response.data
            } catch (error) {
                logger.error('createCalendarEvent_error', error)
                throw error
            } finally {
                feedbackStore.isGlobalLoading = false
            }
        },

        /**
         * Обновляет существующее событие календаря
         * - Управляет состоянием загрузки через feedbackStore
         * - Логирует ошибки при возникновении
         * - Отправляет PUT запрос с обновленными данными
         * - Возвращает обновленное событие с сервера
         */
        async updateCalendarEvent(calendarId: number, eventId: number, payload: ICalendarEvent): Promise<ICalendarEvent> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true

            try {
                const response = await axios.put(
                    `${BASE_URL}/api/calendar/calendar/${calendarId}/events/${eventId}/`,
                    payload
                )
                return response.data
            } catch (error) {
                logger.error('updateCalendarEvent_error', error)
                throw error
            } finally {
                feedbackStore.isGlobalLoading = false
            }
        },

        /**
         * Проверяет права на редактирование события
         * - Сравнивает ID создателя события с ID текущего пользователя
         * - Может проверять как текущее событие, так и переданное в параметре
         * - Использует userStore для получения данных пользователя
         * - Возвращает boolean результат проверки
         */
        checkEditPermission(event?: ICalendarEvent): boolean {
            const userStore = useUserStore()
            const eventToCheck = event || this.currentCalendarEvent
            return eventToCheck?.created_by === userStore.user?.id
        },

        /**
         * Сбрасывает текущее событие к значениям по умолчанию
         * - Используется при создании нового события
         * - Очищает все поля формы редактирования
         * - Устанавливает начальные значения для обязательных полей
         */
        resetCurrentEvent(): void {
            this.currentCalendarEvent = {
                name: '',
                start_datetime: '',
                end_datetime: '',
                is_all_day: false,
                categories: [],
                priority: 'low',
                status: 'planned',
                participants: [],
                location: '',
                block: null,
                floor: null,
                room: null,
            }
        },


        /**
         * Загружает событие по ID из указанного календаря
         * - Не включает обработку ошибок и состояний загрузки
         * - Обновляет currentCalendarEvent в хранилище
         * - Используется при редактировании существующего события
         */
        async fetchCalendarEventById(calendarId: number, eventId: number): Promise<void> {
            const response = await axios.get(`${BASE_URL}/api/calendar/calendar/${calendarId}/events/${eventId}/`)
            this.currentCalendarEvent = response.data
        }
    },
    getters: {
        priorityOptions: () => {
            return [
                { label: 'Низкий', value: 'low' },
                { label: 'Средний', value: 'medium' },
                { label: 'Высокий', value: 'high' },
                { label: 'Критический', value: 'critical' },
            ]
        },
        statusOptions: () => {
            return [
                { label: 'Запланировано', value: 'planned' },
                { label: 'Подтверждено', value: 'confirmed' },
                { label: 'Отменено', value: 'cancelled' },
                { label: 'Отложено', value: 'postponed' },
                { label: 'Завершено', value: 'completed' },
            ]
        },
    }
})

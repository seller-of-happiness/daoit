/*
 * Хранилище для работы с сервисом поддержки (ВС - вспомогательные службы)
 *
 * Основные функции:
 * - Управление заявками в сервис поддержки (создание, редактирование, удаление)
 * - Фильтрация и пагинация списка заявок
 * - Работа с группами и категориями сервиса поддержки
 * - Управление текущей заявкой (форма создания/редактирования)
 *
 * Особенности:
 * - Поддерживает пагинацию через cursor-based навигацию
 * - Интегрируется с системой уведомлений и логгирования
 * - Управляет состоянием загрузки через feedbackStore
 * - Хранит статистику по группам и категориям заявок
 *
 * Используемые типы:
 * - ISupportServiceStoreState: структура состояния хранилища
 * - ISupportServiceGroup: тип данных группы сервиса
 * - ISupportServiceCategory: тип данных категории сервиса
 * - ICreateSupportServicePayload: данные для создания/редактирования заявки
 * - ISupportServiceResponse: структура ответа сервера по заявке
 */

import axios from 'axios'
import { defineStore } from 'pinia'
import { BASE_URL } from '@/refactoring/environment/environment'
import { logger } from '@/refactoring/utils/eventLogger'
import { useFeedbackStore } from '@/refactoring/modules/feedback/stores/feedbackStore'
import { getSupportServiceParams } from '@/refactoring/modules/supportService/utils/supportServiceParams'

import type { ISupportServiceStoreState } from '@/refactoring/modules/supportService/types/ISupportServiseStoreState'
import type { ISupportServiceGroup } from '@/refactoring/modules/supportService/types/ISupportServiceGroup'
import type { ISupportServiceCategory } from '@/refactoring/modules/supportService/types/ISupportServiceCategory'
import type { ICreateSupportServicePayload } from '@/refactoring/modules/supportService/types/ICreateSupportServicePayload'
import type { ISupportServiceResponse } from '@/refactoring/modules/supportService/types/ISupportServiceResponse'
import type { ISupportServiceItem } from '@/refactoring/modules/supportService/types/ISupportServiceItem'
import type { ISupportServiceFilters } from '@/refactoring/modules/supportService/types/ISupportServiceFilters'
import type { IRealtimePayload } from '@/refactoring/modules/centrifuge/types/IRealtimePayload'



export const useSupportService = defineStore('supportService', {
        state: (): ISupportServiceStoreState => ({
            nextSupportServiceCursor: null,  // Курсор для пагинации
            supportServices: [],             // Список заявок
            supportServiceStats: {          // Статистика по заявкам
                service_groups: [],
                service_categories: []
            },
            filters: {                      // Параметры фильтрации
                group: [],
                category: [],
                department: [],
                manager: [],
                number: null,
                search: '',
                created_after: null,
                created_before: null,
                is_active: false,
            } as ISupportServiceFilters,
            supportServiceGroups: [],       // Список групп сервиса
            supportServiceCategories: [],   // Список категорий сервиса
            currentSupportService: {        // Текущая редактируемая/создаваемая заявка
                service_group: { id: 0 },
                service_category: { id: 0 },
                priority: 0,
                block: null,
                floor: null,
                room: null,
                department: {
                    id: ''
                },
                description: '',
                files: [],
                location: null,
                can_edit: false,
            } as ICreateSupportServicePayload,
            editableSupportService: null,
        }),
    getters: {
        /**
         * Возвращает варианты приоритетов для заявок
         * Возвращает массив объектов с label/value
         */
        priority: () => [
            { label: 'Низкий', value: 0 },
            { label: 'Средний', value: 1 },
            { label: 'Высокий', value: 2 },
        ],
    },

    actions: {
        /**
         * Назначение:
         * - Применяет входящее realtime-событие по заявке Службы Поддержки к локальному списку `this.supportServices`
         *   и показывает уведомление.
         *
         * Входные данные:
         * @param {IRealtimePayload<ISupportServiceItem>} payload
         *   - `event_type`: 'created' | 'updated' | 'deleted'
         *   - `object`: ISupportServiceItem (заявка СП)
         *
         * Логика:
         * - Guard: при отсутствии `payload`, `event_type` или `object` — ранний выход.
         * - По `object.id` ищется индекс в `this.supportServices`.
         * - 'created':
         *     • если дубль найден — убрать через `splice(idx, 1)`;
         *     • добавить заявку в начало (`this.supportServices = [item, ...this.supportServices]`);
         *     • `showToast(info, "Заявка № … создана")`.
         * - 'updated':
         *     • если найдена — реактивная замена `splice(idx, 1, item)`;
         *     • иначе — добавить в начало;
         *     • `showToast(success, "Заявка № … обновлена")`.
         * - 'deleted':
         *     • если найдена — удалить `splice(idx, 1)`;
         *     • `showToast(warn, "Заявка № … удалена")`.
         *
         * Побочные эффекты:
         * - Мутирует `this.supportServices` (через `splice` и полное присваивание для prepend).
         * - Вызывает `useFeedbackStore().showToast(...)`.
         *
         * Замечания по реактивности:
         * - Для замены/удаления используем `splice`.
         * - Для добавления в начало — новый массив для корректного апдейта подписчиков.
         *
         * Возвращает:
         * @returns {Promise<void>}
         */
        async applySupportServiceRealtime(payload: IRealtimePayload<ISupportServiceItem>): Promise<void> {
            const feedbackStore = useFeedbackStore()
            if (!payload?.event_type || !payload?.data) return

            const item = payload.data
            const idx = this.supportServices.findIndex(s => s.id === item.id)

            switch (payload.event_type) {
                case 'created': {
                    if (idx >= 0) this.supportServices.splice(idx, 1) // на всякий — убрать дубль
                    this.supportServices = [item, ...this.supportServices] // в начало списка
                    feedbackStore.showToast({
                        type: 'info',
                        title: 'Заявка',
                        message: `Заявка № ${item.number} создана`,
                        time: 5000,
                    })
                    break
                }

                case 'updated': {
                    if (idx >= 0) {
                        this.supportServices.splice(idx, 1, item) // точечная реактивная замена
                    } else {
                        this.supportServices = [item, ...this.supportServices]
                    }
                    feedbackStore.showToast({
                        type: 'success',
                        title: 'Заявка',
                        message: `Заявка № ${item.number} обновлена`,
                        time: 5000,
                    })
                    break
                }

                case 'deleted': {
                    if (idx >= 0) {
                        this.supportServices.splice(idx, 1)
                        feedbackStore.showToast({
                            type: 'warn',
                            title: 'Заявка',
                            message: `Заявка № ${item.number} удалена`,
                            time: 5000,
                        })
                    }
                    break
                }
            }
        },

        /**
         * Загружает отфильтрованный список заявок с пагинацией
         * - Управляет состоянием загрузки через feedbackStore
         * - Поддерживает курсорную пагинацию (infinite scroll)
         * - Обновляет статистику по группам/категориям
         * - Логирует ошибки и показывает уведомления
         *
         * @param {string} [cursor] - Курсор для пагинации
         */
        async fetchFilteredSupportServices(cursor?: string): Promise<void> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true
            try {
                const params = getSupportServiceParams(this.filters, cursor)
                const response = await axios.get(`${BASE_URL}/api/support/support-service/`, { params })

                if (cursor) {
                    this.supportServices = [...this.supportServices, ...response.data.results]
                } else {
                    this.supportServices = response.data.results
                }
                this.supportServiceStats = response.data.stats
                this.nextSupportServiceCursor = response.data.next
            } catch (error) {
                logger.error('fetchFilteredSupportServices_error', {
                    file: 'supportServiceStore',
                    function: 'fetchFilteredSupportServices',
                    condition: `❌ Ошибка фильтрации ВС: ${error}`,
                })
                feedbackStore.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: `Не удалось загрузить заявки ВС: ${error}`,
                    time: 7000,
                })
                throw error
            } finally {
                feedbackStore.isGlobalLoading = false
            }
        },

        /**
         * Удаляет заявку по ID и обновляет список
         * - Показывает toast-уведомления о результате
         * - Автоматически обновляет список после удаления
         * - Логирует ошибки для последующего анализа
         *
         * @param {number} id - ID удаляемой заявки
         */
        async deleteSupportService(id: number): Promise<void> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true
            try {
                await axios.delete(`${BASE_URL}/api/support/support-service/${id}/`)
                // Обновляем список после удаления
                feedbackStore.showToast({
                    type: 'success',
                    title: 'Успех',
                    message: `Заявка ${id} успешно удалена.`,
                    time: 7000,
                })
                await this.fetchFilteredSupportServices()
            } catch (error) {
                logger.error('deleteSupportService_error', {
                    file: 'supportServiceStore',
                    function: 'deleteSupportService',
                    condition: `❌ Ошибка удаления ВС: ${error}`,
                })
                feedbackStore.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: `Не удалось удалить заявку ВС: ${error}`,
                    time: 7000,
                })
                throw error
            } finally {
                feedbackStore.isGlobalLoading = false
            }
        },

        /**
         * Загружает список групп сервиса поддержки
         * - Используется для фильтрации и выбора группы при создании заявки
         * - Сохраняет результат в supportServiceGroups
         * - Обрабатывает и логирует ошибки запроса
         */
        async fetchSupportServiceGroups(): Promise<void> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true
            try {
                const response = await axios.get(`${BASE_URL}/api/support/support-service-group/`)
                this.supportServiceGroups = response.data.results as ISupportServiceGroup[]
            } catch (error) {
                logger.error('fetchSupportServiceGroups_error', {
                    file: 'supportServiceStore',
                    function: 'fetchSupportServiceGroups',
                    condition: `❌ Ошибка загрузки групп ВС: ${error}`,
                })
                feedbackStore.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: `Не удалось загрузить группы ВС: ${error}`,
                    time: 7000,
                })
                throw error
            } finally {
                feedbackStore.isGlobalLoading = false
            }
        },

        /**
         * Загружает список категорий сервиса поддержки
         * - Используется вместе с группами для классификации заявок
         * - Сохраняет результат в supportServiceCategories
         * - Обрабатывает ошибки и показывает уведомления
         */
        async fetchSupportServiceCategories(): Promise<void> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true
            try {
                const response = await axios.get(`${BASE_URL}/api/support/support-service-category/`)
                this.supportServiceCategories = response.data.results as ISupportServiceCategory[]
            } catch (error) {
                logger.error('fetchSupportServiceCategories_error', {
                    file: 'supportServiceStore',
                    function: 'fetchSupportServiceCategories',
                    condition: `❌ Ошибка загрузки категорий ВС: ${error}`,
                })
                feedbackStore.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: `Не удалось загрузить категории ВС: ${error}`,
                    time: 7000,
                })
                throw error
            } finally {
                feedbackStore.isGlobalLoading = false
            }
        },


        /**
         * Сбрасывает все фильтры к значениям по умолчанию
         * - Обнуляет все параметры фильтрации
         * - Автоматически загружает свежий список заявок
         */
        resetFilters(): void {
            this.filters = {
                group: [],
                category: [],
                department: [],
                manager: [],
                search: '',
                number: null,
                created_after: null,
                created_before: null,
                is_active: false,
            }
            //  после сброса сразу обновляем список с чистыми фильтрами
            void this.fetchFilteredSupportServices()
        },

        /**
         * Создает новую заявку в сервисе поддержки
         * - Валидирует и отправляет данные на сервер
         * - Обновляет текущую заявку и общий список
         * - Показывает уведомления о результате
         *
         * @param {ICreateSupportServicePayload} payload - Данные новой заявки
         * @returns {Promise<ISupportServiceResponse>} Созданная заявка
         */
        async createSupportService(payload: ICreateSupportServicePayload): Promise<ISupportServiceResponse> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true
            try {
                const response = await axios.post(`${BASE_URL}/api/support/support-service/`, payload)
                // Обновляем currentSupportService
                this.currentSupportService = response.data
                // Обновляем общий список
                await this.fetchFilteredSupportServices()
                feedbackStore.showToast({
                    type: 'success',
                    title: 'Успех',
                    message: `Заявка успешно создана`,
                    time: 7000,
                })
                return response.data
            } catch (error) {
                logger.error('createSupportService_error', {
                    file: 'supportServiceStore',
                    function: 'createSupportService',
                    condition: `❌ Ошибка создания заявки ВС: ${error}`,
                })
                feedbackStore.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: `Не удалось создать заявку ВС: ${error}`,
                    time: 7000,
                })
                throw error
            } finally {
                feedbackStore.isGlobalLoading = false
            }
        },


        /**
         * Обновляет существующую заявку
         * - Отправляет изменения на сервер
         * - Обновляет список заявок после успешного сохранения
         * - Логирует ошибки и показывает уведомления
         *
         * @param {number} id - ID редактируемой заявки
         * @param {ICreateSupportServicePayload} payload - Новые данные заявки
         */
        async updateSupportService(id: number, payload: ICreateSupportServicePayload): Promise<void> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true
            try {
                await axios.put(`${BASE_URL}/api/support/support-service/${id}/`, payload)
                // После обновления — обновляем список
                await this.fetchFilteredSupportServices()
                feedbackStore.showToast({
                    type: 'success',
                    title: 'Успех',
                    message: `Заявка ${id} успешно отредактирована.`,
                    time: 7000,
                })
            } catch (error) {
                logger.error('updateSupportService_error', {
                    file: 'supportServiceStore',
                    function: 'updateSupportService',
                    condition: `❌ Ошибка обновления ВС: ${error}`,
                })
                feedbackStore.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: `Не удалось обновить заявку ВС: ${error}`,
                    time: 7000,
                })
                throw error
            } finally {
                feedbackStore.isGlobalLoading = false
            }
        },


        /**
         * Загружает заявку по ID для редактирования
         * - Заполняет currentSupportService данными с сервера
         * - Используется при открытии формы редактирования
         * - Обрабатывает ошибки загрузки
         *
         * @payload {id: number} - ID загружаемой заявки
         */
        async fetchSupportServiceById(payload: { id: number }): Promise<void> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true
            try {
                const response = await axios.get(`${BASE_URL}/api/support/support-service/${payload.id}/`)
                this.currentSupportService = {
                    service_group: response.data.service_group,
                    service_category: response.data.service_category,
                    priority: response.data.priority,
                    block: response.data.block,
                    floor: response.data.floor,
                    room: response.data.room,
                    department: response.data.department,
                    description: response.data.description,
                    files: response.data.files || [],
                    created_by: response.data.created_by,
                    can_edit: response.data.can_edit,
                    created_at: response.data.created_at,
                }

                this.editableSupportService = JSON.parse(JSON.stringify(this.currentSupportService))
            } catch (error) {
                logger.error('fetchSupportServiceById_error', {
                    file: 'supportServiceStore',
                    function: 'fetchSupportServiceById',
                    condition: `❌ Ошибка получения ВС: ${error}`,
                })
                feedbackStore.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: `Не удалось получить данные ВС: ${error}`,
                    time: 7000,
                })
                throw error
            } finally {
                feedbackStore.isGlobalLoading = false
            }
        },

        /**
         * Сбрасывает состояние текущей заявки
         * - Используется при создании новой заявки
         * - Устанавливает значения по умолчанию для всех полей
         */
        resetCurrentSupportService(): void {
            this.currentSupportService = {
                service_group: { id: 0 },
                service_category: { id: 0 },
                priority: 0,
                block: null,
                floor: null,
                room: null,
                department: {
                    id: ''
                },
                description: '',
                files: [],
                location: null,
                can_edit: false
            }
            this.editableSupportService = null
        },
        /**
         * Проверяет права пользователя на редактирование нежелательного события
         *
         * Сравнивает ID создателя события с ID текущего пользователя:
         * - Возвращает true, если пользователь является создателем
         * - Показывает сообщение об ошибке и возвращает false, если нет прав
         * - Логирует ID для отладки в консоли
         *
         * @returns {boolean} Флаг наличия прав на редактирование
         *
         * Используется перед открытием формы редактирования НС
         * для проверки прав доступа
         */
        checkEditPermission(item?: ISupportServiceItem): boolean {

            // Если передали конкретный элемент - проверяем его
            const candidate = item ?? this.currentSupportService
            return candidate?.can_edit === true
        }
    },
})

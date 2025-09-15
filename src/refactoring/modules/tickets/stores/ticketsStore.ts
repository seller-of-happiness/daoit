import axios from 'axios'
import { defineStore } from 'pinia'
import { BASE_URL } from '@/refactoring/environment/environment'
import { useFeedbackStore } from '@/refactoring/modules/feedback/stores/feedbackStore'
import { useFilesStore } from '@/refactoring/modules/files/stores/filesStore'
import { toApiDate } from '@/refactoring/utils/formatters'
import { logger } from '@/refactoring/utils/eventLogger'

import type { ITicketsStoreState } from '@/refactoring/modules/tickets/types/ITicketsStoreState'
import type { ICreateTicketPayload } from '@/refactoring/modules/tickets/types/ICreateTicketPayload'
import type { ITicketDetail } from '@/refactoring/modules/tickets/types/ITicketDetail'
import type { IUpdateTicketPayload } from '@/refactoring/modules/tickets/types/IUpdateTicketPayload'
import type { TicketPriority } from '@/refactoring/modules/tickets/types/TicketPriority'
import type { IExistingFile } from '@/refactoring/modules/files/types/IExistingFile'
import type { UploadPhase } from '@/refactoring/modules/supportService/stores/IUploadPhase'
import type { IRealtimePayload } from '@/refactoring/modules/centrifuge/types/IRealtimePayload'
import type { ITicketListItem } from '@/refactoring/modules/tickets/types/ITicketListItem'
import type { ITicketsFilters } from '@/refactoring/modules/tickets/types/ITicketsFilters'


export const useTicketsStore = defineStore('ticketsStore', {
    state: (): ITicketsStoreState => ({
        tickets: [],
        nextCursor: null,
        currentTicket: null,
        categories: [],
        filters: {
            search: '',
            categories: null,
            priorities: [],
            statuses: [],
            created_after: null,
            created_before: null,
            is_active: false
        } as ITicketsFilters,
        uploadNewFiles: [],
        uploadRemovedFileIds: [],
    }),
    actions: {
        /**
         * Формирует состояние формы редактирования из деталей тикета
         *
         * Основные действия:
         * - Извлекает ключевые поля тикета
         * - Приводит их к формату `ICreateTicketPayload`
         *
         * Применение:
         * - Для заполнения формы редактирования тикета
         */
        buildFormStateFromTicket(ticket: ITicketDetail): ICreateTicketPayload {
            return {
                title: ticket.title ?? '',
                description: ticket.description ?? '',
                category: { id: (ticket.category as any)?.id ?? 0 },
                priority: (ticket.priority as TicketPriority) ?? (0 as TicketPriority),
                deadline_time: (ticket as any).deadline_time ?? null,
                coordinator: ticket.coordinator ?? null
            }
        },

        /**
         * Инициализирует форму редактирования по ID тикета
         *
         * Основные действия:
         * - Загружает тикет по ID
         * - Формирует payload для формы
         *
         * Применение:
         * - При открытии формы редактирования
         */
        async initEditFormFromId(id: number): Promise<ICreateTicketPayload | null> {
            await this.fetchTicket(id)
            const t = this.currentTicket as ITicketDetail | null
            return t ? this.buildFormStateFromTicket(t) : null
        },

        /**
         * Загружает список категорий тикетов
         *
         * Основные действия:
         * - Отправляет GET запрос на сервер
         * - Сохраняет категории в состояние
         * - Управляет загрузкой и уведомлениями
         */
        async fetchCategories(): Promise<void> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true
            try {
                const res = await axios.get(`${BASE_URL}/api/ticket/category/`)
                const results = res.data?.results ?? res.data ?? []
                this.categories = Array.isArray(results) ? results : []
            } catch (error) {
                logger.error('fetchCategories_error', {
                    file: 'ticketsStore',
                    function: 'fetchCategories',
                    condition: `❌ Ошибка загрузки категорий: ${error}`,
                })
                feedbackStore.showToast({ type: 'error', title: 'Ошибка', message: 'Не удалось загрузить категории' })
                throw error
            } finally {
                feedbackStore.isGlobalLoading = false
            }
        },


        /**
         * Загружает список тикетов
         *
         * Основные действия:
         * - Формирует параметры фильтрации
         * - Отправляет GET запрос
         * - Обновляет список тикетов и курсор
         */
        async fetchTickets(cursor?: string): Promise<void> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true
            try {
                const params: Record<string, any> = {}
                if (cursor) params.cursor = cursor

                const f = this.filters as ITicketsFilters

                if (f.search) params.search = f.search

                // statuses -> CSV
                if (Array.isArray(f.statuses) && f.statuses.length) {
                    params.statuses = f.statuses.join(',')
                }

                // priorities -> CSV
                if (Array.isArray(f.priorities) && f.priorities.length) {
                    params.priorities = f.priorities.join(',')
                }

                // categories -> CSV
                if (Array.isArray(f.categories) && f.categories.length) {
                    params.categories = f.categories.join(',')
                }

                // is_active: важно отправлять false если явно установлен
                if (typeof f.is_active === 'boolean') {
                    params.is_active = f.is_active
                }

                // dates -> YYYY-MM-DD (toApiDate util)
                if (f.created_after instanceof Date) {
                    params.created_after = toApiDate(f.created_after)
                }
                if (f.created_before instanceof Date) {
                    params.created_before = toApiDate(f.created_before)
                }

                const res = await axios.get(`${BASE_URL}/api/ticket/ticket/`, { params })
                const results = res.data.results ?? res.data
                this.tickets = cursor ? [...this.tickets, ...results] : results
                this.nextCursor = res.data.next ?? null
            } catch (error) {
                logger.error('fetchTickets_error', {
                    file: 'ticketsStore',
                    function: 'fetchTickets',
                    condition: `❌ Ошибка загрузки тикетов: ${String(error)}`
                })
                const feedbackStore = useFeedbackStore()
                feedbackStore.showToast({ type: 'error', title: 'Ошибка', message: 'Не удалось загрузить тикеты' })
                throw error
            } finally {
                feedbackStore.isGlobalLoading = false
            }
        },

        /**
         * Загружает тикет по id
         */
        async fetchTicket(id: number): Promise<void> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true
            try {
                const res = await axios.get(`${BASE_URL}/api/ticket/ticket/${id}/`)
                this.currentTicket = res.data
            } catch (error) {
                logger.error('fetchTicket_error', {
                    file: 'ticketsStore',
                    function: 'fetchTicket',
                    condition: `❌ Ошибка загрузки тикета: ${error}`,
                })
                feedbackStore.showToast({ type: 'error', title: 'Ошибка', message: 'Не удалось загрузить тикет' })
                throw error
            } finally {
                feedbackStore.isGlobalLoading = false
            }
        },

        /**
         * Создает новый тикет
         */
        async createTicket(payload: ICreateTicketPayload): Promise<ITicketDetail> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true
            try {
                const res = await axios.post(`${BASE_URL}/api/ticket/ticket/`, payload)
                this.currentTicket = res.data
                await this.fetchTickets()
                feedbackStore.showToast({ type: 'success', title: 'Успех', message: 'Тикет создан' })
                return res.data
            } catch (error) {
                logger.error('createTicket_error', {
                    file: 'ticketsStore',
                    function: 'createTicket',
                    condition: `❌ Ошибка создания тикета: ${error}`,
                })
                feedbackStore.showToast({ type: 'error', title: 'Ошибка', message: 'Не удалось создать тикет' })
                throw error
            } finally {
                feedbackStore.isGlobalLoading = false
            }
        },

        async updateTicket(id: number, payload: IUpdateTicketPayload): Promise<ITicketDetail> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true
            try {
                const res = await axios.put(`${BASE_URL}/api/ticket/ticket/${id}/`, payload)
                this.currentTicket = res.data
                await this.fetchTickets()
                return res.data
            } catch (error) {
                logger.error('updateTicket_error', {
                    file: 'ticketsStore',
                    function: 'updateTicket',
                    condition: `❌ Ошибка обновления тикета: ${error}`,
                })
                feedbackStore.showToast({ type: 'error', title: 'Ошибка', message: 'Не удалось обновить тикет' })
                throw error
            } finally {
                feedbackStore.isGlobalLoading = false
            }
        },

        resetFilters(): void {
            this.filters = {
                search: '',
                categories: null,
                priorities: [],
                statuses: [],
                created_after: null,
                created_before: null ,
                is_active: false
            }
        },

             // [ADD] Файлы: задать все новые файлы из raw-модели компонента
        setNewTicketFiles(raw: Array<File | { file?: File }>): void {
            const files = useFilesStore().normalizeToFileArray(raw)
            this.uploadNewFiles = files
        },
             // [ADD] Очистить буфер новых файлов
        clearNewTicketFiles(): void { this.uploadNewFiles = [] },
            // [ADD] Пометить файл на удаление
        markTicketFileForRemoval(id: number): void {
            if (!this.uploadRemovedFileIds.includes(id)) this.uploadRemovedFileIds.push(id)
                // [ADD] мгновенно обновляем UI
            const cur = this.currentTicket as any
            if (cur && Array.isArray(cur.files)) cur.files = cur.files.filter((f: any) => f.id !== id)
        },
            // [ADD] Очистить метки на удаление
        clearRemovedTicketFiles(): void { this.uploadRemovedFileIds = [] },


        /**
         * Синхронизирует файлы тикета
         */
        async syncTicketFiles(ticketId: number, phase: UploadPhase = 'update'): Promise<void> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true
            try {
                const filesStore = useFilesStore()
                const hasNew = this.uploadNewFiles.length > 0
                const hasDel = this.uploadRemovedFileIds.length > 0
                if (!hasNew && !hasDel) return

                if (hasNew) await filesStore.uploadTicketFiles(ticketId, this.uploadNewFiles, phase)
                if (hasDel) {
                    for (const fid of this.uploadRemovedFileIds) {
                        await filesStore.deleteTicketFile(ticketId, fid)
                    }
                }
                this.clearNewTicketFiles()
                this.clearRemovedTicketFiles()
            } catch (error) {
                logger.error('syncTicketFiles_error', {
                    file: 'ticketsStore',
                    function: 'syncTicketFiles',
                    condition: `❌ Ошибка синхронизации файлов: ${error}`,
                })
                feedbackStore.showToast({ type: 'error', title: 'Ошибка', message: 'Не удалось синхронизировать файлы' })
                throw error
            } finally {
                feedbackStore.isGlobalLoading = false
            }
        },

        /**
         * Переводит тикет в статус "в работе" для координатора
         */
        async coordinatorStart(id: number): Promise<void> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true
            try {
                await axios.post(`${BASE_URL}/api/ticket/ticket/${id}/in-progress/`)
                feedbackStore.showToast({ type: 'success', title: 'Успех', message: 'Заявка переведена в работу' })
            } catch (error) {
                logger.error('coordinatorStart_error', {
                    file: 'ticketsStore',
                    function: 'coordinatorStart',
                    condition: `❌ Ошибка перевода в работу: ${error}`,
                })
                feedbackStore.showToast({ type: 'error', title: 'Ошибка', message: 'Не удалось перевести заявку в работу' })
                throw error
            } finally {
                feedbackStore.isGlobalLoading = false
            }
        },

        /**
         * Завершает тикет для координатора
         */
        async coordinatorComplete(id: number): Promise<void> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true
            try {
                await axios.post(`${BASE_URL}/api/ticket/ticket/${id}/complete/`)
                feedbackStore.showToast({ type: 'success', title: 'Успех', message: 'Заявка завершена' })
            } catch (error) {
                logger.error('coordinatorComplete_error', {
                    file: 'ticketsStore',
                    function: 'coordinatorComplete',
                    condition: `❌ Ошибка завершения тикета: ${error}`,
                })
                feedbackStore.showToast({ type: 'error', title: 'Ошибка', message: 'Не удалось завершить заявку' })
                throw error
            } finally {
                feedbackStore.isGlobalLoading = false
            }
        },

        /**
         * Назначение:
         * - Применяет входящее realtime-событие по тикету к локальному списку `this.tickets`
         *   и показывает уведомление.
         *
         * Входные данные:
         * @param {IRealtimePayload<ITicketListItem>} payload
         *   - `event_type`: 'created' | 'updated' | 'deleted'
         *   - `object`: ITicketListItem (сам тикет)
         *
         * Логика:
         * - Guard: при отсутствии `payload`, `event_type` или `object` — ранний выход.
         * - По `object.id` ищется индекс в `this.tickets`.
         * - 'created':
         *     • если дубль найден — убрать через `splice(idx, 1)`;
         *     • добавить новый тикет в начало (`this.tickets = [ticket, ...this.tickets]`);
         *     • `showToast(info, "Получен новый тикет", №)`.
         * - 'updated':
         *     • если найдено — точечная реактивная замена `splice(idx, 1, ticket)`;
         *     • иначе — добавить в начало;
         *     • `showToast(success, "Тикет обновлен", №)`.
         * - 'deleted':
         *     • если найдено — удалить `splice(idx, 1)`;
         *     • `showToast(warn, "Тикет удален", №)`.
         *
         * Побочные эффекты:
         * - Мутирует `this.tickets` (через `splice` и полное присваивание для prepend).
         * - Вызывает `useFeedbackStore().showToast(...)`.
         *
         * Замечания по реактивности:
         * - Для замены/удаления используем `splice`, чтобы сохранить реактивность.
         * - Для добавления в начало — создаём новый массив (триггерит наблюдателей).
         *
         * Возвращает:
         * @returns {Promise<void>}
         */
        async applyTicketRealtime(payload: IRealtimePayload<ITicketDetail>): Promise<void> {
            const feedbackStore = useFeedbackStore()
            if (!payload?.event_type || !payload?.data) return

            const ticket = payload.data
            const idx = this.tickets.findIndex((t: ITicketListItem) => t.id === ticket.id)

            const isCurrentTicket = this.currentTicket?.id === ticket.id

            switch (payload.event_type) {
                case 'created':
                    if (idx >= 0) this.tickets.splice(idx, 1)
                    this.tickets = [ticket, ...this.tickets]
                    feedbackStore.showToast({
                        type: 'info',
                        title: 'Получена новая заявка',
                        message: `Заявка № ${ticket.number}`,
                        time: 5000
                    })
                    break
                case 'updated':
                    if (idx >= 0) {
                        this.tickets.splice(idx, 1, ticket)
                    } else {
                        this.tickets = [ticket, ...this.tickets]
                    }

                    if (isCurrentTicket) {
                        await this.fetchTicket(ticket.id)
                    }
                    break
                case 'deleted':
                    if (idx >= 0) {
                        this.tickets.splice(idx, 1)
                        feedbackStore.showToast({
                            type: 'warn',
                            title: 'Заявка удалена',
                            message: `Заявка № ${ticket.number}`,
                            time: 5000
                        })
                    }
                    break
            }
        },
    },
    getters: {
        /**
         * Опции приоритета тикетов
         *
         * Используется:
         * - Для отображения выпадающего списка приоритета в формах
         */
        priorityOptions: (): Array<{ label: string; value: TicketPriority }> => [
            { label: 'Критичный', value: 3 as TicketPriority },
            { label: 'Высокий', value: 2 as TicketPriority },
            { label: 'Средний', value: 1 as TicketPriority },
            { label: 'Низкий', value: 0 as TicketPriority }
        ],

        /**
         * Список существующих файлов текущего тикета
         *
         * Основные действия:
         * - Извлекает файлы из текущего тикета
         * - Приводит их к типу `IExistingFile`
         *
         * Используется:
         * - Для отображения файлов в UI
         * - Для дальнейшей синхронизации с API
         */
        existingFilesForCurrent(state): IExistingFile[] {
            const list = (state.currentTicket as any)?.files ?? []
            return list.map((f: any) => ({ id: f.id, file: f.file }))
        },
    },
})



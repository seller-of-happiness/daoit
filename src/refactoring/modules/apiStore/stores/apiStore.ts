import axios from 'axios'
import { defineStore } from 'pinia'
import { useFeedbackStore } from '@/refactoring/modules/feedback/stores/feedbackStore'
import { useResponsibilityEntries } from '@/refactoring/modules/responsibilityEntries/stores/responsibilityEntriesStore'
import { BASE_URL, FILTRATION_TYPE  } from '@/refactoring/environment/environment'
import { toApiDate } from '@/refactoring/utils/formatters'
import { logger } from '@/refactoring/utils/eventLogger'
import type { IApiStoreState } from '@/refactoring/modules/apiStore/types/IApiStoreState'
import type { IStats } from '@/refactoring/modules/apiStore/types/adverse-events-stats/IStats'
import type { IAdverseEvent } from '@/refactoring/modules/apiStore/types/adverse-events/IAdverseEvent'
import type { IAdverseEventCategoryType } from '@/refactoring/modules/apiStore/types/adverse-events-category/IAdverseEventCategoryType'
import type { IHospitalSkeleton } from '@/refactoring/modules/apiStore/types/hospital-skeleton/IHospitalSkeleton'
import type { ICreateAdversePayload } from '@/refactoring/modules/apiStore/types/adverse-events/ICreateAdversePayload'
import type { IResponsibilityEntry } from '@/refactoring/modules/responsibilityEntries/types/IResponsibilityEntry'
import type { ITreeNode } from '@/refactoring/modules/apiStore/types/ITreeNode'
import type { IFilters } from '@/refactoring/modules/apiStore/types/filters/IFilters'
import type { IDashboardStats } from '@/refactoring/modules/apiStore/types/adverse-events-stats/IDashboardStats'
import type { IRealtimePayload } from '@/refactoring/modules/centrifuge/types/IRealtimePayload'
import type { IHeatMap } from '@/refactoring/modules/apiStore/types/IHeatMap'


export const useApiStore = defineStore('apiStore', {
    state: (): IApiStoreState & { filtrationType: 'front' | 'server' }  => ({
        filtrationType: FILTRATION_TYPE,
        nextAdverseEventsCursor: null,
        departments: [],
        adverseEvents: [],
        adverseEventsStats: {} as IStats,
        statsDashboard: {} as IDashboardStats,
        heatmap: [],
        adverseEventsCategory: [],
        employees: [],
        hospitalSkeleton: [] as IHospitalSkeleton[],
        filters: {
            department: [],
            event_type: [],
            category: [],
            search: '',
            number: null,
            created_after: null,
            created_before: null,
            is_active: false,
            is_high_risk: false,
        } as IFilters,
        currentAdverseEvent: {
            event_type: { id: 0 }, // Пустая строка вместо 0 (или валидный UUID если требуется)
            location: '',
            block: null,
            floor: null,
            room: null,
            department: null,
            description: '',
            corrective_measures: '',
            status: 'new',
            probability: null,
            consequence: null,
            date_time: '',
            participants: [],
            responsibility_entries: [],
            coordinator: null,
        } as ICreateAdversePayload,
        editableAdverseEvent: null
    }),
    getters: {
        /**
         * Геттер для получения отфильтрованного списка нежелательных событий
         *
         * Фильтрация происходит по следующим параметрам:
         * - Отделение (department)
         * - Тип события (event_type)
         * - Категория события (category)
         * - Текстовый поиск (search)
         * - Номер события (number)
         * - Диапазон дат (created_after, created_before)
         *
         * Особенности:
         * - Все фильтры работают по принципу "И"
         * - Пустые фильтры не применяются
         * - Поддержка частичного совпадения для текстового поиска
         * - Точное совпадение для номера события
         * - Валидация и преобразование дат
         */
        filteredAdverseEvents(state): IAdverseEvent[] {
            return state.adverseEvents.filter(event => {
                // Фильтр по отделению: совпадение ID или отсутствие фильтра
                const departmentMatch = !state.filters.department.length ||
                    (event.department?.id && state.filters.department.includes(event.department.id))

                // Фильтр по типу события: совпадение ID или отсутствие фильтра
                const eventTypeMatch = !state.filters.event_type.length ||
                    (event.event_type?.id && state.filters.event_type.includes(event.event_type.id))

                // Фильтр по категории: проверка принадлежности типа события к выбранным категориям
                const categoryMatch = !state.filters.category.length ||
                    (event.event_type && this.adverseEventsCategory.some(
                        (c: { id: number; types: { id: number }[] }) =>
                            c.types.some((t: { id: number }) => t.id === event.event_type?.id) &&
                            state.filters.category.includes(c.id)
                    ))

                // Текстовый поиск: проверка вхождения подстроки в description или cause
                const searchMatch = !state.filters.search ||
                    (event.description?.toLowerCase().includes(state.filters.search.toLowerCase()) ||
                        event.corrective_measures?.toLowerCase().includes(state.filters.search.toLowerCase()))

                // Фильтр по номеру события: точное совпадение (частичное через includes)
                const numberMatch =
                    state.filters.number === null ||
                    event.number?.toString().includes(state.filters.number.toString())

                // Фильтр по дате: проверка попадания в диапазон
                const eventDate = new Date(event.date_time)
                const afterDate = state.filters.created_after ? new Date(state.filters.created_after) : null
                const beforeDate = state.filters.created_before ? new Date(state.filters.created_before) : null

                const dateMatch = (!afterDate || eventDate >= afterDate) &&
                    (!beforeDate || eventDate <= beforeDate)

                // Комбинирование всех условий фильтрации
                return departmentMatch && eventTypeMatch && categoryMatch &&
                    searchMatch && numberMatch && dateMatch
            })
        },

        /**
         * Геттер для преобразования массива отделений в плоскую структуру
         *
         * Назначение:
         * - Создает упрощенный массив отделений с минимально необходимыми полями
         * - Используется для выпадающих списков и других UI компонентов
         *
         * Возвращает:
         * - Массив объектов с полями {id: number, name: string}
         *
         * Особенности:
         * - Сохраняет исходный порядок отделений
         * - Гарантирует наличие обязательных полей id и name
         * - Не изменяет исходные данные, создает новый массив
         */
        flatDepartments(state): Array<{id: string, name: string}> {
            return state.departments.map(d => ({
                id: d.id,       // ID отделения (обязательное поле)
                name: d.name    // Название отделения (обязательное поле)
            }))
        },

        /**
         * Геттер для преобразования категорий и типов событий в древовидную структуру
         *
         * Назначение:
         * - Формирует иерархическую структуру для отображения в Tree-компонентах
         * - Категории становятся родительскими узлами, типы - дочерними
         *
         * Возвращает:
         * - Массив объектов ITreeNode с вложенной структурой
         *
         * Структура узла:
         * {
         *   key: string - уникальный идентификатор узла
         *   label: string - отображаемое название
         *   data: {
         *     name: string - название элемента
         *     position: number - позиция (по умолчанию 0)
         *     selfId: number - оригинальный ID из базы
         *   },
         *   icon: string - иконка узла
         *   selectable: boolean - можно ли выбрать узел
         *   children: ITreeNode[] - дочерние узлы
         * }
         *
         * Особенности:
         * - Ключи категорий формируются из ID категории
         * - Ключи типов формируются как "categoryId-typeId"
         * - Родительские узлы (категории) неселектабельны
         * - Все узлы не содержат иконок по умолчанию
         */
        categoryTypeTree(state): ITreeNode[] {
            return state.adverseEventsCategory.map(category => ({
                key: category.id.toString(), // Уникальный ключ категории
                label: category.name,       // Название категории для отображения
                data: {
                    name: category.name,    // Дублирование названия в data
                    position: 0,           // Позиция по умолчанию
                    selfId: category.id.toString(),    // Оригинальный ID категории
                },
                icon: '',                   // Иконка не задана
                selectable: false,          // Категории нельзя выбрать
                children: category.types.map((type: IAdverseEventCategoryType) => ({
                    key: `${category.id}-${type.id}`, // Составной ключ типа
                    label: type.name,      // Название типа для отображения
                    data: {
                        name: type.name,   // Дублирование названия в data
                        position: 0,       // Позиция по умолчанию
                        selfId: type.id.toString(),   // Оригинальный ID типа
                    },
                    icon: '',              // Иконка не задана
                    children: [],          // Нет вложенных уровней
                })),
            }))
        },

        /**
         * Получает название отделения по ID
         *
         * При отсутствии ID или если отделение не найдено
         * возвращает строку 'Отделение не выбрано'
         *
         * Используется для отображения читаемых названий
         * вместо числовых идентификаторов в интерфейсе
         */
        getDepartmentName: (state) => (id: string | null): string => {
            if (!id) return 'Отделение не выбрано'
            return state.departments.find(d => d.id === id)?.name ?? 'Отделение не выбрано'
        },

        /**
         * Получает название типа события
         *
         * Возвращает имя типа события или 'Без уточнения',
         * если тип не указан или равен null
         *
         * Используется для отображения читаемых названий типов событий
         * в интерфейсе вместо null/undefined значений
         */
        getEventTypeName: () => (eventType: { id: number, name: string } | null): string => {
            return eventType?.name ?? 'Без уточнения'
        },

        /**
         * Возвращает последний статус ответственности без изменений
         *
         * Функция-заглушка, которая просто возвращает переданный статус
         * Может использоваться как основа для будущей логики обработки статусов
         *
         * В текущей реализации не выполняет преобразований,
         * просто возвращает исходное значение
         */
        getLastResponsibilityStatus: () => (status: string): string => {
            return status
        },

        /**
         * Возвращает варианты вероятности нежелательного события для выбора в UI.
         *
         * Содержит пять предопределённых уровней вероятности:
         * - Высокая (значение 4)
         * - Выше средней (значение 3)
         * - Средняя (значение 2)
         * - Низкая (значение 1)
         * - Практически исключено (значение 0)
         *
         * Используется в формах создания/редактирования событий
         * для выбора вероятности повторения.
         */
        adverseEventProbability(): Array<{ label: string; value: number | null; disabled?: boolean}> {
            return [
                { label: 'Высокая',              value: 4 },
                { label: 'Выше средней',         value: 3 },
                { label: 'Средняя',              value: 2 },
                { label: 'Низкая',               value: 1 },
                { label: 'Практически исключено', value: 0 },
                { label: 'Выберите вероятность', value: null, disabled: true },
            ]
        },

        /**
         * Возвращает варианты степени последствий нежелательного события.
         *
         * Предопределённые уровни последствий:
         * - Катастрофические (значение 4)
         * - Значительные (значение 3)
         * - Средние (значение 2)
         * - Легкие (значение 1)
         * - Несущественные (значение 0)
         *
         * Применяется в формах ввода для оценки серьёзности
         * последствий при создании/редактировании событий.
         */
        adverseEventConsequences(): Array<{ label: string; value: number | null; disabled?: boolean }> {
            return [
                { label: 'Катастрофические', value: 4 },
                { label: 'Значительные',     value: 3 },
                { label: 'Средние',          value: 2 },
                { label: 'Легкие',           value: 1 },
                { label: 'Несущественные',   value: 0 },
                { label: 'Выберите последствия', value: null, disabled: true },
            ]
        },

        /**
         * Маппинг типов участников на читаемые названия
         *
         * Используется для отображения типов участников в интерфейсе
         * вместо технических значений. Содержит все возможные
         * типы участников нежелательных событий.
         *
         * Соответствие типов:
         * - employee → 'Сотрудник'
         * - patient → 'Пациент'
         * - visitor → 'Посетитель'
         * - other → 'Другое'
         */
        participantTypes: () => ({
            employee: 'Сотрудник',
            patient: 'Пациент',
            visitor: 'Посетитель',
            other: 'Другое'
        }) as Record<string, string>,

        /**
         * Маппинг статусов мероприятий на читаемые названия
         *
         * Используется для отображения статусов в интерфейсе
         * вместо технических значений. Содержит все возможные
         * статусы мероприятий по устранению нежелательных событий.
         *
         * Соответствие статусов:
         * - new → 'Новое'
         * - passed → 'Передано'
         * - in_progress → 'В работе'
         * - recalled → 'Отозвано'
         * - returned → 'Возвращено'
         * - rejected → 'Отклонено'
         * - cancelled → 'Отменено'
         * - completed → 'Завершено'
         */
        responsibilityEntriesStatuses: () => ({
            new: 'Новое',
            passed: 'Передано',
            in_progress: 'В работе',
            recalled: 'Отозвано',
            returned: 'Возвращено',
            rejected: 'Отклонено',
            cancelled: 'Отменено',
            completed: 'Завершено'
        })
    },

    actions: {
        /**
         * Назначение:
         * - Применяет входящее realtime-событие по нежелательному событию (НС) к локальному списку `this.adverseEvents`
         *   и показывает уведомление.
         *
         * Входные данные:
         * @param {IRealtimePayload<IAdverseEvent>} payload
         *   - `event_type`: 'created' | 'updated' | 'deleted'
         *   - `object`: IAdverseEvent (само НС)
         *
         * Логика:
         * - Guard: при отсутствии `payload`, `event_type` или `object` — ранний выход.
         * - По `object.id` ищется индекс в `this.adverseEvents`.
         * - 'created':
         *     • если дубль найден — убрать через `splice(idx, 1)`;
         *     • добавить новое НС в начало (`this.adverseEvents = [ev, ...this.adverseEvents]`);
         *     • `showToast(info, "Получено новое НС", №)`.
         * - 'updated':
         *     • если найдено — точечная реактивная замена `splice(idx, 1, ev)`;
         *     • иначе — добавить в начало;
         *     • `showToast(success, "НС обновлено", №)`.
         * - 'deleted':
         *     • если найдено — удалить `splice(idx, 1)`;
         *     • `showToast(warn, "НС удалено", №)`.
         *
         * Побочные эффекты:
         * - Мутирует `this.adverseEvents` (через `splice` и полное присваивание для prepend).
         * - Вызывает `useFeedbackStore().showToast(...)`.
         *
         * Замечания по реактивности:
         * - Для замены/удаления используем `splice`, чтобы сохранить реактивность.
         * - Для добавления в начало — создаём новый массив (триггерит наблюдателей).
         *
         * Возвращает:
         * @returns {Promise<void>}
         */
        async applyAdverseEventRealtime(payload: IRealtimePayload<IAdverseEvent>): Promise<void> {
            const feedbackStore = useFeedbackStore()
            if (!payload?.event_type || !payload?.data) return

            const ev = payload.data
            const idx = this.adverseEvents.findIndex(e => e.id === ev.id)

            const isCurrentEvent = this.currentAdverseEvent?.id === ev.id

            switch (payload.event_type) {
                case 'created':
                    if (idx >= 0) this.adverseEvents.splice(idx, 1)
                    this.adverseEvents = [ev, ...this.adverseEvents]
                    feedbackStore.showToast({ type: 'info', title: 'Получено новое НС', message: `НС № ${ev.number}`, time: 5000 })
                    break
                case 'updated':
                    if (idx >= 0) this.adverseEvents.splice(idx, 1, ev)
                    else this.adverseEvents = [ev, ...this.adverseEvents]

                    if (isCurrentEvent) {
                        await this.fetchAdverseEventById({id: ev.id})
                    }

                    feedbackStore.showToast({ type: 'success', title: 'НС обновлено', message: `НС № ${ev.number} обновлено`, time: 5000 })
                    break
                case 'deleted':
                    if (idx >= 0) {
                        this.adverseEvents.splice(idx, 1)
                        feedbackStore.showToast({ type: 'warn', title: 'НС удалено', message: `НС № ${ev.number}`, time: 5000 })
                    }
                    break
            }
        },
                                    // POST
        /**
         * Создает новое нежелательное событие (НС) через API
         *
         * Последовательность действий:
         * 1. Активирует глобальный индикатор загрузки
         * 2. Отправляет данные на сервер через POST-запрос
         * 3. При успехе:
         *    - Добавляет созданное событие в начало списка
         *    - Показывает уведомление об успехе
         *    - Сбрасывает связанные мероприятия
         * 4. При ошибке:
         *    - Показывает уведомление с ошибкой
         *    - Пробрасывает исключение дальше
         * 5. В любом случае выключает индикатор загрузки
         *
         * @throws {Error} В случае ошибки API или сети
         */
        async createAdverseEvent(payload: ICreateAdversePayload): Promise<IAdverseEvent> {
            const feedbackStore = useFeedbackStore();
            const responsibilityEntriesStore = useResponsibilityEntries()
            feedbackStore.isGlobalLoading = true;
            try {
                const response = await axios.post<IAdverseEvent>(
                    `${BASE_URL}/api/adverse/adverse-event/`,
                    payload
                );
                this.adverseEvents.unshift(response.data);
                feedbackStore.showToast({
                    type: 'success',
                    title: 'Упешное создание',
                    message: `Нежелательное событие успешно создано!`,
                    time: 7000,
                });
                this.currentAdverseEvent.responsibility_entries = [];
                responsibilityEntriesStore.resetResponsibilityEntry();
                return response.data;
            } catch (error) {
                logger.error('createAdverseEvent_error', {
                    file: 'apiStore',
                    function: 'createAdverseEvent',
                    condition: `❌ Ошибка создания НС: ${error}`,
                })
                feedbackStore.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: `Не удалось зарегистрировать НС: ${error}`,
                    time: 7000,
                });
                throw error;
            } finally {
                feedbackStore.isGlobalLoading = false;
            }
        },

        /**
         * Берёт нежелательное событие (НС) в работу через API
         *
         * Последовательность действий:
         * 1. Активирует глобальный индикатор загрузки
         * 2. Отправляет POST-запрос на сервер для смены статуса НС на "in-progress"
         * 3. При успехе:
         *    - Перезапрашивает данные НС по ID
         *    - Показывает уведомление об успехе
         * 4. При ошибке:
         *    - Логирует ошибку
         *    - Показывает уведомление с ошибкой
         *    - Пробрасывает исключение дальше
         * 5. В любом случае выключает индикатор загрузки
         *
         * @param payload Объект с ID НС
         * @throws {Error} В случае ошибки API или сети
         */
        async takeAdverseEvent(payload: {id: number}): Promise<void> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true
            try {
                await axios.post(
                    `${BASE_URL}/api/adverse/adverse-event/${payload.id}/in-progress/`
                )
                await this.fetchAdverseEventById({ id: payload.id })
                feedbackStore.showToast({
                    type: 'success',
                    title: 'Успех',
                    message: 'НС взято в работу',
                    time: 5000,
                })
            } catch (error) {
                logger.error('takeAdverseEvent_error', {
                    file: 'apiStore',
                    function: 'takeAdverseEvent',
                    condition: `❌ Ошибка взятия НС в работу: ${error}`,
                })
                feedbackStore.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: `Не удалось взять НС в работу: ${error}`,
                    time: 7000,
                })
                throw error
            } finally {
                feedbackStore.isGlobalLoading = false
            }
        },

        /**
         * Завершает нежелательное событие (НС) через API
         *
         * Последовательность действий:
         * 1. Активирует глобальный индикатор загрузки
         * 2. Отправляет POST-запрос на сервер для смены статуса НС на "complete"
         * 3. При успехе:
         *    - Перезапрашивает данные НС по ID
         *    - Показывает уведомление об успехе
         * 4. При ошибке:
         *    - Логирует ошибку
         *    - Показывает уведомление с ошибкой
         *    - Пробрасывает исключение дальше
         * 5. В любом случае выключает индикатор загрузки
         *
         * @param payload Объект с ID НС
         * @throws {Error} В случае ошибки API или сети
         */
        async completeAdverseEvent(payload: {id: number}): Promise<void> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true
            try {
                await axios.post(
                    `${BASE_URL}/api/adverse/adverse-event/${payload.id}/complete/`
                )
                await this.fetchAdverseEventById({ id: payload.id })
                feedbackStore.showToast({
                    type: 'success',
                    title: 'Успех',
                    message: 'НС завершено',
                    time: 5000,
                })
            } catch (error) {
                logger.error('completeAdverseEvent_error', {
                    file: 'apiStore',
                    function: 'completeAdverseEvent',
                    condition: `❌ Ошибка при завершении НС: ${error}`,
                })
                feedbackStore.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: `Не удалось завершить НС: ${error}`,
                    time: 7000,
                })
                throw error
            } finally {
                feedbackStore.isGlobalLoading = false
            }
        },


                                    // GET

        /**
         * Загружает сводку для тепловой карты с бэка и сохраняет в this.heatmap
         *
         * Последовательность:
         * 1. Включает глобальный индикатор загрузки.
         * 2. Выполняет GET /api/dashboard/summary/.
         * 3. Сохраняет ответ в this.heatmap.
         * 4. В случае ошибки логирует через logger и показывает toast.
         * 5. Всегда выключает индикатор загрузки.
         *
         * @returns {Promise<IHeatMap[]>} данные heatmap
         * @throws Ошибка запроса (пробрасывается дальше)
         */
        async fetchHeatmapSummary(): Promise<IHeatMap[]> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true
            try {
                const response = await axios.get<IHeatMap[]>(`${BASE_URL}/api/dashboard/summary/`)
                // Сохраняем данные в стор
                this.heatmap = response.data ?? []
                return this.heatmap
            } catch (error) {
                logger.error('fetchHeatmapSummary_error', {
                    file: 'apiStore',
                    function: 'fetchHeatmapSummary',
                    condition: `❌ Ошибка получения heatmap: ${error}`,
                })
                feedbackStore.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: `Не удалось загрузить данные тепловой карты: ${String(error)}`,
                    time: 7000,
                })
                throw error
            } finally {
                feedbackStore.isGlobalLoading = false
            }
        },

        /**
         * Загружает статистику для дашборда
         *
         * Последовательность действий:
         * 1. Активирует глобальный индикатор загрузки
         * 2. Выполняет GET-запрос на /api/dashboard/
         * 3. При успехе:
         *    - Сохраняет данные в statsDashboard
         * 4. При ошибке:
         *    - Показывает уведомление с ошибкой
         *    - Логирует ошибку
         * 5. В любом случае выключает индикатор загрузки
         *
         * @throws {Error} В случае ошибки API или сети
         */
        async loadDashboardStats(): Promise<void> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true

            try {
                const response = await axios.get(`${BASE_URL}/api/dashboard/`)
                console.log("ответ Dashboard", response)
                this.statsDashboard = response.data
            } catch (error) {
                logger.error('loadDashboardStats_error', {
                    file: 'apiStore',
                    function: 'loadDashboardStats',
                    condition: `❌ Ошибка загрузки dashboard: ${error}`,
                })
                feedbackStore.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: `Не удалось загрузить данные дашборда`,
                    time: 7000,
                })
                throw error
            } finally {
                feedbackStore.isGlobalLoading = false
            }
        },

        /**
         * Загружает отфильтрованные нежелательные события с сервера
         *
         * Логика работы:
         * * Параметры первого запроса (без cursor):
         *  * - departments, event_types, categories, numbers
         *  * - search
         *  * - created_after / created_before (в API-формате)
         *  * - is_active
         *  * - is_high_risk
         * 2. Для последующих запросов использует только cursor пагинации
         * 3. Обновляет данные в хранилище:
         *    - Добавляет новые события при наличии курсора
         *    - Полностью заменяет список при первом запросе
         *    - Сохраняет статистику и курсор для следующей загрузки
         *
         * @param {string} [cursor] - Ключ пагинации для подгрузки следующей страницы
         * @throws {Error} При ошибке сетевого запроса или API
         */
        async fetchFilteredAdverseEvents(cursor?: string): Promise<void> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true
            try {
                // Собираем параметры из фильтров (только для первого запроса)
                const params: Record<string, string | number | boolean | undefined> = {}

                if (!cursor) {
                    const filters: IFilters = this.filters
                    // Бэкенд принимает и единичные параметры, и CSV-списки: departments, event_types, categories, numbers
                    if (filters.department.length)     params.departments  = filters.department.join(',')
                    if (filters.event_type.length)     params.event_types  = filters.event_type.join(',')
                    if (filters.category.length)       params.categories   = filters.category.join(',')
                    if (filters.search)                params.search       = filters.search
                    if (filters.number !== null)       params.numbers      = String(filters.number)
                    if (filters.created_after) {
                        const createdAfter = toApiDate(filters.created_after)
                        if (createdAfter) params.created_after = createdAfter
                    }
                    if (filters.created_before) {
                        const createdBefore = toApiDate(filters.created_before)
                        if (createdBefore) params.created_before = createdBefore
                    }
                    if (filters.is_active !== undefined) params.is_active = filters.is_active
                    if (filters.is_high_risk !== undefined) params.is_high_risk = filters.is_high_risk
                }
                // Если это запрос следующей страницы — только cursor
                if (cursor) params.cursor = cursor

                const response = await axios.get(`${BASE_URL}/api/adverse/adverse-event/`, { params })

                if (cursor) {
                    // Догружаем к текущим, если есть cursor
                    this.adverseEvents = [...this.adverseEvents, ...response.data.results]
                } else {
                    // Первый запрос — просто заменяем массив
                    this.adverseEvents = response.data.results
                }
                this.adverseEventsStats = response.data.stats
                this.nextAdverseEventsCursor = response.data.next // сохраним next для будущей подгрузки
            } catch (error) {
                logger.error('fetchFilteredAdverseEvents_error', {
                    file: 'apiStore',
                    function: 'fetchFilteredAdverseEvents',
                    condition: `❌ Ошибка фильтрации НС: ${error}`,
                })
                feedbackStore.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: `Не удалось загрузить данные: ${error}`,
                    time: 7000,
                })
                throw error
            } finally {
                feedbackStore.isGlobalLoading = false
            }
        },

        /**
         * Загружает все нежелательные события для последующей клиентской фильтрации
         *
         * Особенности работы:
         * - Выполняет последовательную загрузку всех страниц через пагинацию
         * - Сохраняет объединенный массив всех событий в хранилище
         * - Запоминает статистику из первого полученного ответа
         * - Управляет состоянием загрузки через feedbackStore
         *
         * Используется когда FILTRATION_TYPE !== 'server'
         *
         * Возвращает {Promise<{results: IAdverseEvent[], stats: any}>} Объединенные данные всех страниц
         * @throws {Error} При ошибке загрузки данных
         */
        async fetchAllAdverseEvents() {
            const feedbackStore = useFeedbackStore()
            try {
                feedbackStore.isGlobalLoading = true
                const allEvents = []
                let nextUrl = `${BASE_URL}/api/adverse/adverse-event/`
                let stats = null

                while (nextUrl) {
                    const response = await axios.get(nextUrl)
                    allEvents.push(...response.data.results)
                    if (!stats) stats = response.data.stats
                    nextUrl = response.data.next
                }

                this.adverseEvents = allEvents
                this.adverseEventsStats = stats
                return { results: allEvents, stats }
            } catch (error) {
                logger.error('fetchAllAdverseEvents_error', {
                    file: 'apiStore',
                    function: 'fetchAllAdverseEvents',
                    condition: `❌ Ошибка при получении всех НС: ${error}`,
                })
                feedbackStore.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: `Ошибка при получении списка НС: ${error}`,
                    time: 7000,
                })
                throw error
            } finally {
                feedbackStore.isGlobalLoading = false
            }
        },

        /**
         * Загружает список всех отделений с сервера
         *
         * Логика работы:
         * - Устанавливает флаг загрузки перед началом запроса
         * - Сохраняет полученные отделения в хранилище (this.departments)
         * - В случае ошибки сбрасывает список отделений и показывает уведомление
         * - Гарантированно снимает флаг загрузки в finally
         *
         * Используется для инициализации списка отделений
         * при загрузке модуля работы с нежелательными событиями
         */
        async fetchAllDepartments(): Promise<void> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true
            feedbackStore.isGlobalLoading = true
            try {
                const response = await axios.get(`${BASE_URL}/api/employee/department/`)
                this.departments = response.data.results
            } catch (error) {
                logger.error('fetchAllDepartments_error', {
                    file: 'apiStore',
                    function: 'fetchAllDepartments',
                    condition: `❌ Ошибка получения отделений: ${error}`,
                })
                this.departments = []
                feedbackStore.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: `Ошибка получения списка отделений: ${error}`,
                    time: 7000,
                })
            } finally {
                feedbackStore.isGlobalLoading = false
                feedbackStore.isGlobalLoading = false
            }
        },

        /**
         * Загружает список всех категорий нежелательных событий
         *
         * Основное поведение:
         * - Устанавливает состояние загрузки перед запросом
         * - Сохраняет полученные категории в adverseEventsCategory
         * - Обрабатывает ошибки, сбрасывая список категорий и показывая уведомление
         * - Гарантированно снимает флаг загрузки после выполнения
         *
         * Используется при инициализации модуля работы с НС
         * для получения справочника категорий событий
         */
        async fetchAllAdverseEventCategories(): Promise<void> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true
            feedbackStore.isGlobalLoading = true
            try {
                const response = await axios.get(
                    `${BASE_URL}/api/adverse/adverse-event-category/`
                )
                // Сохраняем массив категорий
                this.adverseEventsCategory = response.data.results
            } catch (error) {
                logger.error('fetchAllAdverseEventCategories_error', {
                    file: 'apiStore',
                    function: 'fetchAllAdverseEventCategories',
                    condition: `❌ Ошибка получения категорий НС: ${error}`,
                })
                this.adverseEventsCategory = []
                feedbackStore.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: `Ошибка при получении категорий НС: ${error}`,
                    time: 7000,
                })
            } finally {
                feedbackStore.isGlobalLoading = false
                feedbackStore.isGlobalLoading = false
            }
        },

        /**
         * Загружает список всех сотрудников с сервера
         *
         * Основная функциональность:
         * - Управляет состоянием загрузки через feedbackStore
         * - Сохраняет полученные данные о сотрудниках без преобразований
         * - В случае ошибки прерывает выполнение и показывает уведомление
         * - Гарантированно снимает флаг загрузки после выполнения
         *
         * Используется для получения актуального списка сотрудников
         * при работе с участниками нежелательных событий
         */
        async fetchAllEmployees(): Promise<void> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true
            feedbackStore.isGlobalLoading = true

            try {
                const response = await axios.get(`${BASE_URL}/api/employee/employee/`)
                // Сохраняем массив сотрудников "как есть"
                this.employees = response.data.results
            } catch (error) {
                logger.error('fetchAllEmployees_error', {
                    file: 'apiStore',
                    function: 'fetchAllEmployees',
                    condition: `❌ Ошибка получения сотрудников: ${error}`,
                })
                feedbackStore.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: `Не удалось загрузить список сотрудников: ${error}`,
                    time: 7000,
                })
                throw error
            } finally {
                feedbackStore.isGlobalLoading = false
                feedbackStore.isGlobalLoading = false
            }
        },

        /**
         * Загружает структуру больницы (корпуса, этажи, помещения)
         *
         * Ключевые особенности:
         * - Получает и сохраняет полную иерархию помещений (госпитальная структура)
         * - Сохраняет только первый элемент из ответа сервера (results[0])
         * - Возвращает полные данные ответа API
         * - При ошибке показывает уведомление и пробрасывает исключение
         *
         * Используется для работы с локациями при создании/редактировании событий
         * и выборе места происшествия
         */
        async fetchHospitalSkeleton() {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true
            feedbackStore.isGlobalLoading = true

            try {
                const response = await axios.get(
                  `${BASE_URL}/api/hospital/hospital/`
                )
                this.hospitalSkeleton = response.data.results
                return response.data
            } catch (error) {
                logger.error('fetchHospitalSkeleton_error', {
                    file: 'apiStore',
                    function: 'fetchHospitalSkeleton',
                    condition: `❌ Ошибка получения данных больницы: ${error}`,
                })
                feedbackStore.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: `Не удалось загрузить данные больницы: ${error}`,
                    time: 7000
                })
                throw error
            } finally {
                feedbackStore.isGlobalLoading = false
                feedbackStore.isGlobalLoading = false
            }
        },

        /**
         * Загружает детальную информацию о нежелательном событии по ID
         *
         * Основные функции:
         * - Получает полные данные события с сервера
         * - Сохраняет в currentAdverseEvent (для формы редактирования)
         * - Создает контрольную копию в editableAdverseEvent для сравнения изменений
         * - Преобразует строковые даты в Date объекты:
         *   - Основная дата события
         *   - Сроки выполнения мероприятий
         *   - Даты создания/обновления записей
         *
         * Особенности:
         * - Управляет состоянием загрузки через feedbackStore
         * - Обрабатывает и пробрасывает ошибки API
         * - Используется при открытии формы редактирования события
         */
        async fetchAdverseEventById(payload: { id: number }): Promise<void> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true
            feedbackStore.isGlobalLoading = true
            try {
                const response = await axios.get(`${BASE_URL}/api/adverse/adverse-event/${payload.id}/`)
                const result = response.data
                // // [ИЗМЕНЕНИЕ] Сохраняем в currentAdverseEvent (для формы)
                Object.assign(this.currentAdverseEvent, result)
                this.currentAdverseEvent.date_time = new Date(result.date_time)
                this.currentAdverseEvent.responsibility_entries = result.responsibility_entries?.map(
                    (entry: IResponsibilityEntry) => ({
                        ...entry,
                        deadline_time: entry.deadline_time ? new Date(entry.deadline_time) : null,
                        created_at: entry.created_at ? new Date(entry.created_at) : null,
                        updated_at: entry.updated_at ? new Date(entry.updated_at) : null,
                    })
                ) || []

                // // [ИЗМЕНЕНИЕ] Контрольный слепок — для сравнения при сабмите
                this.editableAdverseEvent = JSON.parse(JSON.stringify(this.currentAdverseEvent))
            } catch (error) {
                logger.error('fetchAdverseEventById_error', {
                    file: 'apiStore',
                    function: 'fetchAdverseEventById',
                    condition: `❌ Ошибка получения НС по ID: ${error}`,
                })
                feedbackStore.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: `Не удалось получить нежелательное событие: ${error}`,
                    time: 7000,
                })
                throw error
            } finally {
                feedbackStore.isGlobalLoading = false
                feedbackStore.isGlobalLoading = false
            }
        },

        /**
         * Получает участников конкретного нежелательного события
         *
         * Особенности работы:
         * - Загружает данные участников по ID события и участника
         * - Включает/выключает глобальный индикатор загрузки
         * - Логирует полученные данные в консоль для отладки
         * - Возвращает сырые данные с сервера без преобразований
         * - Генерирует уведомление об ошибке при неудачном запросе
         *
         * Используется при необходимости получить детальную информацию
         * об отдельных участниках события
         */
        async getAdverseEventParticipants(payload: { eventId: number; id: number }): Promise<any> {
            const feedbackStore = useFeedbackStore() // стор для уведомлений
            feedbackStore.isGlobalLoading = true // включаем индикатор загрузки
            try {
                const response = await axios.get(
                    `${BASE_URL}/api/adverse/adverse-event/${payload.eventId}/participants/${payload.id}/`
                )
                const result = response.data
                return result // возвращаем данные
            } catch (error) {
                logger.error('getAdverseEventParticipants_error', {
                    file: 'apiStore',
                    function: 'getAdverseEventParticipants',
                    condition: `❌ Ошибка получения участников НС: ${error}`,
                })
                feedbackStore.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: `Не удалось получить участников НС: ${error}`,
                    time: 7000,
                })
                throw error
            } finally {
                feedbackStore.isGlobalLoading = false // выключаем индикатор загрузки
            }
        },

                                    // DELETE
        /**
         * Удаляет нежелательное событие по указанному ID
         *
         * Логика работы:
         * - Отправляет DELETE-запрос на сервер для удаления события
         * - При успешном удалении (статус 204) показывает уведомление об успехе
         * - В случае ошибки выводит сообщение в консоль и показывает уведомление
         * - Управляет состоянием загрузки через feedbackStore
         *
         * Особенности:
         * - Не возвращает данные после удаления
         * - Не изменяет локальное состояние хранилища (актуальные данные нужно загружать отдельно)
         * - Используется при подтвержденном удалении событий из интерфейса
         */
        async deleteAdverseEvent(payload: { id: number }): Promise<void> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true

            try {
                const response = await axios.delete(`${BASE_URL}/api/adverse/adverse-event/${payload.id}/`)

                if (response.status === 204) {
                    feedbackStore.showToast({
                        type: 'success',
                        title: 'Удаление завершено',
                        message: 'Нежелательное событие успешно удалено',
                        time: 7000,
                    })
                }
            } catch (error) {
                logger.error('deleteAdverseEvent_error', {
                    file: 'apiStore',
                    function: 'deleteAdverseEvent',
                    condition: `❌ Ошибка удаления НС: ${error}`,
                })
                feedbackStore.showToast({
                    type: 'error',
                    title: 'Удаление не произошло',
                    message: 'Произошла ошибка при удалении нежелательного события',
                    time: 7000,
                })
            } finally {
                feedbackStore.isGlobalLoading = false
            }
        },

                                    //PATCH
        /**
         * Обновляет данные нежелательного события через API
         *
         * Основные функции:
         * - Отправляет PATCH-запрос с обновленными данными события
         * - Обновляет данные в локальном хранилище после успешного ответа сервера
         * - Показывает уведомления о результате операции
         * - Возвращает обновленные данные события
         *
         * Особенности:
         * - Находит и заменяет событие в массиве adverseEvents по ID
         * - Использует глобальный индикатор загрузки
         * - Пробрасывает ошибку для дальнейшей обработки
         * - Логирует процесс обновления в консоли
         *
         * Принимает {number} id - ID обновляемого события
         * Принимает {ICreateAdversePayload} payload - Обновленные данные события
         * @returns {Promise<IAdverseEvent>} Обновленные данные события
         * @throws {Error} В случае ошибки обновления
         */
        async updateAdverseEvent({ id, payload }: { id: number; payload: ICreateAdversePayload }): Promise<IAdverseEvent> {
            const feedbackStore = useFeedbackStore();
            feedbackStore.isGlobalLoading = true;
            console.log()

            try {
                // // PATCH-запрос на обновление события
                const response = await axios.patch<IAdverseEvent>(
                    `${BASE_URL}/api/adverse/adverse-event/${id}/`,
                    payload
                );

                // // Находим индекс обновляемого события
                const index = this.adverseEvents.findIndex((item: IAdverseEvent) => item.id === id);
                if (index !== -1) {
                    // // Обновляем локальное хранилище события
                    this.adverseEvents[index] = response.data;
                }

                feedbackStore.showToast({
                    type: 'success',
                    title: 'Успех',
                    message: 'НС успешно обновлено',
                    time: 4000,
                });

                return response.data;
            } catch (error) {
                logger.error('updateAdverseEvent_error', {
                    file: 'apiStore',
                    function: 'updateAdverseEvent',
                    condition: `❌ Ошибка обновления НС: ${error}`,
                })
                feedbackStore.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: `Не удалось обновить НС: ${error}`,
                    time: 7000,
                });
                throw error;
            } finally {
                // // Отключаем индикатор загрузки
                feedbackStore.isGlobalLoading = false;
            }
        },

                                    // WITHOUT AXIOS

        /**
         * Загрузка нежелательных событий с учетом типа фильтрации
         *
         * Автоматически выбирает стратегию загрузки в зависимости от FILTRATION_TYPE:
         * - 'server' - загружает отфильтрованные данные с сервера (fetchFilteredAdverseEvents)
         * - другие значения - загружает все события для последующей клиентской фильтрации (fetchAllAdverseEvents)
         *
         * Возвращает результат выполнения соответствующего метода загрузки
         */
        async loadAdverseEvents() {
            return this.filtrationType === 'server'
                ? this.fetchFilteredAdverseEvents()
                : this.fetchAllAdverseEvents()
        },

        /**
         * Сбрасывает все фильтры нежелательных событий к значениям по умолчанию
         *
         * Восстанавливает начальное состояние фильтров:
         * - Очищает массивы выбранных отделений, типов и категорий событий
         * - Сбрасывает текстовый поиск
         * - Обнуляет фильтры по номеру и датам
         *
         * Используется:
         * - При ручном сбросе фильтров пользователем
         * - При переходе между разделами приложения
         * - Для очистки формы фильтрации
         */
        resetFilters() {
            this.filters = {
                department: [],
                event_type: [],
                category: [],
                search: '',
                number: null,
                created_after: null,
                created_before: null,
                is_active: false,
                is_high_risk: false,
            }
        },
    }
})

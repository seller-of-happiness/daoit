import axios, { AxiosProgressEvent } from 'axios'
import { defineStore } from 'pinia'
import { useFeedbackStore } from '@/refactoring/modules/feedback/stores/feedbackStore'
import { useUserStore } from '@/refactoring/modules/user/stores/userStore'
import { useApiStore } from '@/refactoring/modules/apiStore/stores/apiStore'
import { useFilesStore } from '@/refactoring/modules/files/stores/filesStore'
import { BASE_URL } from '@/refactoring/environment/environment'
import { logger } from '@/refactoring/utils/eventLogger'
import type { IFormMode } from '@/refactoring/modules/responsibilityEntries/types/IFormMode'
import type { IResponsibilityEntriesState } from '@/refactoring/modules/responsibilityEntries/types/IResponsibilityEntriesState'
import type { IResponsibilityEntry } from '@/refactoring/modules/responsibilityEntries/types/IResponsibilityEntry'
import type { ICreateResponsibilityEntryPayload } from '@/refactoring/modules/responsibilityEntries/types/payloads/ICreateResponsibilityEntryPayload'
import type { IGetResponsibilityEntriesPayload } from '@/refactoring/modules/responsibilityEntries/types/payloads/IGetResponsibilityEntriesPayload'
import type { IResponsibilityEntryActionPayload } from '@/refactoring/modules/responsibilityEntries/types/payloads/IResponsibilityEntryActionPayload'
import type { IResponsibilityEntryTransferPayload } from '@/refactoring/modules/responsibilityEntries/types/payloads/IResponsibilityEntryTransferPayload'

export const useResponsibilityEntries = defineStore('responsibilityEntries', {
    state: (): IResponsibilityEntriesState => {
        const userStore = useUserStore()
        return {
            currentResponsibilityEntries: [],
            responsibilityEntry: {
                instructions: '',
                urgency: 0,
                department_from: userStore.user?.department
                    ? { ...userStore.user.department }
                    : null,
                supervisor: userStore.user
                    ? {
                        id: userStore.user.id,
                        first_name: userStore.user.first_name,
                        last_name: userStore.user.last_name,
                        middle_name: userStore.user.middle_name,
                        gender: userStore.user.gender,
                        phone_number: userStore.user.phone_number,
                        birth_date: userStore.user.birth_date,
                    }
                    : null,
                department_to: null,
                responsible_employee: null,
                completion_report: '',
                deadline_time: null,
                files: [],
            },
            fieldValidation: {
                adverseEventValidation: {
                event_type: false,
                date_time: false,
                description: false,
                },
                responsibilityValidation: {
                    employee_type: false,
                    instructions_type: false,
                    deadline_type: false,
                }
            },
            formMode: "add",
            isCreatingEntry: false,
        }
    },
    actions: {
        /**
         * Создает новую запись ответственности для нежелательного события
         *
         * Основные действия:
         * - Отправляет данные мероприятия на сервер (без дублирования event_id в теле)
         * - Показывает уведомления о результате операции
         * - Сбрасывает состояние формы после успешного создания
         * - Возвращает созданную запись для дальнейшей обработки
         *
         * Особенности:
         * - Разделяет event_id (в URL) и данные мероприятия (в теле запроса)
         * - Управляет глобальным состоянием загрузки
         * - Восстанавливает чистую форму после успешного выполнения
         */
        async createResponsibilityEntry(payload: ICreateResponsibilityEntryPayload): Promise<IResponsibilityEntry> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true
            try {
                // event_id подставляем только в URL, в теле только само мероприятие
                const { event_id, ...body } = payload
                const response = await axios.post<IResponsibilityEntry>(
                    `${BASE_URL}/api/adverse/adverse-event/${event_id}/responsibility-entries/`,
                    body
                )
                feedbackStore.showToast({
                    type: 'success',
                    title: 'Создание записи ответственности',
                    message: `Запись ответственности успешно создана`,
                    time: 7000,
                })
                this.resetResponsibilityEntry();
                return response.data
            } catch (error) {
                logger.error('createResponsibilityEntry_error', {
                    file: 'responsibilityEntriesStore',
                    function: 'createResponsibilityEntry',
                    condition: `❌ Ошибка создания записи: ${error}`,
                })
                feedbackStore.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: `Не удалось создать запись ответственности: ${error}`,
                    time: 7000,
                })
                throw error
            } finally {
                feedbackStore.isGlobalLoading = false
            }
        },

        /**
         * Получает список записей ответственности для указанного события
         *
         * Основные действия:
         * - Загружает записи ответственности по ID события
         * - Сохраняет полученные данные в хранилище
         * - Обрабатывает ошибки с показом уведомлений
         *
         * Особенности:
         * - Использует глобальный индикатор загрузки
         * - Работает только с записями конкретного события
         * - Сохраняет полный массив записей (не добавляет к существующим)
         */
        async getResponsibilityEntries(payload: IGetResponsibilityEntriesPayload): Promise<void> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true
            try {
                const response = await axios.get<{ results: IResponsibilityEntry[] }>(
                    `${BASE_URL}/api/adverse/adverse-event/${payload.event_id}/responsibility-entries/`
                )
                this.currentResponsibilityEntries = response.data.results // // Изменено: сохраняем массив
            } catch (error) {
                logger.error('getResponsibilityEntries_error', {
                    file: 'responsibilityEntriesStore',
                    function: 'getResponsibilityEntries',
                    condition: `❌ Ошибка загрузки записей: ${error}`,
                })
                feedbackStore.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: `Не удалось получить записи ответственности: ${error}`,
                    time: 7000,
                })
                throw error
            } finally {
                feedbackStore.isGlobalLoading = false
            }
        },

        /**
         * Сбрасывает форму записи ответственности к начальным значениям
         *
         * Основные действия:
         * - Устанавливает пустые/дефолтные значения для всех полей
         * - Подтягивает данные текущего пользователя (отправителя) из userStore
         *
         * Особенности:
         * - Использует данные сотрудника из профиля пользователя
         * - Сохраняет ссылки на отдел и сотрудника-инициатора
         * - Очищает все остальные поля формы
         */
        resetResponsibilityEntry() {
            const userStore = useUserStore()
            this.responsibilityEntry = {
                instructions: '',
                urgency: 0,
                department_from: userStore.user?.department
                    ? { ...userStore.user.department }
                    : null,
                supervisor: userStore.user
                    ? {
                        id: userStore.user.id,
                        first_name: userStore.user.first_name,
                        last_name: userStore.user.last_name,
                        middle_name: userStore.user.middle_name,
                        gender: userStore.user.gender,
                        phone_number: userStore.user.phone_number,
                        birth_date: userStore.user.birth_date,
                    }
                    : null,
                department_to: null,
                responsible_employee: null,
                completion_report: '',
                deadline_time: null,
                files: [],
            }
        },

        /**
         * Добавляет временную запись ответственности в текущее событие
         *
         * Условия добавления:
         * - Должен быть указан получатель (отдел или сотрудник)
         *
         * Особенности:
         * - Проверяет заполнение обязательных полей перед добавлением
         * - Логирует процесс добавления в консоль
         * - Сохраняет только необходимые данные (без избыточной информации)
         * - Обновляет массив мероприятий в текущем событии
         *
         * Используется перед отправкой формы для сохранения временных данных
         */
        pushTempResponsibilityEntry() {
            const entry = this.responsibilityEntry
            if (
                (entry.department_to && entry.department_to.id) ||
                (entry.responsible_employee && entry.responsible_employee.id)
            ) {
                const apiStore = useApiStore()
                const list = Array.isArray(apiStore.currentAdverseEvent.responsibility_entries)
                    ? apiStore.currentAdverseEvent.responsibility_entries
                    : []

                const temp = {
                    id: 0,                      // временный
                    can_complete: false,        // временный

                    department_from: entry.department_from
                        ? { id: String(entry.department_from.id), name: entry.department_from.name ?? '' }
                        : null,
                    supervisor: entry.supervisor ? { ...entry.supervisor } : null,
                    department_to: entry.department_to ? { id: entry.department_to.id } : null,
                    responsible_employee: entry.responsible_employee ? { id: entry.responsible_employee.id } : null,
                    instructions: entry.instructions ?? '',
                    completion_report: entry.completion_report ?? '',
                    urgency: entry.urgency ?? 0,
                    deadline_time: entry.deadline_time ?? null,
                    files: (entry.files as File[]) ?? [],
                }

                apiStore.currentAdverseEvent.responsibility_entries = [...list, temp]
            }
        },

        /**
         * Отмечает запись ответственности как завершенную
         *
         * Основные действия:
         * - Отправляет запрос на сервер для завершения записи
         * - Обновляет список записей после успешного выполнения
         * - Показывает соответствующие уведомления
         *
         * Особенности:
         * - Использует глобальный индикатор загрузки
         * - Логирует ошибки в систему мониторинга
         * - Автоматически обновляет данные после успешного выполнения
         * - Пробрасывает ошибку для дальнейшей обработки
         */
        async completeResponsibilityEntry(payload: IResponsibilityEntryActionPayload): Promise<void> {
            const feedbackStore = useFeedbackStore()
            const filesStore = useFilesStore()

            feedbackStore.isGlobalLoading = true
            const url = `${BASE_URL}/api/adverse/adverse-event/${payload.event_id}/responsibility-entries/${payload.entry_id}/complete/`


            const form = new FormData()
            form.append('completion_report', String(payload.completion_report ?? ''))

            // Файлы под мульти-ключом 'files'
            const filesForSend = filesStore.normalizeToFileArray((payload as any)?.files)
            const hasFiles = filesForSend.length > 0
            if (hasFiles) {
                for (const f of filesForSend) form.append('files', f)
            }

            try {
                if (hasFiles) {
                    filesStore.startUpload('responsibility-complete', filesForSend.map(f => ({ name: f.name, size: f.size, type: f.type })))
                }

                await axios.post(url, form, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    onUploadProgress: (e: AxiosProgressEvent) => {
                        if (!hasFiles) return
                        filesStore.onUploadProgress(e.loaded, (e as any).total ?? null)
                    },
                })

                if (hasFiles) filesStore.finishUpload(true)

                await this.getResponsibilityEntries({ event_id: payload.event_id })
                feedbackStore.showToast({ type: 'success', title: 'Успех', message: 'Запись успешно завершена', time: 5000 })
            } catch (error) {
                if (hasFiles) filesStore.finishUpload(false)
                logger.error('completeResponsibilityEntry_error', { file: 'responsibilityEntriesStore', function: 'completeResponsibilityEntry', condition: `❌ Ошибка завершения записи: ${error}` })
                feedbackStore.showToast({ type: 'error', title: 'Ошибка', message: `Не удалось завершить запись: ${error}`, time: 7000 })
                throw error
            } finally {
                if (hasFiles) setTimeout(() => filesStore.resetUpload(), 500)
                feedbackStore.isGlobalLoading = false
            }
        },

        /**
         * Отменяет запись ответственности
         *
         * Основные действия:
         * - Отправляет запрос на отмену записи ответственности
         * - Обновляет список записей после успешной отмены
         * - Управляет состоянием загрузки и уведомлениями
         *
         * Особенности:
         * - Автоматически обновляет данные после успешного выполнения
         * - Логирует ошибки для последующего анализа
         * - Пробрасывает исключения для обработки в вызывающем коде
         * - Использует единый формат уведомлений об успехе/ошибке
         */
        async cancelResponsibilityEntry(payload: IResponsibilityEntryActionPayload): Promise<void> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true
            try {
                await axios.post(
                    `${BASE_URL}/api/adverse/adverse-event/${payload.event_id}/responsibility-entries/${payload.entry_id}/cancel/`
                )
                await this.getResponsibilityEntries({ event_id: payload.event_id })
                feedbackStore.showToast({
                    type: 'success',
                    title: 'Успех',
                    message: 'Запись успешно отменена',
                    time: 5000,
                })
            } catch (error) {
                logger.error('cancelResponsibilityEntry_error', {
                    file: 'responsibilityEntriesStore',
                    function: 'cancelResponsibilityEntry',
                    condition: `❌ Ошибка отмены записи: ${error}`,
                })
                feedbackStore.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: `Не удалось отменить запись: ${error}`,
                    time: 7000,
                })
                throw error
            } finally {
                feedbackStore.isGlobalLoading = false
            }
        },

        /**
         * Возвращает запись ответственности на доработку
         *
         * Основные действия:
         * - Отправляет запрос на сервер для возврата записи
         * - Обновляет список записей после успешного выполнения
         * - Покажет уведомление о результате операции
         *
         * Особенности:
         * - Использует глобальный индикатор загрузки
         * - Логирует ошибки для последующего анализа
         * - Автоматически обновляет данные после успеха
         * - Пробрасывает ошибки для обработки в вызывающем коде
         *
         * Используется для возврата записей ответственности на доработку
         */
        async returnResponsibilityEntry(payload: IResponsibilityEntryActionPayload): Promise<void> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true
            try {
                await axios.post(
                    `${BASE_URL}/api/adverse/adverse-event/${payload.event_id}/responsibility-entries/${payload.entry_id}/return_entry/`
                )
                await this.getResponsibilityEntries({ event_id: payload.event_id })
                feedbackStore.showToast({
                    type: 'success',
                    title: 'Успех',
                    message: 'Запись успешно возвращена',
                    time: 5000,
                })
            } catch (error) {
               logger.error('returnResponsibilityEntry_error', {
                    file: 'responsibilityEntriesStore',
                    function: 'returnResponsibilityEntry',
                    condition: `❌ Ошибка возврата записи: ${error}`,
                })
                feedbackStore.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: `Не удалось вернуть запись: ${error}`,
                    time: 7000,
                })
                throw error
            } finally {
                feedbackStore.isGlobalLoading = false
            }
        },

        /**
         * Берет запись ответственности в работу
         *
         * Основные действия:
         * - Отправляет запрос на сервер для взятия записи в работу
         * - Обновляет список записей после успешного выполнения
         * - Управляет состоянием загрузки и уведомлениями
         *
         * Особенности:
         * - Автоматически обновляет данные после успешного выполнения
         * - Логирует ошибки для последующего анализа
         * - Пробрасывает исключения для обработки в вызывающем коде
         * - Использует единый формат уведомлений
         *
         * Применение:
         * - При подтверждении принятия ответственности за мероприятие
         */
        async takeResponsibilityEntry(payload: IResponsibilityEntryActionPayload): Promise<void> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true
            try {
                await axios.post(
                    `${BASE_URL}/api/adverse/adverse-event/${payload.event_id}/responsibility-entries/${payload.entry_id}/in-progress/`
                )
                await this.getResponsibilityEntries({ event_id: payload.event_id })
                feedbackStore.showToast({
                    type: 'success',
                    title: 'Успех',
                    message: 'Запись взята в работу',
                    time: 5000,
                })
            } catch (error) {
                logger.error('takeResponsibilityEntry_error', {
                    file: 'responsibilityEntriesStore',
                    function: 'takeResponsibilityEntry',
                    condition: `❌ Ошибка взятия записи в работу: ${error}`,
                })
                feedbackStore.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: `Не удалось взять запись в работу: ${error}`,
                    time: 7000,
                })
                throw error
            } finally {
                feedbackStore.isGlobalLoading = false
            }
        },

        /**
         * Передает запись ответственности другому сотруднику/отделу
         *
         * Основные действия:
         * - Формирует очищенный payload без служебных полей
         * - Отправляет данные передачи на сервер
         * - Обновляет список записей после успешного выполнения
         * - Управляет состоянием загрузки и уведомлениями
         *
         * Особенности:
         * - Автоматически обновляет данные после успешной передачи
         * - Логирует ошибки для последующего анализа
         * - Пробрасывает исключения для обработки в вызывающем коде
         * - Использует стандартный формат уведомлений
         *
         * Применение:
         * - При необходимости переназначения ответственного за мероприятие
         */
        async transferResponsibilityEntry(payload: IResponsibilityEntryTransferPayload): Promise<void> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true

            // Создаем чистый payload только с данными записи
            const transferData = {
                department_from: payload.department_from,
                supervisor: payload.supervisor,
                department_to: payload.department_to,
                responsible_employee: payload.responsible_employee,
                completion_report: payload.completion_report,
                instructions: payload.instructions,
                urgency: payload.urgency,
                deadline_time: payload.deadline_time,
                files: payload.files || []
            }

            try {
                await axios.post(
                    `${BASE_URL}/api/adverse/adverse-event/${payload.event_id}/responsibility-entries/${payload.entry_id}/transfer/`,
                    transferData
                )
                await this.getResponsibilityEntries({ event_id: payload.event_id })
                feedbackStore.showToast({
                    type: 'success',
                    title: 'Успех',
                    message: 'Запись успешно передана',
                    time: 5000,
                })
            } catch (error) {
                logger.error('transferResponsibilityEntry_error', {
                    file: 'responsibilityEntriesStore',
                    function: 'transferResponsibilityEntry',
                    condition: `❌ Ошибка передачи записи: ${error}`,
                })
                feedbackStore.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: `Не удалось передать запись: ${error}`,
                    time: 7000,
                })
                throw error
            } finally {
                feedbackStore.isGlobalLoading = false
            }
        },

        /**
         * Устанавливает режим работы формы
         *
         * Используется для переключения между состояниями:
         * - 'add' - создание новой записи
         * - 'edit' - редактирование существующей
         * - 'transfer' - передача ответственности
         *
         * Особенности:
         * - Простое переключение внутреннего состояния
         * - Не выполняет дополнительных проверок
         * - Используется перед началом работы с формой
         */
        setFormMode(mode: IFormMode): void {
            this.formMode = mode
        },

        /**
         * Берет тикет в работу
         *
         * Основные действия:
         * - Отправляет запрос на изменение статуса записи на "in-progress"
         * - Обновляет список записей после успешного выполнения
         * - Управляет состоянием загрузки и уведомлениями
         *
         * Особенности:
         * - Автоматически обновляет данные после выполнения
         * - Логирует ошибки для последующего анализа
         * - Пробрасывает исключения для обработки в вызывающем коде
         *
         * Применение:
         * - Когда сотрудник принимает запись ответственности в работу
         */
        async takeTicketResponsibilityEntry(payload: { event_id: number; entry_id: number }): Promise<void> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true

            try {
                await axios.post(
                    `${BASE_URL}/api/ticket/ticket/${payload.event_id}/responsibility-entries/${payload.entry_id}/in-progress/`
                )
                await this.getResponsibilityEntries({ event_id: payload.event_id })
                feedbackStore.showToast({
                    type: 'success',
                    title: 'Успех',
                    message: 'Запись успешно взята в работу',
                    time: 5000,
                })
            } catch (error) {
                logger.error('takeTicketResponsibilityEntry_error', {
                    file: 'responsibilityEntriesStore',
                    function: 'takeTicketResponsibilityEntry',
                    condition: `❌ Ошибка при взятии записи в работу: ${error}`,
                })
                feedbackStore.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: `Не удалось взять запись в работу: ${error}`,
                    time: 7000,
                })
                throw error
            } finally {
                feedbackStore.isGlobalLoading = false
            }
        },

        /**
         * Завершает тикет
         *
         * Основные действия:
         * - Формирует FormData с отчетом о выполнении и прикрепленными файлами
         * - Отправляет запрос на завершение записи
         * - Обновляет список записей после успешного выполнения
         * - Управляет состоянием загрузки и уведомлениями
         *
         * Особенности:
         * - Поддерживает загрузку файлов
         * - Автоматически обновляет данные после выполнения
         * - Логирует ошибки для последующего анализа
         * - Пробрасывает исключения для обработки в вызывающем коде
         *
         * Применение:
         * - При завершении задачи с отчетом и файлами
         */
        async completeTicketResponsibilityEntry(payload: {
            event_id: number
            entry_id: number
            completion_report: string
            files?: File[]
        }): Promise<void> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true

            const formData = new FormData()
            formData.append('completion_report', payload.completion_report)

            if (payload.files && payload.files.length) {
                payload.files.forEach(file => {
                    formData.append('files', file)
                })
            }

            try {
                await axios.post(
                    `${BASE_URL}/api/ticket/ticket/${payload.event_id}/responsibility-entries/${payload.entry_id}/complete/`,
                    formData,
                    { headers: { 'Content-Type': 'multipart/form-data' } }
                )
                await this.getResponsibilityEntries({ event_id: payload.event_id })
                feedbackStore.showToast({
                    type: 'success',
                    title: 'Успех',
                    message: 'Запись успешно завершена',
                    time: 5000,
                })
            } catch (error) {
                logger.error('completeTicketResponsibilityEntry_error', {
                    file: 'responsibilityEntriesStore',
                    function: 'completeTicketResponsibilityEntry',
                    condition: `❌ Ошибка завершения записи: ${error}`,
                })
                feedbackStore.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: `Не удалось завершить запись: ${error}`,
                    time: 7000,
                })
                throw error
            } finally {
                feedbackStore.isGlobalLoading = false
            }
        },

        /**
         * Создает новую запись ответственности для тикета
         *
         * Основные действия:
         * - Отправляет данные мероприятия на сервер для тикета
         * - Показывает уведомления о результате операции
         * - Сбрасывает состояние формы после успешного создания
         * - Возвращает созданную запись для дальнейшей обработки
         *
         * Особенности:
         * - Разделяет event_id (в URL) и данные мероприятия (в теле запроса)
         * - Управляет глобальным состоянием загрузки
         * - Восстанавливает чистую форму после успешного выполнения
         */
        async createTicketResponsibilityEntry(payload: ICreateResponsibilityEntryPayload) {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true
            try {
                const { event_id, ...body } = payload
                const response = await axios.post(
                    `${BASE_URL}/api/ticket/ticket/${event_id}/responsibility-entries/`,
                    body
                )
                feedbackStore.showToast({
                    type: 'success',
                    title: 'Создание записи ответственности',
                    message: `Запись ответственности успешно создана`,
                    time: 7000,
                })
                this.resetResponsibilityEntry();
                return response.data
            } catch (error) {
                logger.error('createTicketResponsibilityEntry_error', {
                    file: 'responsibilityEntriesStore',
                    function: 'createTicketResponsibilityEntry',
                    condition: `❌ Ошибка создания записи для тикета: ${error}`,
                })
                feedbackStore.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: `Не удалось создать запись ответственности для тикета: ${error}`,
                    time: 7000,
                })
                throw error
            } finally {
                feedbackStore.isGlobalLoading = false
            }
        }
    },
    getters: {}
})


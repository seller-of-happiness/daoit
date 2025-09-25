import axios from 'axios'
import { defineStore } from 'pinia'
import { BASE_URL } from '@/refactoring/environment/environment'
import { useFeedbackStore } from '@/refactoring/modules/feedback/stores/feedbackStore'
import { logger } from '@/refactoring/utils/eventLogger'
import { UploadPhase } from '@/refactoring/modules/supportService/stores/IUploadPhase'

import type { ITicketDetail } from '@/refactoring/modules/tickets/types/ITicketDetail'
import type { IFilesStoreState } from '@/refactoring/modules/files/types/IFilesStoreState'
import type { FileVisibility } from '@/refactoring/modules/files/types/FileVisibility'
import type { IEmployeeFile } from '@/refactoring/modules/files/types/IEmployeeFile'


export const useFilesStore = defineStore('filesStore', {
  state: (): IFilesStoreState => ({
      rootFiles: [],
      departmentFiles: [],
      visibleFiles: [],
      otherDepartments: [],
      isUploading: false,
      uploadState: {
          active: false,
          phase: null,
          loaded: 0,
          total: 0,
          pct: 0,
          files: [],
          error: null,
      },
  }),

  actions: {
    async fetchAllLists(withEmpty = false): Promise<void> {
      const feedback = useFeedbackStore()
      feedback.isGlobalLoading = true
      try {
        const [visibleRes, rootRes, depRes, othersRes] = await Promise.all([
          axios.get(`${BASE_URL}/api/files/employee-file/`),
          axios.get(`${BASE_URL}/api/files/employee-file/root/`),
          axios.get(`${BASE_URL}/api/files/employee-file/department/`),
          axios.get(`${BASE_URL}/api/files/employee-file/others/`, { params: { with_empty: withEmpty ? 1 : 0 } }),
        ])
        this.visibleFiles = visibleRes.data?.results ?? visibleRes.data
        this.rootFiles = rootRes.data
        this.departmentFiles = depRes.data
        this.otherDepartments = othersRes.data
      } catch (error) {
        logger.error('files_fetchAllLists_error', { file: 'filesStore', function: 'fetchAllLists', condition: String(error) })
        useFeedbackStore().showToast({ type: 'error', title: 'Ошибка', message: 'Не удалось загрузить файлы', time: 7000 })
        throw error
      } finally {
        feedback.isGlobalLoading = false
      }
    },

    async uploadFile(payload: { name: string; description?: string; file: File; visibility: FileVisibility }): Promise<IEmployeeFile> {
      const feedback = useFeedbackStore()
      this.isUploading = true
      feedback.isGlobalLoading = true
      try {
        const form = new FormData()
        form.append('name', payload.name)
        if (payload.description) form.append('description', payload.description)
        form.append('file', payload.file)
        form.append('visibility', payload.visibility)

        const res = await axios.post(`${BASE_URL}/api/files/employee-file/`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        // После загрузки обновим списки
        await this.fetchAllLists()
        useFeedbackStore().showToast({ type: 'success', title: 'Успех', message: 'Файл загружен', time: 5000 })
        return res.data
      } catch (error) {
        logger.error('files_uploadFile_error', { file: 'filesStore', function: 'uploadFile', condition: String(error) })
        useFeedbackStore().showToast({ type: 'error', title: 'Ошибка', message: 'Не удалось загрузить файл', time: 7000 })
        throw error
      } finally {
        this.isUploading = false
        feedback.isGlobalLoading = false
      }
    },

    async deleteFile(id: number): Promise<void> {
      const feedback = useFeedbackStore()
      feedback.isGlobalLoading = true
      try {
        await axios.delete(`${BASE_URL}/api/files/employee-file/${id}/`)
        await this.fetchAllLists()
        useFeedbackStore().showToast({ type: 'success', title: 'Удалено', message: 'Файл удалён', time: 4000 })
      } catch (error) {
        logger.error('files_deleteFile_error', { file: 'filesStore', function: 'deleteFile', condition: String(error) })
        useFeedbackStore().showToast({ type: 'error', title: 'Ошибка', message: 'Не удалось удалить файл', time: 7000 })
        throw error
      } finally {
        feedback.isGlobalLoading = false
      }
    },

      /**
       * Назначение:
       * - Нормализует произвольный массив значений в массив валидных `File`.
       * - Поддерживает элементы вида `File` и объекты-обёртки `{ file: File }`.
       *
       * Входные данные:
       * @param {unknown} raw
       *   - Ожидается массив: `Array<File | { file?: File } | unknown>`.
       *   - Любое не-массивное значение приводит к пустому результату.
       *
       * Логика:
       * - Для каждого элемента:
       *   • Если это `instanceof File` → берётся как есть.
       *   • Иначе берётся свойство `.file` и проверяется на `instanceof File`.
       * - Всё, что не является `File`, отбрасывается.
       *
       * Возвращает:
       * @returns {File[]} Массив валидных файлов (может быть пустым).
       */
      normalizeToFileArray(raw: unknown): File[] {
          if (!Array.isArray(raw)) return []
          return raw
              .map((it: unknown) => (it instanceof File ? it : (it as any)?.file))
              .filter((f: unknown): f is File => f instanceof File)
      },

      /**
       * Назначение:
       * - Инициализирует состояние загрузки перед началом отправки данных/файлов.
       * - Сбрасывает счётчики и фиксирует метаданные файлов.
       *
       * Входные данные:
       * @param {UploadPhase | 'responsibility-complete'} phase
       *   - Идентификатор фазы загрузки (пример: 'create' | 'update' | 'responsibility-complete').
       * @param {Array<{ name: string; size: number; type: string }>} files
       *   - Метаданные загружаемых файлов (для UI/телеметрии).
       *
       * Логика:
       * - Устанавливает `this.uploadState`:
       *   • `active: true`, `phase`, `loaded: 0`, `total: 0`, `pct: 0`, `files`, `error: null`.
       * - Пишет диагностический лог в консоль.
       *
       * Возвращает:
       * - Ничего.
       *
       * Побочные эффекты:
       * - Меняет `this.uploadState`, влияет на индикаторы прогресса в UI.
       */
      startUpload(phase: UploadPhase | 'responsibility-complete', files: Array<{ name: string; size: number; type: string }>) {
          this.uploadState = { active: true, phase, loaded: 0, total: 0, pct: 0, files, error: null }
          console.log('[FILES][upload_start]', { phase, files })
      },

      /**
       * Назначение:
       * - Обновляет прогресс загрузки на основании полученных метрик.
       *
       * Входные данные:
       * @param {number} loaded — количество загруженных байт.
       * @param {number|null} total — общий размер, может быть null (неизвестен).
       *
       * Логика:
       * - Берёт `total` из аргумента или из `this.uploadState.total` (если ранее уже известен).
       * - Вычисляет процент:
       *   • если `t > 0` → `Math.round((loaded / t) * 100)`;
       *   • если `t == 0` → `loaded ? 99 : 0` (эвристика для «идёт загрузка» без known total).
       * - Обновляет `this.uploadState.loaded`, `this.uploadState.total`, `this.uploadState.pct`.
       *
       * Возвращает:
       * - Ничего.
       *
       * Побочные эффекты:
       * - Меняет `this.uploadState`, что отражается в прогресс-баре.
       */
      onUploadProgress(loaded: number, total: number | null) {
          const t = total ?? this.uploadState.total ?? 0
          const pct = t ? Math.round((loaded / t) * 100) : (loaded ? 99 : 0)
          this.uploadState.loaded = loaded
          this.uploadState.total = total ?? t
          this.uploadState.pct = pct
      },

      /**
       * Назначение:
       * - Завершает цикл загрузки (успех/ошибка) и переводит состояние в неактивное.
       *
       * Входные данные:
       * @param {boolean} ok — признак успешного завершения.
       *
       * Логика:
       * - Логирует завершение.
       * - Устанавливает:
       *   • `this.uploadState.active = false`
       *   • `this.uploadState.phase = null`
       * - Если `ok === false` и `error` ещё не задан → проставляет `error = 'upload_failed'`.
       *
       * Возвращает:
       * - Ничего.
       *
       * Побочные эффекты:
       * - Меняет `this.uploadState` (деактивация, возможная ошибка).
       */
      finishUpload(ok: boolean) {
          console.log('[FILES][upload_finish]', { ok })
          this.uploadState.active = false
          this.uploadState.phase = null
          if (!ok) this.uploadState.error = this.uploadState.error ?? 'upload_failed'
      },

      /**
       * Назначение:
       * - Полный сброс состояния загрузки к начальному значению.
       *
       * Логика:
       * - Устанавливает `this.uploadState` в дефолт:
       *   { active: false, phase: null, loaded: 0, total: 0, pct: 0, files: [], error: null }.
       *
       * Возвращает:
       * - Ничего.
       *
       * Побочные эффекты:
       * - Полностью очищает прогресс и ошибки загрузки в UI.
       */
      resetUpload() {
          this.uploadState = { active: false, phase: null, loaded: 0, total: 0, pct: 0, files: [], error: null }
      },

      /**
       * Назначение:
       * - Загрузка файлов для конкретного НС (adverse event) с показом прогресса и уведомлений.
       *
       * Алгоритм:
       * 1) Включает глобальный лоадер (feedbackStore.isGlobalLoading = true).
       * 2) Преобразует rawFiles к массиву File через normalizeToFileArray(...).
       *    - Если файлов нет — выключает лоадер и возвращает Promise.resolve([]).
       * 3) Инициализирует прогресс-бар: startUpload(phase, метаданные_файлов).
       * 4) Собирает FormData (мульти-ключ 'files') и POST’ит на:
       *    `${BASE_URL}/api/adverse/adverse-event/${eventId}/files/`
       *    c onUploadProgress → onUploadProgress(loaded, total).
       * 5) Успех: finishUpload(true), показывает Toast «Файлы загружены», возвращает resp.data.
       * 6) Ошибка: finishUpload(false), Toast «Ошибка», логгер logger.error(...), пробрасывает ошибку.
       * 7) finally: через 400ms resetUpload(), выключает глобальный лоадер.
       *
       * Параметры:
       * - eventId: number — ID НС.
       * - rawFiles: Array<File | { file?: File }> — входные файлы/обёртки (например, из UI).
       * - phase: UploadPhase = 'update' — этап загрузки для визуализации/аналитики.
       *
       * Побочные эффекты:
       * - Меняет filesStore.uploadState (startUpload/onUploadProgress/finishUpload/resetUpload).
       * - Показывает Toast’ы.
       * - Меняет feedbackStore.isGlobalLoading.
       *
       * Возвращает:
       * - Promise<any> — данные ответа бэкенда (resp.data) или [] при отсутствии файлов.
       */
      async uploadAdverseEventFiles(eventId: number, rawFiles: Array<File | { file?: File }>, phase: UploadPhase = 'update') {
          const feedbackStore = useFeedbackStore()
          feedbackStore.isGlobalLoading = true

          const files = this.normalizeToFileArray(rawFiles)
          if (!Array.isArray(files) || files.length === 0) {
              feedbackStore.isGlobalLoading = false
              return Promise.resolve([])
          }

          this.startUpload(phase, files.map((f: File) => ({ name: f.name, size: f.size, type: f.type })))

          const form = new FormData()
          for (const f of files) form.append('files', f)

          return axios
              .post(`${BASE_URL}/api/adverse/adverse-event/${eventId}/files/`, form, {
                  headers: { 'Content-Type': 'multipart/form-data' },
                  onUploadProgress: (e: any) => this.onUploadProgress(e.loaded, e.total ?? null),
              })
              .then((resp) => {
                  this.finishUpload(true)
                  // ✅ Toast успеха
                  try {
                      feedbackStore.showToast({
                          type: 'success',
                          title: 'Файлы загружены',
                          message: `Добавлено файлов: ${files.length}`,
                          time: 5000,
                      })
                  } catch (_) { /* noop */ }
                  return resp.data
              })
              .catch((err) => {
                  this.finishUpload(false)
                  // ❌ Toast ошибки
                  try {
                      feedbackStore.showToast({
                          type: 'error',
                          title: 'Ошибка',
                          message: 'Не удалось загрузить файлы НС',
                          time: 7000,
                      })
                  } catch (_) { /* noop */ }
                  // [LOG]
                  try {
                      logger?.error?.('uploadAdverseEventFiles_error', {
                          file: 'filesStore',
                          function: 'uploadAdverseEventFiles',
                          condition: `❌ Ошибка загрузки файлов НС: ${err}`,
                      })
                  } catch (_) { /* noop */ }
                  throw err
              })
              .finally(() => {
                  setTimeout(() => this.resetUpload(), 400)
                  feedbackStore.isGlobalLoading = false
              })
      },

      /**
       * Назначение:
       * - Удаление одного файла НС.
       *
       * Алгоритм:
       * 1) Включает глобальный лоадер.
       * 2) DELETE-запрос на `${BASE_URL}/api/adverse/adverse-event/${eventId}/files/${fileId}/`.
       * 3) Успех: Toast «Файл удалён».
       * 4) Ошибка: Toast «Ошибка удаления», логгер logger.error(...), пробрасывает ошибку.
       * 5) finally: выключает глобальный лоадер.
       *
       * Параметры:
       * - eventId: number — ID НС.
       * - fileId: number — ID файла.
       *
       * Возвращает:
       * - Promise<void>
       */
     async  deleteAdverseEventFile(eventId: number, fileId: number) {
          const feedbackStore = useFeedbackStore()
          feedbackStore.isGlobalLoading = true

          return axios
              .delete(`${BASE_URL}/api/adverse/adverse-event/${eventId}/files/${fileId}/`)
              .then(() => {
                  // ✅ Toast успеха
                  try {
                      feedbackStore.showToast({
                          type: 'success',
                          title: 'Файл удалён',
                          message: `ID: ${fileId}`,
                          time: 4000,
                      })
                  } catch (_) {}
              })
              .catch((error) => {
                  // ❌ Toast ошибки
                  try {
                      feedbackStore.showToast({
                          type: 'error',
                          title: 'Ошибка',
                          message: `Не удалось удалить файл (ID: ${fileId})`,
                          time: 7000,
                      })
                  } catch (_) {}
                  try {
                      logger?.error?.('deleteAdverseEventFile_error', {
                          file: 'filesStore',
                          function: 'deleteAdverseEventFile',
                          condition: `❌ Ошибка удаления файла НС (${fileId}) для события ${eventId}: ${error}`,
                      })
                  } catch (_) {}
                  throw error
              })
              .finally(() => {
                  feedbackStore.isGlobalLoading = false
              })
      },

      /**
       * Назначение:
       * - Загрузка файлов для заявки во вспомогательные службы с прогрессом и уведомлениями.
       *
       * Алгоритм:
       * 1) Включает глобальный лоадер.
       * 2) Преобразует rawFiles через normalizeToFileArray(...).
       *    - Если файлов нет — выключает лоадер и возвращает Promise.resolve([]).
       * 3) startUpload(phase, метаданные_файлов).
       * 4) POST на `${BASE_URL}/api/support/support-service/${supportId}/files/` с FormData (мульти-ключ 'files').
       *    - onUploadProgress → onUploadProgress(loaded, total).
       * 5) Успех: finishUpload(true), Toast «Файлы загружены», возвращает resp.data.
       * 6) Ошибка: finishUpload(false), Toast «Ошибка», logger.error(...), пробрасывает ошибку.
       * 7) finally: через 400ms resetUpload(), выключает глобальный лоадер.
       *
       * Параметры:
       * - supportId: number — ID заявки.
       * - rawFiles: Array<File | { file?: File }> — входные файлы/обёртки.
       * - phase: UploadPhase = 'update' — этап загрузки для прогресса/аналитики.
       *
       * Побочные эффекты:
       * - Меняет filesStore.uploadState и feedbackStore.isGlobalLoading.
       * - Показывает Toast’ы.
       *
       * Возвращает:
       * - Promise<any> — данные ответа бэкенда (resp.data) или [] при отсутствии файлов.
       */
      async uploadSupportServiceFiles(
          supportId: number,
          rawFiles: Array<File | { file?: File }>,
          phase: UploadPhase = 'update'
      ) {
          const feedbackStore = useFeedbackStore()
          feedbackStore.isGlobalLoading = true

          const files = this.normalizeToFileArray(rawFiles)
          if (!Array.isArray(files) || files.length === 0) {
              feedbackStore.isGlobalLoading = false
              return Promise.resolve([])
          }

          this.startUpload(phase, files.map((f: File) => ({ name: f.name, size: f.size, type: f.type })))

          const form = new FormData()
          for (const f of files) form.append('files', f)

          return axios
              .post(`${BASE_URL}/api/support/support-service/${supportId}/files/`, form, {
                  headers: { 'Content-Type': 'multipart/form-data' },
                  onUploadProgress: (e: any) => this.onUploadProgress(e.loaded, e.total ?? null),
              })
              .then((resp) => {
                  this.finishUpload(true)
                  try {
                      feedbackStore.showToast({
                          type: 'success',
                          title: 'Файлы загружены',
                          message: `Добавлено файлов: ${files.length}`,
                          time: 5000,
                      })
                  } catch (_) {}
                  return resp.data
              })
              .catch((err) => {
                  this.finishUpload(false)
                  try {
                      feedbackStore.showToast({
                          type: 'error',
                          title: 'Ошибка',
                          message: 'Не удалось загрузить файлы заявки',
                          time: 7000,
                      })
                  } catch (_) {}
                  try {
                      logger?.error?.('uploadSupportServiceFiles_error', {
                          file: 'filesStore',
                          function: 'uploadSupportServiceFiles',
                          condition: `❌ Ошибка загрузки файлов ВС: ${err}`,
                      })
                  } catch (_) {}
                  throw err
              })
              .finally(() => {
                  setTimeout(() => this.resetUpload(), 400)
                  feedbackStore.isGlobalLoading = false
              })
      },

      /**
       * Назначение:
       * - Удаление одного файла из заявки во вспомогательные службы.
       *
       * Алгоритм:
       * 1) Включает глобальный лоадер.
       * 2) DELETE на `${BASE_URL}/api/support/support-service/${supportId}/files/${fileId}/`.
       * 3) Успех: Toast «Файл удалён».
       * 4) Ошибка: Toast «Ошибка удаления», logger.error(...), пробрасывает ошибку.
       * 5) finally: выключает глобальный лоадер.
       *
       * Параметры:
       * - supportId: number — ID заявки.
       * - fileId: number — ID файла.
       *
       * Возвращает:
       * - Promise<void>
       */
      async deleteSupportServiceFile(supportId: number, fileId: number) {
          const feedbackStore = useFeedbackStore()
          feedbackStore.isGlobalLoading = true

          return axios
              .delete(`${BASE_URL}/api/support/support-service/${supportId}/files/${fileId}/`)
              .then(() => {
                  try {
                      feedbackStore.showToast({
                          type: 'success',
                          title: 'Файл удалён',
                          message: `ID: ${fileId}`,
                          time: 4000,
                      })
                  } catch (_) {}
              })
              .catch((error) => {
                  try {
                      feedbackStore.showToast({
                          type: 'error',
                          title: 'Ошибка',
                          message: `Не удалось удалить файл (ID: ${fileId})`,
                          time: 7000,
                      })
                  } catch (_) {}
                  try {
                      logger?.error?.('deleteSupportServiceFile_error', {
                          file: 'filesStore',
                          function: 'deleteSupportServiceFile',
                          condition: `❌ Ошибка удаления файла ВС (${fileId}) для заявки ${supportId}: ${error}`,
                      })
                  } catch (_) {}
                  throw error
              })
              .finally(() => {
                  feedbackStore.isGlobalLoading = false
              })
      },

      async uploadTicketFiles(
          ticketId: string | number,
          rawFiles: Array<File | { file?: File }>,
          phase: UploadPhase = 'update'
      ): Promise<ITicketDetail['files'] | []> {
          const feedbackStore = useFeedbackStore()
          feedbackStore.isGlobalLoading = true

          try {
              const files = this.normalizeToFileArray(rawFiles)
              if (!files.length) return []

              this.startUpload(phase, files.map(f => ({ name: f.name, size: f.size, type: f.type })))

              const form = new FormData()
              for (const f of files) form.append('files', f)

              const resp = await axios.post<ITicketDetail['files']>(
                  `${BASE_URL}/api/ticket/ticket/${ticketId}/files/`,
                  form,
                  {
                      headers: { 'Content-Type': 'multipart/form-data' },
                      onUploadProgress: (e: any) => this.onUploadProgress(e.loaded ?? 0, e.total ?? null),
                  }
              )

              this.finishUpload(true)
              feedbackStore.showToast?.({
                  type: 'success',
                  title: 'Файлы загружены',
                  message: `Добавлено файлов: ${files.length}`,
                  time: 5000,
              })

              return resp.data ?? []
          } catch (err) {
              this.finishUpload(false)
              feedbackStore.showToast?.({
                  type: 'error',
                  title: 'Ошибка',
                  message: 'Не удалось загрузить файлы тикета',
                  time: 7000,
              })
              logger?.error?.('uploadTicketFiles_error', {
                  file: 'filesStore',
                  function: 'uploadTicketFiles',
                  condition: String(err),
              })
              throw err
          } finally {
              setTimeout(() => this.resetUpload(), 400)
              feedbackStore.isGlobalLoading = false
          }
      },


      async deleteTicketFile(ticketId: number, fileId: number): Promise<void> {
          const feedbackStore = useFeedbackStore()
          feedbackStore.isGlobalLoading = true

          try {
              await axios.delete(`${BASE_URL}/api/ticket/ticket/${ticketId}/files/${fileId}/`)
              feedbackStore.showToast?.({
                  type: 'success',
                  title: 'Файл удалён',
                  message: `ID: ${fileId}`,
                  time: 4000,
              })
          } catch (error) {
              feedbackStore.showToast?.({
                  type: 'error',
                  title: 'Ошибка',
                  message: `Не удалось удалить файл (ID: ${fileId})`,
                  time: 7000,
              })
              logger?.error?.('deleteTicketFile_error', {
                  file: 'filesStore',
                  function: 'deleteTicketFile',
                  condition: String(error),
              })
              throw error
          } finally {
              feedbackStore.isGlobalLoading = false
          }
      },


  },
})



// @ts-nocheck - Временно отключаем проверки типов для Pinia store
import { defineStore } from 'pinia'
import { useFeedbackStore } from '@/refactoring/modules/feedback/stores/feedbackStore'
import { logger } from '@/refactoring/utils/eventLogger'
import { formatFileSize, formatDate, getDocumentIcon } from '@/refactoring/modules/documents/utils/documentUtils'
import { 
    folderIdToUrl, 
    urlToFolderId, 
    pathToUrl, 
    urlToPath, 
    pathToArray, 
    arrayToPath, 
    getParentPath 
} from '@/refactoring/modules/documents/utils/pathUtils'
import { NavigationService, type IBreadcrumb } from '@/refactoring/modules/documents/services/NavigationService'
import { DocumentsApiService } from '@/refactoring/modules/documents/services/DocumentsApiService'
import type {
    IDocumentsStoreState,
    IDocumentItem,
    IDocumentFolder,
    IDocument,
    IDocumentType,
    ICreateDocumentPayload,
    ICreateFolderPayload,
    IListDocumentsPayload,
    IDocumentDetailsResponse,
} from '@/refactoring/modules/documents/types/IDocument'

// Тип для контекста store в actions
type StoreContext = any

// Расширяем интерфейс состояния
interface IExtendedDocumentsStoreState extends Omit<IDocumentsStoreState, 'breadcrumbs'> {
    breadcrumbs: IBreadcrumb[]
    // Поля для предотвращения дублирования запросов
    _lastRequestPath: string | null
    _currentRequest: Promise<void> | null
    // Сервисы
    _navigationService: NavigationService
    _apiService: DocumentsApiService
    // Фильтры
    currentFilters: {
        created_by: string[]
        types: number[]
    }
    isFiltersActive: boolean
    // Пагинация
    pagination: {
        next: string | null
        previous: string | null
        hasNext: boolean
        hasPrevious: boolean
    }
}

import type { IListDocumentsResponse } from '@/refactoring/modules/documents/types/ApiTypes'

export const useDocumentsStore = defineStore('documentsStore', {
    state: (): IExtendedDocumentsStoreState => ({
        currentPath: '/',
        currentFolderId: null,
        currentItems: [],
        documentTypes: [],
        breadcrumbs: [{ name: 'Документы', path: '/', id: null }],
        isLoading: false,
        isNavigating: false,
        selectedItems: new Set(),
        _urlUpdateTimeout: null as ReturnType<typeof setTimeout> | null,
        // Поля для поиска
        searchQuery: '',
        isSearchMode: false,
        searchTimeout: null as ReturnType<typeof setTimeout> | null,
        // Поле для предотвращения дублирования запросов
        _lastRequestPath: null as string | null,
        _currentRequest: null as Promise<void> | null,
        // Сервисы
        _navigationService: new NavigationService(),
        _apiService: new DocumentsApiService(),
        // Фильтры
        currentFilters: {
            created_by: [],
            types: []
        },
        isFiltersActive: false,
        // Пагинация
        pagination: {
            next: null,
            previous: null,
            hasNext: false,
            hasPrevious: false
        },
    }),

    getters: {
        currentFolders: (state: IDocumentsStoreState): IDocumentFolder[] =>
            state.currentItems.filter(
                (item: IDocumentItem): item is IDocumentFolder => !!item.is_dir,
            ),

        currentDocuments: (state: IDocumentsStoreState): IDocument[] =>
            state.currentItems.filter((item: IDocumentItem): item is IDocument => !item.is_dir),

        isRootPath: (state: IDocumentsStoreState): boolean =>
            state.currentPath === '/' && !state.currentFolderId,

        selectedCount: (state: IDocumentsStoreState): number => state.selectedItems.size,

        activeFiltersCount: (state: any): number => {
            return (state as IExtendedDocumentsStoreState).currentFilters.created_by.length + 
                   (state as IExtendedDocumentsStoreState).currentFilters.types.length
        },

        hasActiveFilters: (state: any): boolean => {
            const extState = state as IExtendedDocumentsStoreState
            return extState.currentFilters.created_by.length > 0 || extState.currentFilters.types.length > 0
        },
    },

    actions: {
        async fetchDocumentTypes(): Promise<void> {
            try {
                (this as any).documentTypes = await (this as any)._apiService.fetchDocumentTypes()
            } catch (error) {
                logger.error('documents_fetchTypes_error', {
                    file: 'documentsStore',
                    function: 'fetchDocumentTypes',
                    condition: String(error),
                })
                useFeedbackStore().showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: 'Не удалось загрузить типы документов',
                    time: 5000,
                })
                throw error
            }
        },

        /**
         * Определяет путь для запроса на основе payload
         */
        _getRequestPath(payload: IListDocumentsPayload): string {
            if (payload.folder_id) {
                return payload.folder_id
            } else if (payload.path) {
                return payload.path === '/' ? '/' : payload.path
            } else if (this.currentFolderId) {
                return this.currentFolderId
            } else {
                return this.currentPath
            }
        },

        /**
         * Обрабатывает ответ API и обновляет состояние
         */
        _processApiResponse(data: IListDocumentsResponse, payload: IListDocumentsPayload): void {
            if (!data || typeof data !== 'object') return

            // Новый формат API: results - массив документов напрямую
            if (data.results && Array.isArray(data.results)) {
                this.currentItems = data.results
                this.currentPath = this._getRequestPath(payload)
                this.currentFolderId = payload.folder_id || null
                
                // Обновляем информацию о пагинации
                this._updatePagination(data)
                
                // Обновляем breadcrumbs только если не в режиме поиска
                if (!payload.search) {
                    // Для нового формата создаем минимальные breadcrumbs
                    this._updateBreadcrumbsFromNewFormat(payload)
                }
            }
            // Старый формат API: данные находятся в results как объекте
            else if (data.results && typeof data.results === 'object' && (data.results as any).items) {
                const results = data.results as any
                this.currentPath = results.path || this._getRequestPath(payload)
                this.currentItems = results.items || []
                this.currentFolderId = payload.folder_id || null
                
                // Обновляем breadcrumbs только если не в режиме поиска
                if (!payload.search) {
                    this._updateBreadcrumbsFromResults(results)
                }
            } else {
                // Самый старый формат API для обратной совместимости
                this.currentPath = data.path || this._getRequestPath(payload)
                this.currentFolderId = data.current_folder?.folder_id || payload.folder_id || this.currentFolderId
                this.currentItems = data.items || []

                // Обновляем breadcrumbs только если не в режиме поиска
                if (!payload.search) {
                    this._updateBreadcrumbs(data)
                }
            }
        },

        /**
         * Преобразует API структуру папки в IDocumentFolder
         */
        _convertApiFolderToDocumentFolder(apiFolder: { folder_id: string; name: string; path: string }): IDocumentFolder {
            return {
                id: null,
                folder_id: apiFolder.folder_id,
                name: apiFolder.name,
                description: '',
                path: apiFolder.path,
                virtual_path: null,
                is_dir: true,
                visibility: 'public',
                created_at: null,
                updated_at: null,
                size: null,
                extension: '',
                items: []
            } as IDocumentFolder
        },

        /**
         * Обновляет breadcrumbs на основе данных API (старый формат)
         */
        _updateBreadcrumbs(data: IListDocumentsResponse): void {
            // Кешируем путь текущей папки по её virtual_path
            if (data.virtual_path && data.path) {
                this._navigationService.cacheFolderPath(data.virtual_path, data.path)
            }

            if (data.current_folder && data.parent_folders) {
                const currentFolder = this._convertApiFolderToDocumentFolder(data.current_folder)
                const parentFolders = data.parent_folders.map(folder => this._convertApiFolderToDocumentFolder(folder))
                
                this.breadcrumbs = this._navigationService.updateFolderChainFromApi(
                    currentFolder,
                    parentFolders,
                )
            } else {
                // Обрабатываем virtual_path или name с учетом path_parent (массив или строка)
                const virtualPath = data.virtual_path || data.name || 'Документы'
                const parentPaths = data.path_parent || null
                this.breadcrumbs = this._navigationService.updateBreadcrumbsFromVirtualPath(
                    virtualPath, 
                    parentPaths, 
                    this.currentPath
                )
            }
        },

        /**
         * Обновляет breadcrumbs на основе новой структуры results
         */
        _updateBreadcrumbsFromResults(results: any): void {
            // Кешируем путь текущей папки по её virtual_path
            if (results.virtual_path && results.path) {
                this._navigationService.cacheFolderPath(results.virtual_path, results.path)
            }

            // Для нового формата создаем breadcrumbs на основе virtual_path и name
            const virtualPath = results.virtual_path || results.name || 'Документы'
            this.breadcrumbs = this._navigationService.updateBreadcrumbsFromVirtualPath(
                virtualPath,
                null, // В новом формате нет path_parent, будем генерировать из virtual_path
                results.path
            )
        },

        /**
         * Обновляет информацию о пагинации
         */
        _updatePagination(data: IListDocumentsResponse): void {
            this.pagination.next = data.next || null
            this.pagination.previous = data.previous || null
            this.pagination.hasNext = !!data.next
            this.pagination.hasPrevious = !!data.previous
        },

        /**
         * Извлекает cursor из URL пагинации
         */
        _extractCursorFromUrl(url: string): string | null {
            try {
                const urlObj = new URL(url)
                return urlObj.searchParams.get('cursor')
            } catch {
                return null
            }
        },

        /**
         * Загружает следующую страницу
         */
        async loadNextPage(): Promise<void> {
            if (!this.pagination.hasNext || !this.pagination.next) {
                return
            }

            const cursor = this._extractCursorFromUrl(this.pagination.next)
            if (!cursor) {
                return
            }

            const payload: IListDocumentsPayload = {
                cursor,
                ...(this.currentFolderId ? { folder_id: this.currentFolderId } : { path: this.currentPath })
            }

            // Добавляем активные фильтры если они есть
            if (this._shouldIncludeFilters()) {
                if (this.currentFilters.created_by.length > 0) {
                    payload.created_by = this.currentFilters.created_by
                }
                if (this.currentFilters.types.length > 0) {
                    payload.types = this.currentFilters.types
                }
            }

            await this.fetchDocuments(payload)
        },

        /**
         * Загружает предыдущую страницу
         */
        async loadPreviousPage(): Promise<void> {
            if (!this.pagination.hasPrevious || !this.pagination.previous) {
                return
            }

            const cursor = this._extractCursorFromUrl(this.pagination.previous)
            if (!cursor) {
                return
            }

            const payload: IListDocumentsPayload = {
                cursor,
                ...(this.currentFolderId ? { folder_id: this.currentFolderId } : { path: this.currentPath })
            }

            // Добавляем активные фильтры если они есть
            if (this._shouldIncludeFilters()) {
                if (this.currentFilters.created_by.length > 0) {
                    payload.created_by = this.currentFilters.created_by
                }
                if (this.currentFilters.types.length > 0) {
                    payload.types = this.currentFilters.types
                }
            }

            await this.fetchDocuments(payload)
        },

        /**
         * Обновляет breadcrumbs для нового формата API (results как массив)
         */
        _updateBreadcrumbsFromNewFormat(payload: IListDocumentsPayload): void {
            // В новом формате у нас нет информации о текущей папке в ответе
            // Пытаемся определить breadcrumbs из текущего состояния или payload
            
            if (payload.folder_id) {
                // Если есть folder_id, используем его для поиска в кэше
                const cachedPath = this._navigationService.getCachedPath(payload.folder_id)
                if (cachedPath) {
                    this.breadcrumbs = this._navigationService.updateBreadcrumbsFromVirtualPath(
                        cachedPath,
                        null,
                        payload.folder_id
                    )
                } else {
                    // Создаем минимальные breadcrumbs
                    this.breadcrumbs = [
                        { name: 'Документы', path: '/', id: null },
                        { name: 'Папка', path: payload.folder_id, id: payload.folder_id }
                    ]
                }
            } else if (payload.path && payload.path !== '/') {
                // Если есть path, создаем breadcrumbs на его основе
                this.breadcrumbs = this._navigationService.updateBreadcrumbsFromVirtualPath(
                    payload.path,
                    null,
                    payload.path
                )
            } else {
                // Корневая папка
                this.breadcrumbs = [{ name: 'Документы', path: '/', id: null }]
            }
        },

        async fetchDocuments(payload: IListDocumentsPayload = {}): Promise<void> {
            // Предотвращаем дублирование запросов
            if (this.isNavigating || this._currentRequest) {
                // Если уже идет запрос, ждем его завершения
                if (this._currentRequest) {
                    await this._currentRequest
                }
                return
            }

            const requestPath = this._getRequestPath(payload)
            
            // Дополнительная проверка - если запрашиваем тот же путь, что уже загружен
            if (!payload.search && requestPath === this.currentPath && this.currentItems.length > 0) {
                return
            }
            
            // Проверяем, что не делаем тот же запрос, что и в прошлый раз
            const requestKey = `${requestPath}|${payload.search || ''}|${payload.sort_by || ''}|${payload.sort_order || ''}`
            if (requestKey === this._lastRequestPath) {
                return
            }

            const requestPromise = this._executeRequest(payload, requestPath, requestKey)
            this._currentRequest = requestPromise
            
            try {
                await requestPromise
            } finally {
                this._currentRequest = null
            }
        },
        
        async _executeRequest(payload: IListDocumentsPayload, requestPath: string, requestKey: string): Promise<void> {
            try {
                this.isNavigating = true
                this._lastRequestPath = requestKey
                
                // Добавляем активные фильтры к payload если они есть
                const requestPayload = { ...payload, path: requestPath }
                if (this._shouldIncludeFilters()) {
                    if (this.currentFilters.created_by.length > 0) {
                        requestPayload.created_by = this.currentFilters.created_by
                    }
                    if (this.currentFilters.types.length > 0) {
                        requestPayload.types = this.currentFilters.types
                    }
                }
                
                let data: IListDocumentsResponse
                
                // Используем GET API если есть фильтры, иначе обычный POST
                if (this._shouldIncludeFilters()) {
                    try {
                        data = await this._apiService.fetchDocumentsWithFilters(requestPayload)
                    } catch (error) {
                        // Fallback на обычный метод если GET не работает
                        data = await this._apiService.fetchDocuments(requestPayload)
                    }
                } else {
                    data = await this._apiService.fetchDocuments(requestPayload)
                }

                this._processApiResponse(data, requestPayload)
            } catch (error) {
                logger.error('documents_fetch_error', {
                    file: 'documentsStore',
                    function: 'fetchDocuments',
                    path: requestPath,
                    condition: String(error),
                })

                // Пытаемся загрузить корневую папку в случае ошибки
                if (requestPath !== '/') {
                    try {
                        await this.fetchDocuments({ path: '/' })
                        return
                    } catch (rootError) {
                        // Fallback failed, continue with error handling
                    }
                }

                useFeedbackStore().showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: 'Не удалось загрузить документы',
                    time: 5000,
                })
                throw error
            } finally {
                this.isNavigating = false
            }
        },

        /**
         * Выполнение поиска документов (используется композиблом)
         */
        async searchDocuments(query: string): Promise<void> {
            if (query.length < 3) {
                // Если поисковый запрос меньше 3 символов, возвращаемся к обычному просмотру
                this.isSearchMode = false
                this.searchQuery = ''
                await this.fetchDocuments({ path: this.currentPath })
                return
            }

            this.isSearchMode = true
            this.searchQuery = query

            try {
                await this.fetchDocuments({
                    path: this.currentPath,
                    search: query,
                    page: 1,
                    page_size: 100,
                    sort_by: 'name',
                    sort_order: 'ascending',
                })
            } catch (error) {
                logger.error('documents_search_error', {
                    file: 'documentsStore',
                    function: 'searchDocuments',
                    query: query,
                    condition: String(error),
                })

                useFeedbackStore().showToast({
                    type: 'error',
                    title: 'Ошибка поиска',
                    message: 'Не удалось выполнить поиск документов',
                    time: 5000,
                })
                throw error
            }
        },

        /**
         * Очистка поиска и возврат к обычному просмотру (используется композиблом)
         */
        async clearSearch(): Promise<void> {
            if (this.searchTimeout) {
                clearTimeout(this.searchTimeout)
                this.searchTimeout = null
            }

            this.searchQuery = ''
            this.isSearchMode = false

            // Возвращаемся к обычному просмотру текущей папки
            await this.fetchDocuments({ path: this.currentPath })
        },

        async navigateToFolder(folder: IDocumentFolder): Promise<void> {
            // Предотвращаем дублирование запросов
            if (this.isNavigating) {
                return
            }
            
            // При навигации к папке выходим из режима поиска
            if (this.isSearchMode) {
                this.isSearchMode = false
                this.searchQuery = ''
            }

            if (folder.folder_id) {
                await this.fetchDocuments({ folder_id: folder.folder_id })
            } else if (folder.path) {
                await this.fetchDocuments({ path: folder.path })
            } else {
                throw new Error('Folder has no folder_id or path')
            }
        },

        async navigateToFolderId(folderId: string): Promise<void> {
            // Предотвращаем дублирование запросов
            if (this.isNavigating) {
                return
            }
            
            if (this.isSearchMode) {
                this.isSearchMode = false
                this.searchQuery = ''
            }
            await this.fetchDocuments({ folder_id: folderId })
        },

        async navigateToPath(path: string): Promise<void> {
            // Предотвращаем дублирование запросов
            if (this.isNavigating) {
                return
            }
            
            if (this.isSearchMode) {
                this.isSearchMode = false
                this.searchQuery = ''
            }
            try {
                await this.fetchDocuments({ path })
            } catch (error) {
                if (path !== '/') {
                    await this.fetchDocuments({ path: '/' })
                }
                throw error
            }
        },

        async navigateUp(): Promise<void> {
            if (this.currentPath === '/' || !this.currentPath) {
                return
            }
            
            // Предотвращаем дублирование запросов
            if (this.isNavigating) {
                return
            }

            if (this.isSearchMode) {
                this.isSearchMode = false
                this.searchQuery = ''
            }

            const parentPath = getParentPath(this.currentPath)
            await this.fetchDocuments({ path: parentPath })
        },


        /**
         * Принудительно обновляет список документов, игнорируя кэш
         */
        async _forceRefreshDocuments(): Promise<void> {
            // Сбрасываем кэш запросов для принудительного обновления
            this._lastRequestPath = null
            this._currentRequest = null
            
            const payload: IListDocumentsPayload = {}
            
            if (this.currentFolderId) {
                payload.folder_id = this.currentFolderId
            } else {
                payload.path = this.currentPath
            }
            
            // Добавляем timestamp для гарантии уникальности запроса
            const requestPath = this._getRequestPath(payload)
            const requestKey = `${requestPath}|${payload.search || ''}|${payload.sort_by || ''}|${payload.sort_order || ''}|${Date.now()}`
            
            await this._executeRequest(payload, requestPath, requestKey)
        },

        /**
         * Принудительно обновляет список документов с параметрами сортировки, игнорируя кэш
         */
        async forceRefreshDocuments(payload: IListDocumentsPayload = {}): Promise<void> {
            // Сбрасываем кэш запросов для принудительного обновления
            this._lastRequestPath = null
            this._currentRequest = null
            
            const refreshPayload: IListDocumentsPayload = {
                ...payload
            }
            
            if (!refreshPayload.folder_id && !refreshPayload.path) {
                if (this.currentFolderId) {
                    refreshPayload.folder_id = this.currentFolderId
                } else {
                    refreshPayload.path = this.currentPath
                }
            }
            
            // Добавляем timestamp для гарантии уникальности запроса
            const requestPath = this._getRequestPath(refreshPayload)
            const requestKey = `${requestPath}|${refreshPayload.search || ''}|${refreshPayload.sort_by || ''}|${refreshPayload.sort_order || ''}|${Date.now()}`
            
            await this._executeRequest(refreshPayload, requestPath, requestKey)
        },

        /**
         * Обновляет текущий вид (обычный или поисковый)
         */
        async _refreshCurrentView(): Promise<void> {
            if (this.isSearchMode && this.searchQuery) {
                await this.searchDocuments(this.searchQuery)
            } else {
                // Принудительно обновляем список, игнорируя кэш
                await this._forceRefreshDocuments()
            }
        },

        async createDocument(payload: ICreateDocumentPayload): Promise<void> {
            try {
                const documentPayload = {
                    ...payload,
                    parent_folder: payload.parent_folder || this.currentFolderId || '/'
                }
                
                await this._apiService.createDocument(documentPayload)

                useFeedbackStore().showToast({
                    type: 'success',
                    title: 'Успех',
                    message: 'Документ создан',
                    time: 5000,
                })

                // Обновляем список с учетом режима поиска
                await this._refreshCurrentView()
            } catch (error) {
                logger.error('documents_create_error', {
                    file: 'documentsStore',
                    function: 'createDocument',
                    condition: String(error),
                })
                useFeedbackStore().showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: 'Не удалось создать документ',
                    time: 7000,
                })
                throw error
            }
        },

        async createFolder(payload: ICreateFolderPayload): Promise<void> {
            try {
                await this._apiService.createFolder(payload)

                useFeedbackStore().showToast({
                    type: 'success',
                    title: 'Успех',
                    message: 'Папка создана',
                    time: 5000,
                })

                // Обновляем список с учетом режима поиска
                await this._refreshCurrentView()
            } catch (error) {
                logger.error('documents_createFolder_error', {
                    file: 'documentsStore',
                    function: 'createFolder',
                    condition: String(error),
                })
                useFeedbackStore().showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: 'Не удалось создать папку',
                    time: 7000,
                })
                throw error
            }
        },

        async deleteDocument(id: number): Promise<void> {
            try {
                await this._apiService.deleteDocument(id)

                useFeedbackStore().showToast({
                    type: 'success',
                    title: 'Удалено',
                    message: 'Документ удален',
                    time: 4000,
                })

                // Обновляем список с учетом режима поиска
                await this._refreshCurrentView()
            } catch (error) {
                logger.error('documents_delete_error', {
                    file: 'documentsStore',
                    function: 'deleteDocument',
                    condition: String(error),
                })
                useFeedbackStore().showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: 'Не удалось удалить документ',
                    time: 7000,
                })
                throw error
            }
        },

        async deleteFolder(id: number): Promise<void> {
            try {
                await this._apiService.deleteFolder(id)

                useFeedbackStore().showToast({
                    type: 'success',
                    title: 'Удалено',
                    message: 'Папка удалена',
                    time: 4000,
                })

                // Обновляем список с учетом режима поиска
                await this._refreshCurrentView()
            } catch (error) {
                logger.error('documents_deleteFolder_error', {
                    file: 'documentsStore',
                    function: 'deleteFolder',
                    condition: String(error),
                })
                useFeedbackStore().showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: 'Не удалось удалить папку',
                    time: 7000,
                })
                throw error
            }
        },

        async addDocumentVersion(
            documentId: number,
            file: File,
            description?: string,
        ): Promise<void> {
            try {
                await this._apiService.addDocumentVersion(documentId, file, description)

                useFeedbackStore().showToast({
                    type: 'success',
                    title: 'Успех',
                    message: 'Версия документа добавлена',
                    time: 5000,
                })

                // Обновляем список с учетом режима поиска
                await this._refreshCurrentView()
            } catch (error) {
                logger.error('documents_addVersion_error', {
                    file: 'documentsStore',
                    function: 'addDocumentVersion',
                    condition: String(error),
                })
                useFeedbackStore().showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: 'Не удалось добавить версию документа',
                    time: 7000,
                })
                throw error
            }
        },

        async fetchDocumentDetails(documentId: number): Promise<IDocumentDetailsResponse> {
            try {
                const apiResponse = await this._apiService.fetchDocumentDetails(documentId)
                return {
                    ...apiResponse,
                    type: apiResponse.type ?? 0
                } as IDocumentDetailsResponse
            } catch (error) {
                logger.error('documents_fetchDetails_error', {
                    file: 'documentsStore',
                    function: 'fetchDocumentDetails',
                    documentId: documentId,
                    condition: String(error),
                })
                useFeedbackStore().showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: 'Не удалось загрузить детали документа',
                    time: 5000,
                })
                throw error
            }
        },

        async fetchDocumentVersions(documentId: number): Promise<any[]> {
            try {
                return await this._apiService.fetchDocumentVersions(documentId)
            } catch (error) {
                logger.error('documents_fetchVersions_error', {
                    file: 'documentsStore',
                    function: 'fetchDocumentVersions',
                    documentId: documentId,
                    condition: String(error),
                })
                useFeedbackStore().showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: 'Не удалось загрузить версии документа',
                    time: 5000,
                })
                throw error
            }
        },

        async deleteDocumentVersion(documentId: number, versionId: number): Promise<void> {
            try {
                await this._apiService.deleteDocumentVersion(documentId, versionId)

                useFeedbackStore().showToast({
                    type: 'success',
                    title: 'Удалено',
                    message: 'Версия документа удалена',
                    time: 4000,
                })
            } catch (error) {
                logger.error('documents_deleteVersion_error', {
                    file: 'documentsStore',
                    function: 'deleteDocumentVersion',
                    documentId: documentId,
                    versionId: versionId,
                    condition: String(error),
                })
                useFeedbackStore().showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: 'Не удалось удалить версию документа',
                    time: 7000,
                })
                throw error
            }
        },

        selectItem(id: number): void {
            this.selectedItems.add(id)
        },

        deselectItem(id: number): void {
            this.selectedItems.delete(id)
        },

        toggleSelectItem(id: number): void {
            if (this.selectedItems.has(id)) {
                this.deselectItem(id)
            } else {
                this.selectItem(id)
            }
        },

        selectAll(): void {
            this.currentItems.forEach((item: IDocumentItem) => {
                if (item.id !== null) {
                    this.selectedItems.add(item.id)
                }
            })
        },

        deselectAll(): void {
            this.selectedItems.clear()
        },


        getUrlFromCurrentState(): string {
            return this.currentFolderId
                ? folderIdToUrl(this.currentFolderId)
                : pathToUrl(this.currentPath)
        },


        /**
         * Применяет фильтры документов
         */
        async applyFilters(filters: { created_by: string[], types: number[] }): Promise<void> {
            this.currentFilters = { ...filters }
            this.isFiltersActive = filters.created_by.length > 0 || filters.types.length > 0
            
            // Сбрасываем кэш для принудительного обновления с фильтрами
            this._lastRequestPath = null
            this._currentRequest = null
            
            const payload: IListDocumentsPayload = {
                created_by: filters.created_by.length > 0 ? filters.created_by : undefined,
                types: filters.types.length > 0 ? filters.types : undefined
            }
            
            if (this.currentFolderId) {
                payload.folder_id = this.currentFolderId
            } else {
                payload.path = this.currentPath
            }

            // Используем новый метод API для GET запроса с фильтрами
            try {
                const data = await this._apiService.fetchDocumentsWithFilters(payload)
                this._processApiResponse(data, payload)
            } catch (error) {
                // Fallback на обычный метод
                await this.fetchDocuments(payload)
            }
        },

        /**
         * Очищает все фильтры
         */
        async clearFilters(): Promise<void> {
            this.currentFilters = { created_by: [], types: [] }
            this.isFiltersActive = false
            
            // Обновляем список без фильтров
            await this._refreshCurrentView()
        },

        /**
         * Обновляет метод fetchDocuments для учета фильтров
         */
        _shouldIncludeFilters(): boolean {
            return this.isFiltersActive && (this.currentFilters.created_by.length > 0 || this.currentFilters.types.length > 0)
        },

        cleanup(): void {
            if (this._urlUpdateTimeout) {
                clearTimeout(this._urlUpdateTimeout)
                this._urlUpdateTimeout = null
            }

            if (this.searchTimeout) {
                clearTimeout(this.searchTimeout)
                this.searchTimeout = null
            }
            
            // Очищаем состояние запросов
            this._lastRequestPath = null
            this._currentRequest = null

            // Очищаем фильтры
            this.currentFilters = { created_by: [], types: [] }
            this.isFiltersActive = false

            // Очищаем пагинацию
            this.pagination = {
                next: null,
                previous: null,
                hasNext: false,
                hasPrevious: false
            }

            this._navigationService.cleanup()
        },
    },
})

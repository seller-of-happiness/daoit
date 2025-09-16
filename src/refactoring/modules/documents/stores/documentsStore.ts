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

// Расширяем интерфейс состояния
interface IExtendedDocumentsStoreState extends Omit<IDocumentsStoreState, 'breadcrumbs'> {
    breadcrumbs: IBreadcrumb[]
    // Сервисы
    _navigationService: NavigationService
    _apiService: DocumentsApiService
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
        _urlUpdateTimeout: null as ReturnType<typeof setTimeout> | null,
        // Поля для поиска
        searchQuery: '',
        isSearchMode: false,
        searchTimeout: null as ReturnType<typeof setTimeout> | null,
        // Сервисы
        _navigationService: new NavigationService(),
        _apiService: new DocumentsApiService(),
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

    },

    actions: {
        /**
         * Единая функция обработки ошибок
         */
        _handleError(error: any, context: string, functionName: string, toastMessage: string, additionalData?: Record<string, any>): void {
            logger.error(`documents_${functionName}_error`, {
                file: 'documentsStore',
                function: functionName,
                condition: String(error),
                ...additionalData,
            })

            useFeedbackStore().showToast({
                type: 'error',
                title: 'Ошибка',
                message: toastMessage,
                time: 5000,
            })
        },

        /**
         * Единая функция показа успешного уведомления
         */
        _showSuccess(title: string, message: string): void {
            useFeedbackStore().showToast({
                type: 'success',
                title,
                message,
                time: 4000,
            })
        },

        async fetchDocumentTypes(): Promise<void> {
            try {
                this.documentTypes = await this._apiService.fetchDocumentTypes()
            } catch (error) {
                this._handleError(error, 'documentsStore', 'fetchDocumentTypes', 'Не удалось загрузить типы документов')
                throw error
            }
        },


        /**
         * Обрабатывает ответ API и обновляет состояние
         */
        _processApiResponse(data: IListDocumentsResponse, payload: IListDocumentsPayload): void {
            if (!data || typeof data !== 'object') return

            this.currentPath = data.path || payload.path || payload.folder_id || this.currentPath
            this.currentFolderId = data.current_folder?.folder_id || payload.folder_id || this.currentFolderId
            this.currentItems = data.items || []

            // Обновляем breadcrumbs только если не в режиме поиска
            if (!payload.search) {
                this._updateBreadcrumbs(data)
            }
        },

        /**
         * Обновляет breadcrumbs на основе данных API
         */
        _updateBreadcrumbs(data: IListDocumentsResponse): void {
            const virtualPath = data.virtual_path || data.name || 'Документы'
            const parentPaths = data.path_parent || null
            
            this.breadcrumbs = this._navigationService.updateBreadcrumbs(
                data.current_folder,
                data.parent_folders,
                virtualPath,
                parentPaths,
                this.currentPath
            )
        },

        async fetchDocuments(payload: IListDocumentsPayload = {}): Promise<void> {
            try {
                const data = await this._apiService.fetchDocuments(payload)
                this._processApiResponse(data, payload)
            } catch (error) {
                const requestPath = payload.path || payload.folder_id || this.currentPath

                // Пытаемся загрузить корневую папку в случае ошибки
                if (requestPath !== '/') {
                    try {
                        await this.fetchDocuments({ path: '/' })
                        return
                    } catch (rootError) {
                        // Fallback failed, continue with error handling
                    }
                }

                this._handleError(error, 'documentsStore', 'fetchDocuments', 'Не удалось загрузить документы', { path: requestPath })
                throw error
            }
        },

        /**
         * Выполнение поиска документов
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
                this._handleError(error, 'documentsStore', 'searchDocuments', 'Не удалось выполнить поиск документов', { query })
                throw error
            }
        },

        /**
         * Обработчик изменения поискового запроса с дебаунсом
         */
        handleSearchInput(query: string): void {
            // Очищаем предыдущий таймер
            if (this.searchTimeout) {
                clearTimeout(this.searchTimeout)
            }

            // Устанавливаем новый таймер
            this.searchTimeout = setTimeout(async () => {
                await this.searchDocuments(query)
            }, 300) // Дебаунс 300мс
        },

        /**
         * Очистка поиска и возврат к обычному просмотру
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
            // При навигации к папке выходим из режима поиска
            await this.clearSearch()

            if (folder.folder_id) {
                await this.fetchDocuments({ folder_id: folder.folder_id })
            } else if (folder.path) {
                await this.fetchDocuments({ path: folder.path })
            } else {
                throw new Error('Folder has no folder_id or path')
            }
        },

        async navigateToFolderId(folderId: string): Promise<void> {
            await this.clearSearch()
            await this.fetchDocuments({ folder_id: folderId })
        },

        async navigateToPath(path: string): Promise<void> {
            await this.clearSearch()
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

            await this.clearSearch()

            const parentPath = getParentPath(this.currentPath)
            await this.fetchDocuments({ path: parentPath })
        },


        /**
         * Обновляет текущий вид (обычный или поисковый)
         */
        async _refreshCurrentView(): Promise<void> {
            if (this.isSearchMode && this.searchQuery) {
                await this.searchDocuments(this.searchQuery)
            } else {
                await this.fetchDocuments()
            }
        },

        async createDocument(payload: ICreateDocumentPayload): Promise<void> {
            try {
                const documentPayload = {
                    ...payload,
                    parent_folder: payload.parent_folder || this.currentFolderId || '/'
                }
                
                await this._apiService.createDocument(documentPayload)
                this._showSuccess('Успех', 'Документ создан')
                
                // Обновляем список с учетом режима поиска
                await this._refreshCurrentView()
            } catch (error) {
                this._handleError(error, 'documentsStore', 'createDocument', 'Не удалось создать документ')
                throw error
            }
        },

        async createFolder(payload: ICreateFolderPayload): Promise<void> {
            try {
                await this._apiService.createFolder(payload)
                this._showSuccess('Успех', 'Папка создана')
                
                // Обновляем список с учетом режима поиска
                await this._refreshCurrentView()
            } catch (error) {
                this._handleError(error, 'documentsStore', 'createFolder', 'Не удалось создать папку')
                throw error
            }
        },

        async deleteDocument(id: number): Promise<void> {
            try {
                await this._apiService.deleteDocument(id)
                this._showSuccess('Удалено', 'Документ удален')
                
                // Обновляем список с учетом режима поиска
                await this._refreshCurrentView()
            } catch (error) {
                this._handleError(error, 'documentsStore', 'deleteDocument', 'Не удалось удалить документ', { documentId: id })
                throw error
            }
        },

        async deleteFolder(id: number): Promise<void> {
            try {
                await this._apiService.deleteFolder(id)
                this._showSuccess('Удалено', 'Папка удалена')
                
                // Обновляем список с учетом режима поиска
                await this._refreshCurrentView()
            } catch (error) {
                this._handleError(error, 'documentsStore', 'deleteFolder', 'Не удалось удалить папку', { folderId: id })
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
                this._showSuccess('Успех', 'Версия документа добавлена')
                
                // Обновляем список с учетом режима поиска
                await this._refreshCurrentView()
            } catch (error) {
                this._handleError(error, 'documentsStore', 'addDocumentVersion', 'Не удалось добавить версию документа', { documentId })
                throw error
            }
        },

        async fetchDocumentDetails(documentId: number): Promise<IDocumentDetailsResponse> {
            try {
                return await this._apiService.fetchDocumentDetails(documentId)
            } catch (error) {
                this._handleError(error, 'documentsStore', 'fetchDocumentDetails', 'Не удалось загрузить детали документа', { documentId })
                throw error
            }
        },

        async fetchDocumentVersions(documentId: number): Promise<any[]> {
            try {
                return await this._apiService.fetchDocumentVersions(documentId)
            } catch (error) {
                this._handleError(error, 'documentsStore', 'fetchDocumentVersions', 'Не удалось загрузить версии документа', { documentId })
                throw error
            }
        },

        async deleteDocumentVersion(documentId: number, versionId: number): Promise<void> {
            try {
                await this._apiService.deleteDocumentVersion(documentId, versionId)
                this._showSuccess('Удалено', 'Версия документа удалена')
            } catch (error) {
                this._handleError(error, 'documentsStore', 'deleteDocumentVersion', 'Не удалось удалить версию документа', { documentId, versionId })
                throw error
            }
        },



        getUrlFromCurrentState(): string {
            return this.currentFolderId
                ? folderIdToUrl(this.currentFolderId)
                : pathToUrl(this.currentPath)
        },

        updateUrl(router: any): void {
            this._navigationService.updateUrl(router, this.currentPath)
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

            this._navigationService.cleanup()
        },
    },
})

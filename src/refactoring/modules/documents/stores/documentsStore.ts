import axios from 'axios'
import { defineStore } from 'pinia'
import { BASE_URL } from '@/refactoring/environment/environment'
import { useFeedbackStore } from '@/refactoring/modules/feedback/stores/feedbackStore'
import { logger } from '@/refactoring/utils/eventLogger'
import { ERouteNames } from '@/router/ERouteNames'
import type {
    IDocumentsStoreState,
    IDocumentItem,
    IDocumentFolder,
    IDocument,
    IDocumentType,
    ICreateDocumentPayload,
    ICreateFolderPayload,
    IListDocumentsPayload,
} from '@/refactoring/modules/documents/types/IDocument'

// Расширяем интерфейс состояния для кеша
interface IExtendedDocumentsStoreState extends IDocumentsStoreState {
    _folderPathCache: Map<string, string>
}

// Типы для API ответа
interface IApiResponse {
    path?: string
    current_folder?: any
    parent_folders?: any[]
    virtual_path?: string
    name?: string
    path_parent?: string[] | string // Может быть массивом или строкой
    items?: any[]
}

export const useDocumentsStore = defineStore('documentsStore', {
    state: (): IExtendedDocumentsStoreState => ({
        currentPath: '/',
        currentFolderId: null,
        currentItems: [],
        documentTypes: [],
        breadcrumbs: [{ name: 'Документы', path: '/', id: null }],
        isLoading: false,
        selectedItems: new Set(),
        _urlUpdateTimeout: null as ReturnType<typeof setTimeout> | null,
        // Добавляем кеш для хранения путей папок
        _folderPathCache: new Map() as Map<string, string>,
    }),

    getters: {
        currentFolders: (state: IDocumentsStoreState): IDocumentFolder[] =>
            state.currentItems.filter(
                (item: IDocumentItem): item is IDocumentFolder => item.is_dir,
            ),

        currentDocuments: (state: IDocumentsStoreState): IDocument[] =>
            state.currentItems.filter((item: IDocumentItem): item is IDocument => !item.is_dir),

        isRootPath: (state: IDocumentsStoreState): boolean =>
            state.currentPath === '/' && !state.currentFolderId,

        selectedCount: (state: IDocumentsStoreState): number => state.selectedItems.size,
    },

    actions: {
        async fetchDocumentTypes(): Promise<void> {
            try {
                const response = await axios.get(`${BASE_URL}/api/documents/type/`)
                this.documentTypes = response.data?.results || response.data || []
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

        async fetchDocuments(payload: IListDocumentsPayload = {}): Promise<void> {
            let requestPath = '/'

            if (payload.folder_id) {
                requestPath = payload.folder_id
            } else if (payload.path) {
                requestPath = payload.path === '/' ? '/' : payload.path
            } else if (this.currentFolderId) {
                requestPath = this.currentFolderId
            } else {
                requestPath = this.currentPath
            }

            try {
                const requestPayload: Record<string, any> = {
                    path: requestPath,
                    parent_folder: payload.parent_folder,
                    page: payload.page || 1,
                    page_size: payload.page_size || 100,
                    search: payload.search || '',
                }

                // Добавляем параметры сортировки если они есть
                if (payload.sort_by) {
                    requestPayload.sort_by = payload.sort_by
                    requestPayload.sort_order = payload.sort_order || 'ascending'
                }

                const response = await axios.post(`${BASE_URL}/api/documents/list/`, requestPayload)
                const data = response.data

                if (data && typeof data === 'object') {
                    this.currentPath = data.path || requestPath
                    this.currentFolderId =
                        data.current_folder?.folder_id || payload.folder_id || this.currentFolderId
                    this.currentItems = data.items || []

                    // Кешируем путь текущей папки по её virtual_path
                    if (data.virtual_path && data.path) {
                        this._folderPathCache.set(data.virtual_path, data.path)
                    }

                    if (data.current_folder && data.parent_folders) {
                        this.updateFolderChainFromApi(
                            data.current_folder,
                            data.parent_folders || [],
                        )
                    } else {
                        // Обрабатываем virtual_path или name с учетом path_parent (массив или строка)
                        const virtualPath = data.virtual_path || data.name || 'Документы'
                        const parentPaths = data.path_parent || null
                        this.updateBreadcrumbsFromVirtualPath(virtualPath, parentPaths)
                    }
                }
            } catch (error) {
                logger.error('documents_fetch_error', {
                    file: 'documentsStore',
                    function: 'fetchDocuments',
                    path: requestPath,
                    condition: String(error),
                })

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
            }
        },

        async navigateToFolder(folder: IDocumentFolder): Promise<void> {
            if (folder.folder_id) {
                await this.fetchDocuments({ folder_id: folder.folder_id })
            } else if (folder.path) {
                await this.fetchDocuments({ path: folder.path })
            } else {
                throw new Error('Folder has no folder_id or path')
            }
        },

        async navigateToFolderId(folderId: string): Promise<void> {
            await this.fetchDocuments({ folder_id: folderId })
        },

        async navigateToPath(path: string): Promise<void> {
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

            const currentPathArray = this.pathToArray(this.currentPath)

            if (currentPathArray.length === 0) {
                return
            }

            const parentPathArray = currentPathArray.slice(0, -1)
            const parentPath = this.arrayToPath(parentPathArray)

            await this.fetchDocuments({ path: parentPath })
        },

        updateBreadcrumbsFromVirtualPath(
            virtualPath: string,
            parentPaths?: string[] | string | null,
        ): void {
            // Всегда начинаем с корневого элемента
            this.breadcrumbs = [{ name: 'Документы', path: '/', id: null }]

            // Если это корень, больше ничего не добавляем
            if (!virtualPath || virtualPath === 'Документы' || virtualPath === '/') {
                return
            }

            // Разделяем virtual_path по слешам
            const folderNames = virtualPath
                .split('/')
                .map((name) => name.trim())
                .filter(Boolean)

            // Нормализуем parentPaths в массив
            let parentPathsArray: string[] = []
            if (Array.isArray(parentPaths)) {
                parentPathsArray = parentPaths
            } else if (typeof parentPaths === 'string') {
                // Обратная совместимость: если пришла строка, делаем массив из одного элемента
                parentPathsArray = [parentPaths]
            }

            // Добавляем каждую папку как отдельный breadcrumb
            folderNames.forEach((folderName, index) => {
                let breadcrumbPath: string

                if (index === folderNames.length - 1) {
                    // Для последней (текущей) папки используем реальный путь из API
                    breadcrumbPath = this.currentPath
                } else if (index < parentPathsArray.length) {
                    // Для родительских папок используем соответствующий путь из массива path_parent
                    breadcrumbPath = parentPathsArray[index]
                } else {
                    // Fallback: пытаемся найти в кеше или составляем путь
                    const parentVirtualPath = folderNames.slice(0, index + 1).join('/')
                    breadcrumbPath =
                        this._folderPathCache.get(parentVirtualPath) || parentVirtualPath
                }

                this.breadcrumbs.push({
                    name: folderName,
                    path: breadcrumbPath,
                    id: null,
                })
            })

            // Кешируем все пути из parentPathsArray для будущего использования
            if (parentPathsArray.length > 0) {
                folderNames.forEach((folderName, index) => {
                    if (index < parentPathsArray.length) {
                        const virtualPath = folderNames.slice(0, index + 1).join('/')
                        this._folderPathCache.set(virtualPath, parentPathsArray[index])
                    }
                })
            }
        },

        updateBreadcrumbs(currentName: string): void {
            // Используем новый метод без parentPath (для обратной совместимости)
            this.updateBreadcrumbsFromVirtualPath(currentName, null)
        },

        updateFolderChainFromApi(
            currentFolder: IDocumentFolder,
            parentFolders: IDocumentFolder[] = [],
        ): void {
            const fullChain = [...parentFolders, currentFolder].filter((folder) => folder.name)

            this.breadcrumbs = [
                { name: 'Документы', path: '/', id: null },
                ...fullChain.map((folder) => ({
                    name: folder.name,
                    path: folder.folder_id || folder.path,
                    id: folder.folder_id || null,
                })),
            ]
        },

        async createDocument(payload: ICreateDocumentPayload): Promise<void> {
            try {
                const formData = new FormData()
                formData.append('name', payload.name)
                if (payload.description) formData.append('description', payload.description)
                formData.append('type', payload.type_id ? payload.type_id.toString() : '1')
                formData.append('number', Date.now().toString())
                formData.append('folder_path', payload.parent_folder || this.currentFolderId || '/')
                formData.append('file', payload.file)
                formData.append('visibility', payload.visibility)

                await axios.post(`${BASE_URL}/api/documents/document/`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                })

                useFeedbackStore().showToast({
                    type: 'success',
                    title: 'Успех',
                    message: 'Документ создан',
                    time: 5000,
                })

                await this.fetchDocuments()
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
                await axios.post(`${BASE_URL}/api/documents/document-folder/`, {
                    name: payload.name,
                    path: payload.path,
                    visibility: payload.visibility,
                })

                useFeedbackStore().showToast({
                    type: 'success',
                    title: 'Успех',
                    message: 'Папка создана',
                    time: 5000,
                })

                await this.fetchDocuments()
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
                const response = await axios.delete(`${BASE_URL}/api/documents/document/${id}/`)

                if (response.status === 204 || response.status === 200) {
                    useFeedbackStore().showToast({
                        type: 'success',
                        title: 'Удалено',
                        message: 'Документ удален',
                        time: 4000,
                    })

                    await this.fetchDocuments()
                } else {
                    throw new Error(`Unexpected response status: ${response.status}`)
                }
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
                const response = await axios.delete(
                    `${BASE_URL}/api/documents/document-folder/${id}/`,
                )

                if (response.status === 204 || response.status === 200) {
                    useFeedbackStore().showToast({
                        type: 'success',
                        title: 'Удалено',
                        message: 'Папка удалена',
                        time: 4000,
                    })

                    await this.fetchDocuments()
                } else {
                    throw new Error(`Unexpected response status: ${response.status}`)
                }
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
                const formData = new FormData()
                formData.append('file', file)
                if (description) formData.append('description', description)

                await axios.post(
                    `${BASE_URL}/api/documents/document/${documentId}/versions/`,
                    formData,
                    {
                        headers: { 'Content-Type': 'multipart/form-data' },
                    },
                )

                useFeedbackStore().showToast({
                    type: 'success',
                    title: 'Успех',
                    message: 'Версия документа добавлена',
                    time: 5000,
                })

                await this.fetchDocuments()
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

        getDocumentIcon(item: IDocumentItem): string {
            if (item.is_dir) {
                return 'pi pi-folder'
            }

            const ext = item.extension.toLowerCase()
            switch (ext) {
                case 'pdf':
                    return 'pi pi-file-pdf'
                case 'doc':
                case 'docx':
                    return 'pi pi-file-word'
                case 'xls':
                case 'xlsx':
                case 'csv':
                    return 'pi pi-file-excel'
                case 'jpg':
                case 'jpeg':
                case 'png':
                case 'gif':
                case 'webp':
                case 'svg':
                    return 'pi pi-image'
                case 'zip':
                case 'rar':
                case '7z':
                    return 'pi pi-box'
                case 'mp4':
                case 'mov':
                case 'avi':
                case 'mkv':
                    return 'pi pi-video'
                case 'mp3':
                case 'wav':
                case 'ogg':
                    return 'pi pi-volume-up'
                default:
                    return 'pi pi-file'
            }
        },

        formatFileSize(bytes: number | null): string {
            if (!bytes) return '—'

            const units = ['Б', 'КБ', 'МБ', 'ГБ']
            let size = bytes
            let unitIndex = 0

            while (size >= 1024 && unitIndex < units.length - 1) {
                size /= 1024
                unitIndex++
            }

            return `${Math.round(size * 10) / 10} ${units[unitIndex]}`
        },

        formatDate(dateString: string | null): string {
            if (!dateString) return '—'

            try {
                return new Date(dateString).toLocaleDateString('ru-RU', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                })
            } catch {
                return dateString
            }
        },

        folderIdToUrl(folderId: string | null): string {
            return folderId || ''
        },

        urlToFolderId(urlParam: string): string | null {
            if (!urlParam || urlParam === '') return null
            return urlParam
        },

        pathToUrl(path: string): string {
            if (path === '/') {
                return ''
            }
            return path.startsWith('/') ? path.slice(1) : path
        },

        urlToPath(urlParam: string | string[]): string {
            if (!urlParam || urlParam === '' || (Array.isArray(urlParam) && urlParam.length === 0))
                return '/'

            if (Array.isArray(urlParam)) {
                const filteredParam = urlParam.filter(Boolean)
                return filteredParam.length > 0 ? filteredParam.join('/') : '/'
            }

            return urlParam === '/' ? '/' : urlParam
        },

        pathToArray(path: string): string[] {
            if (path === '/' || !path) return []
            const cleanPath = path.startsWith('/') ? path.slice(1) : path

            // Разделяем по слешам, но учитываем, что в названиях папок могут быть слеши
            // Проверяем, если это API ответ с составным путем
            const segments = cleanPath.split('/')

            // Фильтруем пустые сегменты
            return segments.filter(Boolean)
        },

        arrayToPath(pathArray: string[]): string {
            if (!pathArray || pathArray.length === 0) return '/'
            return pathArray.join('/')
        },

        getUrlFromCurrentState(): string {
            return this.currentFolderId
                ? this.folderIdToUrl(this.currentFolderId)
                : this.pathToUrl(this.currentPath)
        },

        updateUrl(router: any): void {
            try {
                const currentRoute = router.currentRoute.value

                if (this._urlUpdateTimeout) {
                    clearTimeout(this._urlUpdateTimeout)
                }

                this._urlUpdateTimeout = setTimeout(() => {
                    const currentPathArray = this.pathToArray(this.currentPath)
                    const currentPathMatch = currentRoute.params.pathMatch

                    let needsUpdate = false

                    if (currentPathArray.length === 0) {
                        needsUpdate =
                            currentRoute.name !== ERouteNames.DOCUMENTS || !!currentPathMatch
                    } else {
                        const expectedPathMatch = currentPathArray.join('/')
                        const actualPathMatch = Array.isArray(currentPathMatch)
                            ? currentPathMatch.join('/')
                            : currentPathMatch || ''

                        needsUpdate =
                            currentRoute.name !== ERouteNames.DOCUMENTS_FOLDER ||
                            actualPathMatch !== expectedPathMatch
                    }

                    if (needsUpdate) {
                        if (currentPathArray.length === 0) {
                            router.replace({ name: ERouteNames.DOCUMENTS }).catch((error: any) => {
                                if (error.name !== 'NavigationDuplicated') {
                                    console.error('Navigation error:', error)
                                }
                            })
                        } else {
                            router
                                .replace({
                                    name: ERouteNames.DOCUMENTS_FOLDER,
                                    params: { pathMatch: currentPathArray },
                                })
                                .catch((error: any) => {
                                    if (error.name !== 'NavigationDuplicated') {
                                        console.error('Navigation error:', error)
                                    }
                                })
                        }
                    }
                }, 10)
            } catch (error) {
                console.error('Error updating URL:', error)
            }
        },

        cleanup(): void {
            if (this._urlUpdateTimeout) {
                clearTimeout(this._urlUpdateTimeout)
                this._urlUpdateTimeout = null
            }
        },
    },
})

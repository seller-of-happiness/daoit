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
  IDocumentVersion,
  ICreateDocumentPayload,
  ICreateFolderPayload,
  IListDocumentsPayload
} from '@/refactoring/modules/documents/types/IDocument'

export const useDocumentsStore = defineStore('documentsStore', {
  state: (): IDocumentsStoreState => ({
    currentPath: '/',
    currentFolderId: null,
    currentItems: [],
    documentTypes: [],
    breadcrumbs: [{ name: 'Документы', path: '/', id: null }],
    isLoading: false,
    selectedItems: new Set(),
    _urlUpdateTimeout: null as NodeJS.Timeout | null // Таймаут для дебаунса обновления URL
  }),

  getters: {
    currentFolders: (state: IDocumentsStoreState): IDocumentFolder[] => 
      state.currentItems.filter((item: IDocumentItem): item is IDocumentFolder => item.is_dir),
    
    currentDocuments: (state: IDocumentsStoreState): IDocument[] => 
      state.currentItems.filter((item: IDocumentItem): item is IDocument => !item.is_dir),
    
    isRootPath: (state: IDocumentsStoreState): boolean => state.currentPath === '/' && !state.currentFolderId,
    
    selectedCount: (state: IDocumentsStoreState): number => state.selectedItems.size
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
          condition: String(error) 
        })
        useFeedbackStore().showToast({ 
          type: 'error', 
          title: 'Ошибка', 
          message: 'Не удалось загрузить типы документов', 
          time: 5000 
        })
        throw error
      }
    },

    async fetchDocuments(payload: IListDocumentsPayload = {}): Promise<void> {
      const feedback = useFeedbackStore()
      this.isLoading = true
      feedback.isGlobalLoading = true
      
      // Определяем путь для запроса
      let requestPath = '/'
      
      if (payload.folder_id) {
        // Используем folder_id как путь
        requestPath = payload.folder_id
        console.log('Fetching documents for folder_id as path:', requestPath)
      } else if (payload.path) {
        // Используем переданный путь
        requestPath = payload.path === '/' ? '/' : payload.path
        console.log('Fetching documents for path:', requestPath)
      } else if (this.currentFolderId) {
        // Используем текущий folder_id как путь
        requestPath = this.currentFolderId
        console.log('Fetching documents for current folder_id as path:', requestPath)
      } else {
        // Используем текущий путь
        requestPath = this.currentPath
        console.log('Fetching documents for current path:', requestPath)
      }
      
      try {
        const requestPayload: any = {
          path: requestPath,
          parent_folder: payload.parent_folder
        }
        
        console.log('API request payload:', requestPayload)
        
        const response = await axios.post(`${BASE_URL}/api/documents/list/`, requestPayload)
        
        const data = response.data
        console.log('Fetched documents response:', data)
        
        if (data && typeof data === 'object') {
          // Обновляем состояние на основе ответа сервера
          this.currentPath = data.path || requestPath
          this.currentFolderId = data.current_folder?.folder_id || (payload.folder_id || this.currentFolderId)
          console.log('Updated current path to:', this.currentPath, 'folder_id:', this.currentFolderId)
          
          // Обновляем элементы
          this.currentItems = data.items || []
          console.log('Updated items count:', this.currentItems.length)
          
          // Если в ответе есть информация о текущей папке и родительских папках, 
          // обновляем breadcrumbs
          if (data.current_folder && data.parent_folders) {
            console.log('Updating breadcrumbs with current folder:', data.current_folder)
            this.updateFolderChainFromApi(data.current_folder, data.parent_folders || [])
          } else {
            // Обновляем breadcrumbs стандартным способом
            this.updateBreadcrumbs(data.virtual_path || data.name || 'Документы')
          }
        }
      } catch (error) {
        console.error('Error fetching documents for path:', requestPath, error)
        logger.error('documents_fetch_error', { 
          file: 'documentsStore', 
          function: 'fetchDocuments', 
          path: requestPath,
          condition: String(error) 
        })
        
        // Если ошибка связана с путем, попробуем загрузить корневую папку
        if (requestPath !== '/') {
          console.log('Failed to load path, trying root folder')
          try {
            await this.fetchDocuments({ path: '/' })
            return
          } catch (rootError) {
            console.error('Failed to load root folder as fallback:', rootError)
          }
        }
        
        useFeedbackStore().showToast({ 
          type: 'error', 
          title: 'Ошибка', 
          message: 'Не удалось загрузить документы', 
          time: 5000 
        })
        throw error
      } finally {
        this.isLoading = false
        feedback.isGlobalLoading = false
      }
    },

    async navigateToFolder(folder: IDocumentFolder): Promise<void> {
      console.log('Navigating to folder:', folder.name, 'id:', folder.id, 'folder_id:', folder.folder_id, 'path:', folder.path)
      
      if (folder.folder_id) {
        // Используем folder_id как путь для запроса
        await this.fetchDocuments({ folder_id: folder.folder_id })
      } else if (folder.path) {
        // Fallback к path-based навигации
        await this.fetchDocuments({ path: folder.path })
      } else {
        console.error('Folder has no folder_id or path:', folder)
      }
    },

    async navigateToFolderId(folderId: string): Promise<void> {
      console.log('Navigating to folder by ID:', folderId)
      await this.fetchDocuments({ folder_id: folderId })
    },

    async navigateToPath(path: string): Promise<void> {
      console.log('NavigateToPath called with:', path)
      try {
        await this.fetchDocuments({ path })
      } catch (error) {
        console.error('Error navigating to path:', path, error)
        // При ошибке навигации переходим к корню
        if (path !== '/') {
          console.log('Navigation failed, falling back to root')
          await this.fetchDocuments({ path: '/' })
        }
        throw error
      }
    },

    async navigateUp(): Promise<void> {
      console.log('Navigating up from current path:', this.currentPath)
      
      if (this.currentPath === '/' || !this.currentPath) {
        // Уже в корне, никуда не навигируем
        console.log('Already at root, cannot navigate up')
        return
      }
      
      // Получаем массив папок текущего пути
      const currentPathArray = this.pathToArray(this.currentPath)
      
      if (currentPathArray.length === 0) {
        // Уже в корне
        console.log('Already at root, cannot navigate up')
        return
      }
      
      // Убираем последнюю папку из пути
      const parentPathArray = currentPathArray.slice(0, -1)
      const parentPath = this.arrayToPath(parentPathArray)
      
      console.log('Navigating up from path array:', currentPathArray, 'to parent:', parentPathArray, 'path:', parentPath)
      
      // Переходим к родительскому пути
      await this.fetchDocuments({ path: parentPath })
    },

    updateBreadcrumbs(currentName: string): void {
      if (this.currentPath === '/' || !this.currentPath) {
        this.breadcrumbs = [{ name: 'Документы', path: '/', id: null }]
      } else {
        // Получаем массив папок из пути
        const pathArray = this.pathToArray(this.currentPath)
        this.breadcrumbs = [
          { name: 'Документы', path: '/', id: null },
          ...pathArray.map((folderName: string, index: number) => {
            // Создаем путь для каждого уровня иерархии
            const pathToLevel = this.arrayToPath(pathArray.slice(0, index + 1))
            // Используем currentName только для последнего элемента
            const name = index === pathArray.length - 1 ? currentName : folderName
            return { name, path: pathToLevel, id: null }
          })
        ]
      }
      
      console.log('Updated breadcrumbs:', this.breadcrumbs)
    },

    // Новый метод для обновления breadcrumbs из API данных
    updateFolderChainFromApi(currentFolder: IDocumentFolder, parentFolders: IDocumentFolder[] = []): void {
      const fullChain = [...parentFolders, currentFolder].filter(folder => folder.name)
      
      console.log('Updating breadcrumbs from API data:', fullChain.map(f => ({ name: f.name, path: f.path, id: f.folder_id })))
      
      // Обновляем breadcrumbs с учетом folder_id
      this.breadcrumbs = [
        { name: 'Документы', path: '/', id: null },
        ...fullChain.map(folder => ({
          name: folder.name,
          // Используем folder_id как путь для навигации
          path: folder.folder_id || folder.path,
          id: folder.folder_id || null
        }))
      ]
    },

    async createDocument(payload: ICreateDocumentPayload): Promise<void> {
      const feedback = useFeedbackStore()
      feedback.isGlobalLoading = true
      
      try {
        const formData = new FormData()
        formData.append('name', payload.name)
        if (payload.description) formData.append('description', payload.description)
        if (payload.type_id) formData.append('type_id', payload.type_id.toString())
        if (payload.parent_folder) formData.append('parent_folder', payload.parent_folder)
        formData.append('file', payload.file)
        formData.append('visibility', payload.visibility)

        await axios.post(`${BASE_URL}/api/documents/document/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })

        useFeedbackStore().showToast({ 
          type: 'success', 
          title: 'Успех', 
          message: 'Документ создан', 
          time: 5000 
        })

        // Обновляем список
        await this.fetchDocuments()
      } catch (error) {
        logger.error('documents_create_error', { 
          file: 'documentsStore', 
          function: 'createDocument', 
          condition: String(error) 
        })
        useFeedbackStore().showToast({ 
          type: 'error', 
          title: 'Ошибка', 
          message: 'Не удалось создать документ', 
          time: 7000 
        })
        throw error
      } finally {
        feedback.isGlobalLoading = false
      }
    },

    async createFolder(payload: ICreateFolderPayload): Promise<void> {
      const feedback = useFeedbackStore()
      feedback.isGlobalLoading = true
      
      try {
        await axios.post(`${BASE_URL}/api/documents/document-folder/`, {
          name: payload.name,
          path: payload.path,
          visibility: payload.visibility
        })

        useFeedbackStore().showToast({ 
          type: 'success', 
          title: 'Успех', 
          message: 'Папка создана', 
          time: 5000 
        })

        // Обновляем список
        await this.fetchDocuments()
      } catch (error) {
        logger.error('documents_createFolder_error', { 
          file: 'documentsStore', 
          function: 'createFolder', 
          condition: String(error) 
        })
        useFeedbackStore().showToast({ 
          type: 'error', 
          title: 'Ошибка', 
          message: 'Не удалось создать папку', 
          time: 7000 
        })
        throw error
      } finally {
        feedback.isGlobalLoading = false
      }
    },

    async deleteDocument(id: number): Promise<void> {
      const feedback = useFeedbackStore()
      feedback.isGlobalLoading = true
      
      try {
        await axios.delete(`${BASE_URL}/api/documents/document/${id}/`)
        
        useFeedbackStore().showToast({ 
          type: 'success', 
          title: 'Удалено', 
          message: 'Документ удален', 
          time: 4000 
        })

        // Обновляем список
        await this.fetchDocuments()
      } catch (error) {
        logger.error('documents_delete_error', { 
          file: 'documentsStore', 
          function: 'deleteDocument', 
          condition: String(error) 
        })
        useFeedbackStore().showToast({ 
          type: 'error', 
          title: 'Ошибка', 
          message: 'Не удалось удалить документ', 
          time: 7000 
        })
        throw error
      } finally {
        feedback.isGlobalLoading = false
      }
    },

    async deleteFolder(id: number): Promise<void> {
      const feedback = useFeedbackStore()
      feedback.isGlobalLoading = true
      
      try {
        await axios.delete(`${BASE_URL}/api/documents/document-folder/${id}/`)
        
        useFeedbackStore().showToast({ 
          type: 'success', 
          title: 'Удалено', 
          message: 'Папка удалена', 
          time: 4000 
        })

        // Обновляем список
        await this.fetchDocuments()
      } catch (error) {
        logger.error('documents_deleteFolder_error', { 
          file: 'documentsStore', 
          function: 'deleteFolder', 
          condition: String(error) 
        })
        useFeedbackStore().showToast({ 
          type: 'error', 
          title: 'Ошибка', 
          message: 'Не удалось удалить папку', 
          time: 7000 
        })
        throw error
      } finally {
        feedback.isGlobalLoading = false
      }
    },

    async addDocumentVersion(documentId: number, file: File, description?: string): Promise<void> {
      const feedback = useFeedbackStore()
      feedback.isGlobalLoading = true
      
      try {
        const formData = new FormData()
        formData.append('file', file)
        if (description) formData.append('description', description)

        await axios.post(`${BASE_URL}/api/documents/document/${documentId}/versions/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })

        useFeedbackStore().showToast({ 
          type: 'success', 
          title: 'Успех', 
          message: 'Версия документа добавлена', 
          time: 5000 
        })

        // Обновляем список
        await this.fetchDocuments()
      } catch (error) {
        logger.error('documents_addVersion_error', { 
          file: 'documentsStore', 
          function: 'addDocumentVersion', 
          condition: String(error) 
        })
        useFeedbackStore().showToast({ 
          type: 'error', 
          title: 'Ошибка', 
          message: 'Не удалось добавить версию документа', 
          time: 7000 
        })
        throw error
      } finally {
        feedback.isGlobalLoading = false
      }
    },

    // Методы для работы с выбранными элементами
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

    // Утилитарные методы
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
          minute: '2-digit'
        })
      } catch {
        return dateString
      }
    },

    // Методы для работы с URL
    folderIdToUrl(folderId: string | null): string {
      // Конвертируем folder_id в URL параметр
      return folderId || ''
    },

    urlToFolderId(urlParam: string): string | null {
      // Конвертируем URL параметр в folder_id
      if (!urlParam || urlParam === '') return null
      return urlParam
    },

    pathToUrl(path: string): string {
      // Конвертируем путь в URL параметр - используем только path-based навигацию
      console.log('pathToUrl: converting path=', path)
      if (path === '/') {
        console.log('pathToUrl: root path, returning empty string')
        return ''
      }
      const result = path.startsWith('/') ? path.slice(1) : path
      console.log('pathToUrl: result=', result)
      return result
    },

    urlToPath(urlParam: string | string[]): string {
      // Конвертируем URL параметр в путь
      if (!urlParam || urlParam === '' || (Array.isArray(urlParam) && urlParam.length === 0)) return '/'
      
      if (Array.isArray(urlParam)) {
        // Если массив, объединяем в путь, фильтруем пустые элементы
        const filteredParam = urlParam.filter(Boolean)
        // Для API не добавляем начальный слеш для не-корневых путей
        return filteredParam.length > 0 ? filteredParam.join('/') : '/'
      }
      
      // Если строка, возвращаем как есть (без добавления слеша)
      return urlParam === '/' ? '/' : urlParam
    },

    pathToArray(path: string): string[] {
      // Конвертируем путь в массив папок
      if (path === '/' || !path) return []
      // Убираем начальный слеш если есть, затем разбиваем и фильтруем
      const cleanPath = path.startsWith('/') ? path.slice(1) : path
      return cleanPath.split('/').filter(Boolean)
    },

    arrayToPath(pathArray: string[]): string {
      // Конвертируем массив папок в путь
      if (!pathArray || pathArray.length === 0) return '/'
      // Для API не добавляем начальный слеш для не-корневых путей
      return pathArray.join('/')
    },





    getUrlFromCurrentState(): string {
      // Если есть folder_id, используем его; иначе используем path
      return this.currentFolderId ? this.folderIdToUrl(this.currentFolderId) : this.pathToUrl(this.currentPath)
    },

    // Метод для обновления URL (будет вызываться из компонента)
    updateUrl(router: any): void {
      try {
        console.log('updateUrl: called with currentPath=', this.currentPath, 'currentFolderId=', this.currentFolderId)
        
        // Предотвращаем множественные вызовы во время обработки ошибок
        if (this.isLoading) {
          console.log('updateUrl: skipping update while loading')
          return
        }
        
        const currentRoute = router.currentRoute.value
        console.log('updateUrl: currentRoute=', currentRoute.name, currentRoute.params)
        
        // Добавляем дебаунс для предотвращения множественных обновлений URL
        if (this._urlUpdateTimeout) {
          clearTimeout(this._urlUpdateTimeout)
        }
        
        this._urlUpdateTimeout = setTimeout(() => {
          // Определяем текущий путь как массив
          const currentPathArray = this.pathToArray(this.currentPath)
          const currentPathMatch = currentRoute.params.pathMatch
          
          // Сравниваем текущий путь с URL параметром
          let needsUpdate = false
          
          if (currentPathArray.length === 0) {
            // Мы в корне - должны быть на /documents без pathMatch
            needsUpdate = currentRoute.name !== ERouteNames.DOCUMENTS || !!currentPathMatch
          } else {
            // Мы в папке - должны быть на /documents/path с правильным pathMatch
            const expectedPathMatch = currentPathArray.join('/')
            const actualPathMatch = Array.isArray(currentPathMatch) 
              ? currentPathMatch.join('/') 
              : currentPathMatch || ''
              
            needsUpdate = currentRoute.name !== ERouteNames.DOCUMENTS_FOLDER || 
                         actualPathMatch !== expectedPathMatch
          }
          
          if (needsUpdate) {
            if (currentPathArray.length === 0) {
              console.log('updateUrl: navigating to root documents')
              router.replace({ name: ERouteNames.DOCUMENTS }).catch((error: any) => {
                if (error.name !== 'NavigationDuplicated') {
                  console.error('Navigation error:', error)
                }
              })
            } else {
              console.log('updateUrl: navigating to path array:', currentPathArray)
              router.replace({ 
                name: ERouteNames.DOCUMENTS_FOLDER, 
                params: { pathMatch: currentPathArray } 
              }).catch((error: any) => {
                if (error.name !== 'NavigationDuplicated') {
                  console.error('Navigation error:', error)
                }
              })
            }
          }
        }, 100) // Дебаунс 100мс
      } catch (error) {
        console.error('Error updating URL:', error)
      }
    },


    // Метод для очистки таймаутов (вызывается при уничтожении компонента)
    cleanup(): void {
      if (this._urlUpdateTimeout) {
        clearTimeout(this._urlUpdateTimeout)
        this._urlUpdateTimeout = null
      }
    }
  }
})
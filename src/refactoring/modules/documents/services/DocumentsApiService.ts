/**
 * Сервис для работы с API документов
 * 
 * Отвечает за:
 * - HTTP запросы к API документов
 * - Обработку ответов API
 * - Форматирование данных для API
 */

import axios from 'axios'
import { BASE_URL } from '@/refactoring/environment/environment'
import type {
    IListDocumentsPayload,
    ICreateDocumentPayload,
    ICreateFolderPayload,
    IDocumentDetailsResponse,
    IDocumentType,
} from '@/refactoring/modules/documents/types/IDocument'
import type {
    IListDocumentsRequest,
    IListDocumentsResponse,
    ICreateDocumentRequest,
    ICreateFolderRequest,
    IAddVersionRequest,
    IDocumentTypesResponse,
    IDocumentDetailsApiResponse,
    IDocumentVersionsResponse,
    DocumentVisibility,
} from '@/refactoring/modules/documents/types/ApiTypes'

export class DocumentsApiService {
    /**
     * Получает типы документов
     */
    async fetchDocumentTypes(): Promise<IDocumentType[]> {
        const response = await axios.get<IDocumentTypesResponse>(`${BASE_URL}/api/documents/type/`)
        // Handle both paginated response format and direct array format
        if (response.data?.results) {
            return response.data.results
        }
        // If response.data is already an array, return it
        if (Array.isArray(response.data)) {
            return response.data
        }
        return []
    }

    /**
     * Получает список документов
     */
    async fetchDocuments(payload: IListDocumentsPayload = {}): Promise<IListDocumentsResponse> {
        const requestPath = this._getRequestPath(payload)

        const requestPayload: IListDocumentsRequest = {
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

        const response = await axios.post<IListDocumentsResponse>(
            `${BASE_URL}/api/documents/list/`, 
            requestPayload
        )
        
        // API теперь всегда возвращает структуру с пагинацией {next, previous, results}
        return response.data
    }

    /**
     * Определяет путь для запроса
     */
    private _getRequestPath(payload: IListDocumentsPayload): string {
        if (payload.folder_id) {
            return payload.folder_id
        } else if (payload.path) {
            return payload.path === '/' ? '/' : payload.path
        }
        return '/'
    }

    /**
     * Создает документ
     */
    async createDocument(payload: ICreateDocumentPayload): Promise<void> {
        const formData = new FormData()
        formData.append('name', payload.name)
        if (payload.description) formData.append('description', payload.description)
        formData.append('type', payload.type_id ? payload.type_id.toString() : '1')
        formData.append('number', Date.now().toString())
        formData.append('folder_path', payload.parent_folder || '/')
        formData.append('file', payload.file)
        formData.append('visibility', payload.visibility)

        await axios.post(`${BASE_URL}/api/documents/document/`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        })
    }

    /**
     * Создает папку
     */
    async createFolder(payload: ICreateFolderPayload): Promise<void> {
        const requestPayload: ICreateFolderRequest = {
            name: payload.name,
            path: payload.path,
            visibility: payload.visibility,
        }

        await axios.post(`${BASE_URL}/api/documents/document-folder/`, requestPayload)
    }

    /**
     * Удаляет документ
     */
    async deleteDocument(id: number): Promise<void> {
        const response = await axios.delete(`${BASE_URL}/api/documents/document/${id}/`)
        
        if (response.status !== 204 && response.status !== 200) {
            throw new Error(`Unexpected response status: ${response.status}`)
        }
    }

    /**
     * Удаляет папку
     */
    async deleteFolder(id: number): Promise<void> {
        const response = await axios.delete(`${BASE_URL}/api/documents/document-folder/${id}/`)
        
        if (response.status !== 204 && response.status !== 200) {
            throw new Error(`Unexpected response status: ${response.status}`)
        }
    }

    /**
     * Добавляет версию документа
     */
    async addDocumentVersion(
        documentId: number,
        file: File,
        description?: string,
    ): Promise<void> {
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
    }

    /**
     * Получает детали документа
     */
    async fetchDocumentDetails(documentId: number): Promise<IDocumentDetailsApiResponse> {
        const response = await axios.get<IDocumentDetailsApiResponse>(
            `${BASE_URL}/api/documents/document/${documentId}/`
        )
        return response.data
    }

    /**
     * Получает версии документа
     */
    async fetchDocumentVersions(documentId: number): Promise<any[]> {
        const response = await axios.get<IDocumentVersionsResponse>(
            `${BASE_URL}/api/documents/document/${documentId}/versions/`
        )
        // Handle both paginated response format and direct array format
        if (response.data?.results) {
            return response.data.results
        }
        // If response.data is already an array, return it
        if (Array.isArray(response.data)) {
            return response.data
        }
        return []
    }

    /**
     * Удаляет версию документа
     */
    async deleteDocumentVersion(documentId: number, versionId: number): Promise<void> {
        const response = await axios.delete(
            `${BASE_URL}/api/documents/document/${documentId}/versions/${versionId}/`,
        )

        if (response.status !== 204 && response.status !== 200) {
            throw new Error(`Unexpected response status: ${response.status}`)
        }
    }
}
/**
 * Специфичные типы для API документов
 * 
 * Содержит типы для:
 * - API запросов
 * - API ответов
 * - Трансформации данных
 */

import type { 
    IDocument, 
    IDocumentFolder, 
    IDocumentType, 
    IDocumentVersion 
} from './IDocument'

// === API Запросы ===

export interface IListDocumentsRequest {
    path: string
    parent_folder?: string
    page?: number
    page_size?: number
    search?: string
    sort_by?: 'name' | 'size' | 'extension' | 'updated_at'
    sort_order?: 'ascending' | 'descending'
}

export interface ICreateDocumentRequest {
    name: string
    description?: string
    type: string
    number: string
    folder_path: string
    file: File
    visibility: 'public' | 'private' | 'department'
}

export interface ICreateFolderRequest {
    name: string
    path: string
    visibility: 'public' | 'private' | 'department'
}

export interface IAddVersionRequest {
    file: File
    description?: string
}

// === API Ответы ===

export interface IListDocumentsResponse {
    path: string
    current_folder?: {
        folder_id: string
        name: string
        path: string
    }
    parent_folders?: Array<{
        folder_id: string
        name: string
        path: string
    }>
    virtual_path?: string
    name?: string
    path_parent?: string[] | string
    items: Array<IDocument | IDocumentFolder>
    total_count?: number
    page?: number
    page_size?: number
}

export interface IDocumentTypesResponse {
    results?: IDocumentType[]
    count?: number
}

export interface IDocumentDetailsApiResponse extends IDocument {
    versions?: IDocumentVersion[]
    permissions?: {
        can_edit: boolean
        can_delete: boolean
        can_download: boolean
    }
    metadata?: {
        created_by?: {
            id: number
            username: string
            full_name?: string
        }
        updated_by?: {
            id: number
            username: string
            full_name?: string
        }
    }
}

export interface IDocumentVersionsResponse {
    results?: IDocumentVersion[]
    count?: number
}

// === Utility Types ===

/**
 * Тип для создания payload'ов с обязательными полями
 */
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>

// === Enums ===

export enum DocumentSortField {
    NAME = 'name',
    SIZE = 'size',
    EXTENSION = 'extension',
    UPDATED_AT = 'updated_at'
}

export enum SortOrder {
    ASCENDING = 'ascending',
    DESCENDING = 'descending'
}

export enum DocumentVisibility {
    PUBLIC = 'public',
    PRIVATE = 'private',
    DEPARTMENT = 'department'
}

// === Error Types ===

export interface IApiError {
    message: string
    code?: string | number
    details?: Record<string, any>
    field?: string
}

export interface IApiErrorResponse {
    error: IApiError
    errors?: IApiError[]
    status_code?: number
}

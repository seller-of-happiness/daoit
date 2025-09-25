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
    created_by?: string[] // Множественный выбор создателей
    types?: number[] // Множественный выбор типов документов
    cursor?: string // Для cursor-based пагинации
}

export interface ICreateDocumentRequest {
    name: string
    description?: string
    type: string
    number: string
    folder_path: string
    file: File
    visibility: 'creator' | 'public' | 'private' | 'department'
}

export interface ICreateFolderRequest {
    name: string
    path: string
    visibility: 'creator' | 'public' | 'private' | 'department'
}

export interface IAddVersionRequest {
    file: File
    description?: string
}

// === API Ответы ===

export interface IListDocumentsResponse {
    next?: string | null
    previous?: string | null
    // Новый формат: results - массив документов/папок напрямую
    results?: Array<IDocument | IDocumentFolder>
    // Старый формат: results как объект с items
    results_legacy?: {
        id: number | null
        path: string
        virtual_path: string | null
        is_dir: true
        name: string
        visibility: 'creator' | 'public' | 'private' | 'department'
        created_at: string | null
        updated_at: string | null
        size: number | null
        extension: string
        items: Array<IDocument | IDocumentFolder>
        created_by?: {
            id: string
            first_name: string
            last_name: string
        }
    }
    // Поддерживаем старый формат для обратной совместимости
    path?: string
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
    items?: Array<IDocument | IDocumentFolder>
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
 * Тип для трансформации API ответа в клиентский формат
 */
export type ApiToClientTransform<T> = {
    [K in keyof T]: T[K] extends string | null | undefined
        ? T[K]
        : T[K] extends number | null | undefined
        ? T[K]
        : T[K] extends boolean | null | undefined
        ? T[K]
        : T[K] extends Array<infer U>
        ? Array<ApiToClientTransform<U>>
        : ApiToClientTransform<T[K]>
}

/**
 * Тип для создания payload'ов с обязательными полями
 */
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>

/**
 * Тип для опциональных полей в запросах
 */
export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

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
    CREATOR = 'creator',
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

// === Success Response Wrapper ===

export interface IApiSuccessResponse<T = any> {
    data: T
    message?: string
    status: 'success'
}

// === Pagination ===

export interface IPaginationMeta {
    current_page: number
    per_page: number
    total: number
    total_pages: number
    has_next: boolean
    has_prev: boolean
}

export interface IPaginatedResponse<T> {
    data: T[]
    meta: IPaginationMeta
}

// === File Upload Progress ===

export interface IUploadProgress {
    loaded: number
    total: number
    percentage: number
    speed?: number // bytes per second
    estimated_time?: number // seconds
}
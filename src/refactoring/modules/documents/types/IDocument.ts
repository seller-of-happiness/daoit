export interface IDocumentType {
    id: number
    name: string
    slug: string
    description: string
    created_at: string
}

export interface IDocumentFolder {
    id: number | null
    folder_id?: string
    name: string
    description?: string
    path?: string | null
    virtual_path: string | null
    is_dir: true
    visibility: 'creator' | 'public' | 'private' | 'department'
    created_by?: {
        id: string
        first_name: string
        last_name: string
    }
    created_at: string | null
    updated_at: string | null
    size: null
    extension: string
    items: (IDocumentFolder | IDocument)[]
}

export interface IDocument {
    id: number
    type?: number
    name: string
    number?: string
    description?: string
    path?: string | null
    virtual_path: string
    is_dir?: false
    visibility: 'creator' | 'public' | 'private' | 'department'
    created_by?: string | {
        id: string
        first_name: string
        last_name: string
    }
    created_at: string
    updated_at: string
    size: number | null
    extension: string
    type_name?: string
    status?: string
    approved_at?: string
    versions?: IDocumentVersion[]
    file_url?: string
    download_url?: string | null
    items?: [] // В новом формате есть пустой массив items для документов
}

export type IDocumentItem = IDocumentFolder | IDocument

export interface IDocumentVersion {
    id: number
    document: number
    version: string
    status: 'draft' | 'approved' | 'rejected'
    file: string
    size: number
    extension: string
    description?: string
    approved_at?: string
    valid_until?: string
    created_by: string
    created_at: string
    file_url?: string
    download_url?: string
}

export interface IDocumentsStoreState {
    currentPath: string
    currentFolderId: string | null
    currentItems: IDocumentItem[]
    documentTypes: IDocumentType[]
    breadcrumbs: Array<{ name: string; path: string; id: string | null }>
    isLoading: boolean
    isNavigating: boolean
    selectedItems: Set<number>
    _urlUpdateTimeout: ReturnType<typeof setTimeout> | null
    // Поля для поиска
    searchQuery: string
    isSearchMode: boolean
    searchTimeout: ReturnType<typeof setTimeout> | null
}

export interface ICreateDocumentPayload {
    name: string
    description?: string
    type_id?: number
    parent_folder?: string
    file: File
    visibility: 'creator' | 'public' | 'private' | 'department'
}

export interface ICreateFolderPayload {
    name: string
    path: string
    visibility: 'creator' | 'public' | 'private' | 'department'
}

export interface IListDocumentsPayload {
    path?: string
    parent_folder?: string
    folder_id?: string
    page?: number
    page_size?: number
    search?: string
    sort_by?: 'name' | 'size' | 'extension'
    sort_order?: 'ascending' | 'descending'
    created_by?: string[] // Множественный выбор создателей
    types?: number[] // Множественный выбор типов документов
    cursor?: string // Для cursor-based пагинации
}

export interface IDocumentDetailsResponse {
    id: number
    type: number
    name: string
    number: string
    description?: string
    path?: string
    visibility: 'creator' | 'public' | 'private' | 'department'
    created_by: string
    created_at: string
    updated_at: string
    virtual_path: string
    is_dir?: false
    size: number | null
    extension?: string
    type_name?: string
    status?: string
    approved_at?: string
    versions?: IDocumentVersion[]
    file_url?: string
    download_url?: string
}

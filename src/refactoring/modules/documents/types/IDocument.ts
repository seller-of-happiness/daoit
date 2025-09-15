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
  description: string
  path: string
  virtual_path: string | null
  is_dir: true
  visibility: 'creator' | 'public' | 'private' | 'department'
  created_at: string | null
  updated_at: string | null
  size: null
  extension: ''
  items: (IDocumentFolder | IDocument)[]
}

export interface IDocument {
  id: number
  name: string
  description: string
  path: string
  virtual_path: string
  is_dir: false
  visibility: 'creator' | 'public' | 'private' | 'department'
  created_at: string
  updated_at: string
  size: number | null
  extension: string
  type?: IDocumentType
  file_url?: string
  download_url?: string
}

export type IDocumentItem = IDocumentFolder | IDocument

export interface IDocumentVersion {
  id: number
  version_number: number
  file_url: string
  download_url: string
  created_at: string
  created_by: string
  description?: string
}

export interface IDocumentsStoreState {
  currentPath: string
  currentFolderId: string | null
  currentItems: IDocumentItem[]
  documentTypes: IDocumentType[]
  breadcrumbs: Array<{ name: string; path: string; id: string | null }>
  isLoading: boolean
  selectedItems: Set<number>
  _urlUpdateTimeout: ReturnType<typeof setTimeout> | null
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
}
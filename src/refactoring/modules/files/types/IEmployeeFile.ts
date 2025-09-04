import { IUploadState } from '@/refactoring/modules/files/types/IUploadState'

export type FileVisibility = 'self' | 'department' | 'company' | 'root'

export interface IEmployeeFile {
  id: number
  name: string
  description: string
  file: string
  visibility: FileVisibility
  owner: string
  department: string
  created_at: string
  updated_at: string
}

export interface IDepartmentFilesGroup {
  department: string
  files: IEmployeeFile[]
}

export interface IFilesStoreState {
  rootFiles: IEmployeeFile[]
  departmentFiles: IEmployeeFile[]
  visibleFiles: IEmployeeFile[]
  otherDepartments: IDepartmentFilesGroup[]
  isUploading: boolean
    uploadState: IUploadState
}



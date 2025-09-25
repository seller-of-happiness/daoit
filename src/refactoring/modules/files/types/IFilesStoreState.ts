import type { IUploadState } from '@/refactoring/modules/files/types/IUploadState'
import type {  IEmployeeFile } from '@/refactoring/modules/files/types/IEmployeeFile'
import type { IDepartmentFilesGroup } from '@/refactoring/modules/files/types/IDepartmentFilesGroup'

export interface IFilesStoreState {
    rootFiles: IEmployeeFile[]
    departmentFiles: IEmployeeFile[]
    visibleFiles: IEmployeeFile[]
    otherDepartments: IDepartmentFilesGroup[]
    isUploading: boolean
    uploadState: IUploadState
}

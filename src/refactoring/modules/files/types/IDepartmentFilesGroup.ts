import { IEmployeeFile } from '@/refactoring/modules/files/types/IEmployeeFile'

export interface IDepartmentFilesGroup {
    department: string
    files: IEmployeeFile[]
}

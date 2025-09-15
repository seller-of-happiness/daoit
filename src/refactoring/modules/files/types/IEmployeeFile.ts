import type { FileVisibility } from '@/refactoring/modules/files/types/FileVisibility'

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



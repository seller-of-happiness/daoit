import { ICreatedBy } from '@/refactoring/modules/apiStore/types/adverse-events/ICreatedBy'

export interface ICreateSupportServicePayload {
    service_group: { id: number }
    service_category: { id: number }
    priority: number
    block?: { id: string } | null // Изменено с number на string (UUID)
    floor?: { id: string } | null // Изменено с number на string (UUID)
    room?: { id: string }  | null // Изменено с number на string (UUID)
    department?: {
        id: string
    }
    description?: string
    files?: { file: string }[]
    location?: string | null
    created_by?: ICreatedBy
    can_edit?: boolean
    remove_files?: number[]
    created_at?: string
}

// Типизация заявки ВС (пример, дополнить по фактической модели)
import { ICreatedBy } from '@/refactoring/modules/apiStore/types/adverse-events/ICreatedBy'

export interface ISupportServiceItem {
    id: number
    number: number
    service_group: { id: number, name: string }
    service_category: { id: number, name: string }
    priority: number
    block: string
    floor: string
    room: string
    department: number
    description: string
    created_by: ICreatedBy
    created_at: string
    can_edit?: boolean
}

import { ICreatedBy } from '@/refactoring/modules/apiStore/types/adverse-events/ICreatedBy'

export interface ITicketComment {
    id: number
    text: string
    created_at: string
    created_by: ICreatedBy
}

import type { TicketPriority } from '@/refactoring/modules/tickets/types/TicketPriority'
import type { ICreatedBy } from '@/refactoring/modules/apiStore/types/adverse-events/ICreatedBy'

export interface ICreateTicketPayload {
    title: string
    description?: string
    category: { id: number }
    priority: TicketPriority
    deadline_time?: string | null
    coordinator?: ICreatedBy | null;
}

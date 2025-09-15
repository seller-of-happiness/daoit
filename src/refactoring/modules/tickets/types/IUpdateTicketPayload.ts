import type { TicketPriority } from '@/refactoring/modules/tickets/types/TicketPriority'
import type { TicketStatus } from '@/refactoring/modules/tickets/types/TicketStatus'
import { ICreatedBy } from '@/refactoring/modules/apiStore/types/adverse-events/ICreatedBy'

export interface IUpdateTicketPayload {
    performer_group?: number | null
    assignee?: string | null
    due_hours?: number
    due_at?: string | null
    status?: TicketStatus
    title: string
    description?: string
    category: { id: number }
    priority: TicketPriority
    deadline_time?: string | null
    coordinator?: ICreatedBy | null;
}

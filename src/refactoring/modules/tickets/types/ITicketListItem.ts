import type { TicketPriority } from '@/refactoring/modules/tickets/types/TicketPriority'
import type { TicketStatus } from '@/refactoring/modules/tickets/types/TicketStatus'
import type { ITicketCategory } from '@/refactoring/modules/tickets/types/ITicketCategory'


export interface ITicketListItem {
    id: number
    number: number
    title: string
    priority: TicketPriority
    deadline_time: string | null
    status: TicketStatus
    category: ITicketCategory
    created_at: string
}

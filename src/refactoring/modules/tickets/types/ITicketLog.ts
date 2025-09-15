import type { TicketStatus } from '@/refactoring/modules/tickets/types/TicketStatus'

export interface ITicketLog {
    id: number
    action: string
    actor: string
    from_status?: TicketStatus | null
    to_status?: TicketStatus | null
    comment?: string
    created_at: string
}

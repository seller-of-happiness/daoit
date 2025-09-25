import type { ITicketListItem } from '@/refactoring/modules/tickets/types/ITicketListItem'
import type { ITicketDetail } from '@/refactoring/modules/tickets/types/ITicketDetail'
import type { ITicketCategory } from '@/refactoring/modules/tickets/types/ITicketCategory'
import type { ITicketsFilters } from '@/refactoring/modules/tickets/types/ITicketsFilters'

export interface ITicketsStoreState {
    tickets: ITicketListItem[]
    nextCursor: string | null
    currentTicket: ITicketDetail | null
    categories: ITicketCategory[]
    filters: ITicketsFilters
    uploadNewFiles: File[],
    uploadRemovedFileIds: number[],
}

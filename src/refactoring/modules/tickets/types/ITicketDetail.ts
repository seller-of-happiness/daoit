import type { ITicketListItem } from '@/refactoring/modules/tickets/types/ITicketListItem'
import type { ICreatedBy } from '@/refactoring/modules/apiStore/types/adverse-events/ICreatedBy'
import type { ITicketFile } from '@/refactoring/modules/tickets/types/ITicketFile'
import type { ITicketComment } from '@/refactoring/modules/tickets/types/ITicketComment'
import type { ITicketLog } from '@/refactoring/modules/tickets/types/ITicketLog'

export interface ITicketDetail extends ITicketListItem {
    description: string
    coordinator: ICreatedBy | null
    created_by: ICreatedBy
    files: ITicketFile[]
    responsibility_entries: unknown[]

    can_take_in_progress: boolean
    can_complete: boolean
    can_edit_by_inspector: boolean
    can_edit_by_coordinator: boolean
    can_edit_by_creator: boolean
    is_executor: boolean

    comments?: ITicketComment[]
    logs?: ITicketLog[]
}

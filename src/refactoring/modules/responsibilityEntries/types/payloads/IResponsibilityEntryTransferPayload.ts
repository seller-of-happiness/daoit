import type { IResponsibilityEntryForm } from '@/refactoring/modules/responsibilityEntries/types/IResponsibilityEntryForm'

export interface IResponsibilityEntryTransferPayload extends IResponsibilityEntryForm {
    event_id: number
    entry_id: number
}

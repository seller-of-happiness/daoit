import { ICreateAdversePayload } from '@/refactoring/modules/apiStore/types/adverse-events/ICreateAdversePayload'

export interface IUpdateResponsibilityEntryPayload {
    event_id: number;
    responsibility_entries: ICreateAdversePayload['responsibility_entries'];
}

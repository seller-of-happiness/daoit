import type { IResponsibilityEntry } from '@/refactoring/modules/responsibilityEntries/types/IResponsibilityEntry'
import type { IResponsibilityEntryForm } from '@/refactoring/modules/responsibilityEntries/types/IResponsibilityEntryForm'
import type { IFieldValidation } from '@/refactoring/modules/responsibilityEntries/types/IFieldValidation'
import type { IFormMode } from '@/refactoring/modules/responsibilityEntries/types/IFormMode'

// Состояние Pinia-стора responsibilityEntries
export interface IResponsibilityEntriesState {
    currentResponsibilityEntries: IResponsibilityEntry[]
    responsibilityEntry: IResponsibilityEntryForm
    fieldValidation: IFieldValidation
    formMode: IFormMode
    isCreatingEntry: boolean
}

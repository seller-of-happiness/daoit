export interface IResponsibilityEntryActionPayload {
    event_id: number
    entry_id: number
    completion_report?: string
    files?: Array<File | { file: File }>
    file?: File
}

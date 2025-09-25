export interface IResponsibilityEntryForm {
    id?: number;
    department_from?: { id: string; name?: string } | null // меняем number → string (UUID)
    supervisor?: {
        id: string  // меняем number → string (UUID)
        first_name: string
        last_name: string
        middle_name: string
        gender: string
        phone_number: string | null
        birth_date: string | null
    } | null
    department_to?: { id: string; name?: string } | null;  // меняем number → string (UUID)
    responsible_employee?: { id: string; name?: string } | null;    // меняем number → string (UUID)
    instructions?: string
    completion_report?: string,
    urgency?: number
    deadline_time?: string | null
    files?: unknown[]
}

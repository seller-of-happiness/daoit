// Payload для создания новой записи ответственности (POST)

export interface ICreateResponsibilityEntryPayload {
    event_id: number;
    // Поля самой новой записи
    department_from?: { id: string; name: string } | null;
    supervisor?: {
        id: string // изменился тип с number на string
        first_name: string;
        last_name: string;
        middle_name: string;
        gender: string;
        phone_number: string | null;
        birth_date: string | null;
    } | null;
    department_to?: { id: string } | null;
    responsible_employee?: { id: string; name?: string } | null;    // меняем number → string (UUID)
    instructions?: string
    completion_report?: string,
    urgency: number;
    deadline_time: string | null | Date;
    files: unknown[];
}


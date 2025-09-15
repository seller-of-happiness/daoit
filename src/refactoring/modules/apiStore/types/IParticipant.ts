export interface IParticipant {
    id?: number;
    key?: string;
    full_name?: string;
    employee_id?: string
    birth_date?: string | null;
    phone_number?: string | null;
    comment?: string | null;
    participant_type?: 'employee' | 'patient' | 'visitor' | 'other';
}

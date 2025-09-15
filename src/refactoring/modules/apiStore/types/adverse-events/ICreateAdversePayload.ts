import { ICreatedBy } from '@/refactoring/modules/apiStore/types/adverse-events/ICreatedBy'

export interface ICreateAdversePayload {
    id?: number
    number?: number
    status?: string;
    event_type: { id: number; name?: string };
    location?: string | null;
    block?: { id: string } | null;             // number → string
    floor?: { id: string } | null;             // number → string
    room?: { id: string } | null;              // number → string
    department?: { id: string } | null;        // number → string
    description?: string;
    corrective_measures?: string;
    probability?: number | null;
    consequence?: number | null;
    created_by?: ICreatedBy;
    date_time?: string | Date | null;
    participants?: Array<{
        key?: string;
        full_name?: string;
        employee_id?: string;
        birth_date?: string | null;
        phone_number?: string | null;
        comment?: string;
        participant_type?: 'employee' | 'patient' | 'visitor' | 'other';
    }>;
    responsibility_entries?: Array<{
        id?: number;                                   // [ADD] есть в ответе API
        can_complete?: boolean;
        status?:
            | 'new'
            | 'passed'
            | 'in_progress'
            | 'recalled'
            | 'returned'
            | 'rejected'
            | 'cancelled'
            | 'completed'                           // Текущий статус записи
        can_take_in_progress?: boolean;
        department_from?: { id: string; name: string } | null;  // number → string
        supervisor?: {
            id: string;
            first_name: string;
            last_name: string;
            middle_name: string;
            gender: string;
            phone_number: string | null;
            birth_date: string | null;
        } | null;
        department_to?: { id: string } | null;  // number → string
        responsible_employee?: { id: string } | null;    // number → string
        completion_report?: string
        instructions?: string;
        urgency: number;
        deadline_time: string | null;
        files?: File[];
        created_at?: string
    }>;
    coordinator?: ICreatedBy | null;
    can_edit_by_creator?: boolean;
    can_edit_by_inspector?: boolean;
    can_edit_by_coordinator?: boolean;
    is_executor?: boolean;
    can_complete?: boolean;
    can_take_in_progress?: boolean;
    created_at?: string
}

export interface ITicketResponsibilityEntry {
    id: number;
    supervisor: any;
    responsible_employee: any;
    status: string;
    instructions: string;
    completion_report: string;
    priority: number;
    deadline_time: string | null;
    created_at: string;
    updated_at: string;
    files: any[];
    can_take_in_progress: boolean;
    can_complete: boolean;
}

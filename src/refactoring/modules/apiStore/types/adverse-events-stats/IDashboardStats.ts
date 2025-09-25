export interface IDashboardStats {
    adverse_events: {
        active: number
        department_active: number
        current_month: number
        prev_month: number
    }
    tickets: {
        active: number
        department_active: number
        current_month: number
        prev_month: number
    }
}

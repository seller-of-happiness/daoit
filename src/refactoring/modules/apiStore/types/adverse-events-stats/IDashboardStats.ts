export interface IDashboardStats {
    adverse_events: {
        risk: {
            high: number
            medium: number
            low: number
        }
        departments: IDepartmentStats[]
        active: number
        department_active: number
        current_month: number
        prev_month: number
    }
    support_service: {
        service_groups: IServiceGroup[]
        service_categories: IServiceCategory[]
        active: number
        department_active: number
        current_month: number
        prev_month: number
    }
}

interface IDepartmentStats {
    id: number | null
    name: string | null
    count: number
}

interface IServiceGroup {
    id: number
    name: string
    count: number
}

interface IServiceCategory {
    id: number
    name: string
    count: number
}

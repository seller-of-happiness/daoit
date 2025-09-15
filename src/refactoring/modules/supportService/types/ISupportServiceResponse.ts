export interface ISupportServiceResponse {
    id: number
    number: number
    service_group: { id: number; name: string }
    service_category: { id: number; name: string }
    priority: number
    block?: { id: number; name: string }
    floor?: { id: number; name: string; number: number }
    room?: { id: number; name: string; number: string }
    department?: number
    description?: string
    manager: {
        id: number
        first_name: string
        last_name: string
        middle_name: string
        gender: string
        phone_number: string
        birth_date: string
    }
    created_by: number
    created_at: string
    files?: { id: number; file: string; created_at: string; created_by: number }[]
}

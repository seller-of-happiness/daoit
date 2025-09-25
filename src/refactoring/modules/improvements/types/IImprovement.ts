export interface IImprovementSuggestion {
    id: number
    title: string
    text: string
    department: {
        id: string
        name?: string
    }
    status: string | null
    answer?: string | null
    votes: number
    created_at?: string
    updated_at?: string
    created_by?: {
        id: string
        first_name?: string
        last_name?: string
    }
}

export interface ICreateImprovementPayload {
    title: string
    text: string
    department: { id: string } | null
}

export interface IUpdateImprovementPayload {
    status?: string | null
    answer?: string | null
}

export interface IImprovementFilters {
    status?: string[] | null
    department?: string | null
    search?: string | null
    mine?: boolean
    my_department?: boolean
    to_my_department?: boolean
}
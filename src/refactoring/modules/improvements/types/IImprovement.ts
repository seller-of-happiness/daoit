export interface IImprovementSuggestion {
    id: number
    title: string
    text: string
    status: string
    votes: number
    created_at?: string
    updated_at?: string
    department?: {
        id: string
        name: string
    } | null
    author?: {
        id: string
        name: string
        full_name: string
    }
    answer?: string | null
}

export interface ICreateImprovementPayload {
    title: string
    text: string
    department: {
        id: string
    } | null
}

export interface IUpdateImprovementPayload {
    status: string | null
    answer: string | null
}

export interface IImprovementFilters {
    status: string[]
    mine: boolean
    my_department: boolean
    to_my_department: boolean
}
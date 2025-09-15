import { ICreatedBy } from '@/refactoring/modules/apiStore/types/adverse-events/ICreatedBy'

export interface IAdverseEvent {
    id: number
    number: number
    status: string
    risk?: 'low' | 'medium' | 'high' | null
    event_type: {
        id: number
        name: string
    }
    location: string | null
    block: { id: string; name: string } | null
    floor: { id: string; name: string; number: number } | null
    room:  { id: string; name: string; number: string } | null
    department: { id: string; name: string; short_name?: string } | null
    description: string
    corrective_measures: string
    created_by?: ICreatedBy
    probability: number | null
    consequence: number | null
    date_time: string
    can_edit?: boolean
}

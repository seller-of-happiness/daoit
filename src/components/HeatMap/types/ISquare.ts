import type { ITrisk } from '@/components/HeatMap/types/ITrisk'

export interface ISquare {
    id: number
    risk: ITrisk
    detail: string
    recurrence: string
    description: string
}

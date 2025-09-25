import type { ISquare } from '@/components/HeatMap/types/ISquare'

export interface IHeatMap {
    department: string;
    adverse_events: ISquare[]
}

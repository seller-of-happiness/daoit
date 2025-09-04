import type { IBlock } from '@/refactoring/modules/apiStore/types/hospital-skeleton/IBlock'

export interface IHospitalSkeleton {
    id: string // Изменено с number на string (UUID)
    name: string
    description: string
    blocks: IBlock[]
    created_at: string
    updated_at: string
}

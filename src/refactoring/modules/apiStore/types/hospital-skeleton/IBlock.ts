import type { IHospitalRef } from '@/refactoring/modules/apiStore/types/hospital-skeleton/refs/IHospitalRef'
import type { IFloor } from '@/refactoring/modules/apiStore/types/hospital-skeleton/IFloor'

export interface IBlock {
    id: string // Изменено с number на string (UUID)
    name: string
    // Ссылка на объект больницы
    hospital: IHospitalRef
    description: string
    floors: IFloor[]
}

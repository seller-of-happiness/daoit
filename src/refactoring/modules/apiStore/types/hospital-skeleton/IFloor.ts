import type { IRoom } from '@/refactoring/modules/apiStore/types/hospital-skeleton/IRoom'
import type { IBlockRef } from '@/refactoring/modules/apiStore/types/hospital-skeleton/refs/IBlockRef'

export interface IFloor {
    id: string // Изменено с number на string (UUID)
    number: number
    // Ссылка на объект блока
    block: IBlockRef
    name: string
    description: string
    rooms: IRoom[]
}

import { IPosition } from '@/refactoring/modules/apiStore/types/adverse-events/IPosition'
import { IDepartment } from '@/refactoring/modules/apiStore/types/departmens/IDepartment'

export interface ICreatedBy {
    id: string
    snils: string
    phone_number: string
    email: string
    last_name: string
    first_name: string
    middle_name: string
    gender: 'М' | 'Ж'
    birth_date: string // YYYY-MM-DD
    position: IPosition
    department: IDepartment
    description: string
    hire_date: string // YYYY-MM-DD
    groups: string[]
    is_manager: boolean
}

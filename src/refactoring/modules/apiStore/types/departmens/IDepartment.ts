import { ISubdepartment } from '@/refactoring/modules/apiStore/types/departmens/ISubdepartment'

export interface IDepartment {
    id: string  // Изменено с number на string (UUID)
    name: string
    code: string
    description: string
    block: {
        id: string  // Изменено с number на string (UUID)
        name: string
    }
    manager: {  // Теперь может быть null
        id: string
        first_name: string
        last_name: string
        middle_name: string
        gender: string
        phone_number: string
        birth_date: string
    } | null
    subdepartments: ISubdepartment[]  // Новое поле
}

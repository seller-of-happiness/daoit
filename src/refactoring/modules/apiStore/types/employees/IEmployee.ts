import type { IEmployeePosition } from '@/refactoring/modules/apiStore/types/employees/IEmployeePosition'
import type { IEmployeeDepartment } from '@/refactoring/modules/apiStore/types/employees/IEmployeeDepartment'

export interface IEmployee {
    id: string                   // UUID (было number)
    snils: string | null         // Новое поле
    phone_number: string
    email: string | null
    last_name: string
    first_name: string
    middle_name: string
    gender: 'М' | 'Ж' | string   // Уточненный тип
    birth_date: string | null
    position: IEmployeePosition
    department: IEmployeeDepartment
    description: string
    hire_date: string | null
}

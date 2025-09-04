// Описание структуры сотрудника в записи ответственности
export interface IResponsibilityEmployee {
    id: string
    first_name: string
    last_name: string
    middle_name: string
    gender: string
    phone_number: string | null
    birth_date: string | null
}

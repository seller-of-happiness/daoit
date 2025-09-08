// Интерфейс, описывающий структуру объекта user из бэка
export interface IUserType {
    id: string // изменился тип с number на string
    uuid?: string // UUID пользователя для каналов чата
    snils: string | null
    phone_number: string
    email: string | null
    last_name: string
    first_name: string
    middle_name: string
    full_name?: string // Полное имя пользователя
    user_name?: string // Имя пользователя для чатов
    username?: string // Альтернативное имя пользователя
    gender: string
    birth_date: string | null
    position: {
        id: string
        name: string
    } | null
    department: {
        id: string
        name: string
    } | null
    description: string
    hire_date: string | null
    is_manager: boolean
    groups: string[]
    centrifugo: {
        token: string
        expiry: string
        url: string
    }
}

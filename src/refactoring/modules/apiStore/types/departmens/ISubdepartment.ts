export interface ISubdepartment {
    id: string
    name: string
    code: string
    manager: string  // UUID менеджера
    description: string
    block: string  // UUID блока
}

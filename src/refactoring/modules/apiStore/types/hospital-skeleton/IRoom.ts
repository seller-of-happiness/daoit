export interface IRoom {
    id: string // Изменено с number на string (UUID)
    name: string
    // Номер комнаты — бывает строкой либо может быть null
    number: string | null
}

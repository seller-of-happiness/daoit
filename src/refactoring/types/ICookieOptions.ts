export interface ICookieOptions {
    name: string
    value: string
    expires?: Date | number // Дата окончания или TTL в секундах
    path?: string
    domain?: string
    secure?: boolean
    sameSite?: 'Strict' | 'Lax' | 'None'
}

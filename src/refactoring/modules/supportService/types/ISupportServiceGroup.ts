import type { ISupportServiceCategory } from '@/refactoring/modules/supportService/types/ISupportServiceCategory'

export interface ISupportServiceGroup {
    id: number
    name: string
    service_categories: ISupportServiceCategory[]
    performers: any[] // если нужны типы — добавить позже
    phone: string
    email: string
    description: string
    logo: string
    created_at: string
}

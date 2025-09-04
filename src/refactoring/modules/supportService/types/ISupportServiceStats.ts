// Типизация статистики по ВС
export interface ISupportServiceStats {
    service_groups: Array<{ id: number, name: string, count: number }>
    service_categories: Array<{ id: number, name: string, count: number }>
}

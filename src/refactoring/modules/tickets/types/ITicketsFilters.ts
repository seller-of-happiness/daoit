export interface ITicketsFilters {
    search?: string
    categories?: number[] | null
    priorities?: number[] | null
    statuses?: string[] | null
    created_after?: Date | null
    created_before?: Date | null
    is_active?: boolean | null
}



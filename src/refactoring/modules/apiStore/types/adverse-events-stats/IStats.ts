import type { IStatsDepartment } from '@/refactoring/modules/apiStore/types/adverse-events-stats/IStatsDepartment'
import type { IStatsRisk } from '@/refactoring/modules/apiStore/types/adverse-events-stats/IStatsRisk'

export interface IStats {
    count: number
    risk: IStatsRisk
    departments: IStatsDepartment[]
    active?: number          // перенесено из IStatsStatus
    department_active?: number // перенесено из IStatsStatus
    current_month?: number    // перенесено из IStatsStatus
    prev_month?: number       // перенесено из IStatsStatus
}

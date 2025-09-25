import type { IDepartment } from '@/refactoring/modules/apiStore/types/departmens/IDepartment'
import type { IAdverseEvent } from '@/refactoring/modules/apiStore/types/adverse-events/IAdverseEvent'
import type { IStats } from '@/refactoring/modules/apiStore/types/adverse-events-stats/IStats'
import type { IAdverseEventCategory } from '@/refactoring/modules/apiStore/types/adverse-events-category/IAdverseEventCategory'
import type { IFilters } from '@/refactoring/modules/apiStore/types/filters/IFilters'
import type { IEmployee } from '@/refactoring/modules/apiStore/types/employees/IEmployee'
import type { IHospitalSkeleton } from '@/refactoring/modules/apiStore/types/hospital-skeleton/IHospitalSkeleton'
import type { ICreateAdversePayload } from '@/refactoring/modules/apiStore/types/adverse-events/ICreateAdversePayload'
import type { IDashboardStats } from '@/refactoring/modules/apiStore/types/adverse-events-stats/IDashboardStats'
import type { IHeatMap } from '@/refactoring/modules/apiStore/types/IHeatMap'

export interface IApiStoreState {
    nextAdverseEventsCursor: string | null
    departments: IDepartment[]
    adverseEvents: IAdverseEvent[]
    adverseEventsStats: IStats
    statsDashboard: IDashboardStats
    heatmap: IHeatMap[]
    adverseEventsCategory: IAdverseEventCategory[]
    filters: IFilters
    employees: IEmployee[]
    hospitalSkeleton: IHospitalSkeleton[]
    currentAdverseEvent: ICreateAdversePayload
    editableAdverseEvent: ICreateAdversePayload | null
}

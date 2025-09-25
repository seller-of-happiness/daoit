import type { ISupportServiceItem } from '@/refactoring/modules/supportService/types/ISupportServiceItem'
import type { ISupportServiceStats } from '@/refactoring/modules/supportService/types/ISupportServiceStats'
import type { ISupportServiceFilters } from '@/refactoring/modules/supportService/types/ISupportServiceFilters'
import type { ISupportServiceGroup } from '@/refactoring/modules/supportService/types/ISupportServiceGroup'
import type { ISupportServiceCategory } from '@/refactoring/modules/supportService/types/ISupportServiceCategory'
import type { ICreateSupportServicePayload } from '@/refactoring/modules/supportService/types/ICreateSupportServicePayload'
import { ICreateAdversePayload } from '@/refactoring/modules/apiStore/types/adverse-events/ICreateAdversePayload'
import { IUploadState } from '@/refactoring/modules/files/types/IUploadState'

export interface ISupportServiceStoreState {
    nextSupportServiceCursor: string | null         // курсор для пагинации
    supportServices: ISupportServiceItem[]          // массив заявок ВС
    supportServiceStats: ISupportServiceStats
    filters: ISupportServiceFilters                 // текущие фильтры
    supportServiceGroups: ISupportServiceGroup[]
    supportServiceCategories: ISupportServiceCategory[]
    currentSupportService: ICreateSupportServicePayload
    editableSupportService: ICreateSupportServicePayload | null
}

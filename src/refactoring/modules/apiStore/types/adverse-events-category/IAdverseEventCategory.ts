import {
    IAdverseEventCategoryType
} from '@/refactoring/modules/apiStore/types/adverse-events-category/IAdverseEventCategoryType'

export interface IAdverseEventCategory {
    id: number
    name: string
    description: string
    types: IAdverseEventCategoryType[]
}

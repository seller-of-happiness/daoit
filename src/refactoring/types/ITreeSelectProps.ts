import type { ITreeNode } from '@/refactoring/modules/apiStore/types/ITreeNode'
import type { IVModelTreeSelect } from '@/refactoring/types/IVModelTreeSelect'

export interface ITreeSelectProps<T extends IVModelTreeSelect = IVModelTreeSelect> {
    loading?: boolean
    placeholder?: string
    labelFor: string
    className?: string | string[]
    // Обработчик изменений, принимает данные любого типа (T)
    changeHandler?: (selectedKeys: T | null) => void
    selectionMode?: 'single' | 'multiple'
    name?: string
    options: ITreeNode[]
}

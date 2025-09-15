import type { MultiSelectChangeEvent } from 'primevue/multiselect'

export interface IFilterProps<T = string | number> {
    loading?: boolean
    placeholder?: string
    labelFor: string
    options: { id: T; name: string }[] // Универсальный тип для id
    className?: string
    changeHandler?: (event: MultiSelectChangeEvent) => void
    optionLabel?: string
    optionValue?: string
    display?: string
}

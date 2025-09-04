import type { IUserType } from '@/refactoring/modules/user/types/IUserType'

// Интерфейс состояния userStore: содержит объект user или null
export interface IUserStoreState {
    user: IUserType | null
}

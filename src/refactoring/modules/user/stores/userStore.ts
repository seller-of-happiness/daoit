import { defineStore } from 'pinia'
import type { IUserStoreState } from '../types/IUserStoreState'
import type { IUserType } from '../types/IUserType'

export const useUserStore = defineStore('userStore', {
    state: (): IUserStoreState => ({
        // Инициализируем user как null, пока не получим реальные данные
        user: null,
    }),

    actions: {
        // Инициализирует данные пользователя в сторе
        initializeUser(payload: { user: IUserType }) {
            // Деструктурируем объект user из payload
            const { user } = payload
            this.user = user
        },
    },
})

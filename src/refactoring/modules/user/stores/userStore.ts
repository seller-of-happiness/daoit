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
            
            // Отладка: показываем данные пользователя
            console.log('👤 Инициализирован пользователь:', {
                id: user?.id,
                uuid: user?.uuid,
                full_name: user?.full_name,
                first_name: user?.first_name,
                last_name: user?.last_name,
                user_name: user?.user_name,
                username: user?.username,
                email: user?.email
            })
        },
    },
})

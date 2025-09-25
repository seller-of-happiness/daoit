import type { InternalAxiosRequestConfig } from 'axios'

export interface ICustomAxiosRequestConfig extends InternalAxiosRequestConfig {
    skipAuth?: boolean // Добавили свойство для пропуска токена
}

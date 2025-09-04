import { ICustomAxiosRequestConfig } from '@/refactoring/types/ICustomAxiosRequestConfig'

export interface IPendingRequest {
    /**
     * Конфигурация оригинального запроса, который привел к ошибке 423
     * Включает URL, метод, данные, заголовки и другие параметры
     */
    config: ICustomAxiosRequestConfig

    /**
     * Функция resolve для Promise, который был возвращен интерцептором
     * Позволяет завершить ожидание оригинального запроса успешным результатом
     */
    resolve: (value: any) => void

    /**
     * Функция reject для Promise, который был возвращен интерцептором
     * Позволяет завершить ожидание оригинального запроса с ошибкой
     */
    reject: (error: any) => void
}

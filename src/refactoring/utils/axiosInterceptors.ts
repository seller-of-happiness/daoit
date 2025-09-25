/*
 * Интерцепторы для axios - глобальная обработка запросов и ответов
 *
 * Основные функции:
 * - Логирование всех исходящих запросов (метод + URL)
 * - Логирование ошибок с дополнительной информацией
 * - Автоматическая подстановка токена авторизации
 * - Обработка невалидных/просроченных токенов
 * - Защита от циклических редиректов при 401 ошибках
 *
 * Особенности:
 * - Использование optional chaining для безопасного доступа
 * - Кастомная конфигурация через ICustomAxiosRequestConfig
 * - Интеграция с системой аутентификации через authStore
 * - Поддержка skipAuth флага для исключения эндпоинтов
 */

import axios from 'axios'
import { useAuthStore } from '@/refactoring/modules/authStore/stores/authStore'
import { useFeedbackStore } from '@/refactoring/modules/feedback/stores/feedbackStore'
import { getCookie } from '@/refactoring/utils/cookies'
import type { ICustomAxiosRequestConfig } from '@/refactoring/types/ICustomAxiosRequestConfig'
import { ECookiesNames } from '@/refactoring/types/ECookiesNames'
import { logger } from '@/refactoring/utils/eventLogger'

/**
 * Интерцептор для обработки ответов сервера
 *
 * Логирует:
 * - Успешные ответы (прозрачно пропускает)
 * - Ошибки с детализацией (метод, URL, статус, сообщение)
 *
 * Особые случаи:
 * - Автоматический логаут при невалидном токене
 * - Защита от обработки auth-эндпоинтов
 * - Обработка блокировки по PIN-коду (423 статус)
 *   - Сохраняет заблокированные запросы для повторной отправки
 *   - Показывает интерфейс ввода PIN-кода
 */
axios.interceptors.response.use(
    (response) => {
        // Прозрачно пропускаем успешные ответы
        return response
    },
    (error) => {
        // Безопасное извлечение данных об ошибке
        const method = error.config.method?.toUpperCase() ?? 'UNKNOWN_METHOD'
        const url = error.config.url ?? 'unknown URL'
        const errorMessage = error.response?.data?.message || error.message || 'Unknown error'
        const statusCode = error.response?.status || 'Unknown status'

        // Логирование ошибок только в режиме разработки
        if (import.meta.env.DEV) {
            console.log(
                'axiosInterceptors REJECT:',
                method,
                url,
                `Status: ${statusCode}`,
                `Error: ${errorMessage}`,
            )
        }

        // Проверка условий для автоматического логаута
        const isInvalidToken = error.response?.data?.errors?.detail === 'Недопустимый токен.'
        const isUnauthorized = error.response?.status === 401
        const isAuthUrl = ['/api/auth/login/', '/api/auth/logout/'].some((path) =>
            error.config.url?.endsWith(path),
        )

        // Автоматический логаут при невалидном токене
        if (isInvalidToken && isUnauthorized && !isAuthUrl) {
            void useAuthStore().logout()
        }

        // Обработка блокировки по PIN-коду (423 статус)
        const isLocked = error.response?.status === 423
        if (isLocked) {
            useFeedbackStore().isGlobalLoading = false
            // Создаем новый Promise, который будет разрешен после ввода PIN-кода
            return new Promise((resolve, reject) => {
                // Сохраняем оригинальный запрос для повторной отправки
                useAuthStore().addPendingRequest({
                    config: error.config,
                    resolve,
                    reject,
                })

                // Показываем интерфейс ввода PIN-кода
                useAuthStore().showPinUnlock = true
            })
        }

        return Promise.reject(error)
    },
)

/**
 * Интерцептор для обработки исходящих запросов
 *
 * Функционал:
 * - Логирование метода и URL запроса
 * - Автоматическая подстановка токена авторизации
 * - Поддержка skipAuth флага для исключения эндпоинтов
 *
 * Особенности:
 * - Пропускает auth-эндпоинты
 * - Использует cookie или authStore для хранения токена
 */
axios.interceptors.request.use(
    (config: ICustomAxiosRequestConfig) => {
        // Автоматическая подстановка токена, если:
        // - Это не auth-эндпоинт
        // - Не установлен флаг skipAuth
        if (!config.url?.endsWith('/api/auth/login/') && !config.skipAuth) {
            const authStore = useAuthStore()
            const feedbackStore = useFeedbackStore()

            const tokenFromCookie = getCookie(ECookiesNames.AUTH_TOKEN)
            const tokenFromStore = authStore.authToken

            const token = tokenFromCookie || tokenFromStore

            if (token) {
                config.headers.Authorization = `Token ${token}`
            } else {
                logger.error('axiosInterceptors_error', {
                    file: 'axiosInterceptors.ts',
                    function: 'axios.interceptors.request.use',
                    condition: `❌ Ошибка подстановки accessToken`,
                })
                feedbackStore.showToast({
                    type: 'error',
                    title: 'Отсутствует токен',
                    message: 'Не удалось установить токен в заголовок запроса',
                    time: 5000,
                })
            }
        }

        return config
    },
    (error) => {
        return Promise.reject(error)
    },
)

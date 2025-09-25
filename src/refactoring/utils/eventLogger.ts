/*
* Логирование приложения с интеграцией с бэкендом
*
* Основные функции:
* - Логирование в консоль браузера
* - Отправка логов на сервер
* - Форматирование временных меток с учетом временной зоны
* - Поддержка разных уровней логирования (debug, info, warn, error)
* - Интеграция с системой аутентификации (пропуск для логов)
*
* Особенности:
* - Кастомные хуки для отправки логов
* - Настраиваемый префикс для консольных логов
* - Обработка ошибок при отправке логов
* - Конфигурируемый уровень логирования
*/

import { createLogger } from 'vue-logger-plugin'
import { BASE_URL, TIMEZONE } from '@/refactoring/environment/environment'
import axios from 'axios'
import type { LogEvent, LoggerHook } from 'vue-logger-plugin'
import { ICustomAxiosRequestConfig } from '@/refactoring/types/ICustomAxiosRequestConfig'

// Смещение временной зоны в миллисекундах
const timezoneOffsetMs = TIMEZONE * 60 * 60 * 1000

/**
 * Генерирует отформатированную временную метку с учетом временной зоны
 *
 * @returns {string} Строка в формате "DD.MM.YYYY HH:MM:SS"
 *
 * Пример:
 * "25.12.2023 14:30:45"
 */
export const getFormattedTimestamp = (): string => {
    const date = new Date()
    const localDate = new Date(date.getTime() + timezoneOffsetMs)

    // Вспомогательная функция для дополнения нулями
    const pad = (n: number) => n.toString().padStart(2, '0')

    // Извлечение и форматирование компонентов даты
    const day = pad(localDate.getUTCDate())
    const month = pad(localDate.getUTCMonth() + 1)
    const year = localDate.getUTCFullYear()

    // Извлечение и форматирование компонентов времени
    const hours = pad(localDate.getUTCHours())
    const minutes = pad(localDate.getUTCMinutes())
    const seconds = pad(localDate.getUTCSeconds())

    return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`
}

/**
 * Хук для отправки логов на бэкенд
 *
 * @property {function} run - Основная функция обработки события логирования
 *
 * Особенности:
 * - Отправляет POST запрос на /api/logger
 * - Пропускает проверку авторизации (skipAuth: true)
 * - Логирует ошибки отправки в консоль
 */
const sendToBackendHook: LoggerHook = {
    run(event: LogEvent) {
        axios.post(
            `${BASE_URL}/api/logger/`,
            {
                level: event.level,
                message: event.argumentArray,
                timestamp: getFormattedTimestamp()
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                },
                skipAuth: true
            } as ICustomAxiosRequestConfig
        ).catch((error) => {
            console.error('Ошибка отправки лога', error)
        })
    }
}

/**
 * Экземпляр логгера с настройками:
 * - enabled: true - Логгер включен
 * - consoleEnabled: true - Вывод в консоль браузера
 * - level: 'debug' - Уровень логирования (debug)
 * - callerInfo: true - Информация о вызывающем коде
 * - prefixFormat: () => '[APP]' - Префикс для логов
 * - afterHooks: [sendToBackendHook] - Хук для отправки на сервер
 */
const logger = createLogger({
    enabled: true,
    consoleEnabled: true,
    level: 'debug',
    callerInfo: true,
    prefixFormat: () => '[APP]',
    afterHooks: [sendToBackendHook],
})

export { logger }

/*
* Утилиты для работы с cookies (document.cookie)
*
* Основные функции:
* - Парсинг всех cookies в объект
* - Получение/установка/удаление отдельных cookies
* - Поддержка всех стандартных параметров cookies:
*   - expires (число секунд или Date)
*   - path, domain, secure, sameSite
* - Работа с датами в cookies
*
* Особенности:
* - Автоматическое кодирование/декодирование значений
* - Безопасная обработка отсутствующих cookies
* - Чистый TypeScript с явными типами
*/

import type { ICookieOptions } from '@/refactoring/types/ICookieOptions'

/**
 * Парсит document.cookie в объект вида { [name]: value }
 *
 * @returns {Record<string, string>} Объект с парами имя-значение всех cookies
 *
 * Пример:
 * 'cookie1=value1; cookie2=value2' -> { cookie1: 'value1', cookie2: 'value2' }
 */
export function parseCookies(): Record<string, string> {
    const result: Record<string, string> = {}
    const raw = document.cookie ? document.cookie.split('; ') : []
    raw.forEach((pair) => {
        const parts = pair.split('=')
        const name = parts[0]
        const value = parts.slice(1).join('=')
        result[name] = decodeURIComponent(value)
    })
    return result
}

/**
 * Получает значение cookie по имени
 *
 * @param {string} name Имя cookie
 * @returns {string | null} Значение cookie или null если не найдено
 *
 * Пример:
 * getCookie('authToken') -> 'abc123' или null
 */
export function getCookie(name: string): string | null {
    const all = parseCookies()
    return all[name]
}

/**
 * Формирует строку cookie из параметров
 *
 * @param {ICookieOptions} opts Параметры cookie
 * @returns {string} Готовая строка для document.cookie
 *
 * @private Внутренняя функция, используется в setCookie
 */
function buildCookieString(opts: ICookieOptions): string {
    const { name, value, path, domain, secure, sameSite } = opts
    let expiresString = ''

    // Обработка expires (поддержка числа секунд или Date)
    if (opts.expires !== undefined) {
        if (typeof opts.expires === 'number') {
            const d = new Date(Date.now() + opts.expires * 1000)
            expiresString = d.toUTCString()
        } else {
            expiresString = opts.expires.toUTCString()
        }
    }

    // Базовая пара name=value
    let cookie = `${name}=${encodeURIComponent(value)}`

    // Добавление опциональных параметров
    if (expiresString) {
        cookie += `; Expires=${expiresString}`
    }
    if (path) {
        cookie += `; Path=${path}`
    }
    if (domain) {
        cookie += `; Domain=${domain}`
    }
    if (secure) {
        cookie += `; Secure`
    }
    if (sameSite) {
        cookie += `; SameSite=${sameSite}`
    }

    return cookie
}

/**
 * Устанавливает cookie с заданными параметрами
 *
 * @param {ICookieOptions} options Параметры cookie
 *
 * Пример:
 * setCookie({
 *   name: 'authToken',
 *   value: 'abc123',
 *   expires: 3600, // 1 час
 *   path: '/',
 *   secure: true
 * })
 */
export function setCookie(options: ICookieOptions): void {
    document.cookie = buildCookieString(options)
}

/**
 * Удаляет cookie путем установки даты истечения в прошлое
 *
 * принимает {string} name Имя cookie для удаления
 * принимает {string} [path='/'] Путь cookie (должен совпадать с путем при установке)
 *
 * Пример:
 * deleteCookie('authToken')
 */
export function deleteCookie(name: string, path = '/'): void {
    setCookie({
        name,
        value: '',
        expires: new Date(0), // Дата в прошлом
        path
    })
}

/**
 * Получает значение cookie как объект Date
 *
 * @param {string} name Имя cookie
 * @returns {Date | null} Объект Date или null если cookie нет или невалидна
 *
 * Пример:
 * getCookieDate('expiryDate') -> Date или null
 */
export function getCookieDate(name: string): Date | null {
    const value = getCookie(name)
    return value ? new Date(value) : null
}

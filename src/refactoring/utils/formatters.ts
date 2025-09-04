/**
 * Утилиты для форматирования данных
 *
 * Основные функции:
 * - Форматирование ФИО (полное и инициалы)
 * - Очистка и форматирование телефонных номеров
 * - Преобразование дат между различными форматами
 * - Конвертация дат для API
 *
 * Особенности:
 * - Защита от null/undefined значений
 * - Поддержка русского формата дат
 * - Гибкая настройка форматов вывода
 */

/**
 * Форматирует ФИО в одну строку
 * @param {Object} data - Объект с полями имени
 * @param {string} [data.last_name] - Фамилия
 * @param {string} [data.first_name] - Имя
 * @param {string} [data.middle_name] - Отчество
 * @returns {string} Полное имя в формате "Фамилия Имя Отчество"
 *
 * Пример:
 * getFullName({last_name: "Иванов", first_name: "Иван", middle_name: "Иванович"})
 * -> "Иванов Иван Иванович"
 */
export const getFullName = (data: {
    last_name?: string
    first_name?: string
    middle_name?: string
}): string => `${data?.last_name ?? ''} ${data?.first_name ?? ''} ${data?.middle_name ?? ''}`.trim()

/**
 * Форматирует ФИО в инициалы
 * @param {Object} data - Объект с полями имени
 * @param {string} [data.last_name] - Фамилия
 * @param {string} [data.first_name] - Имя
 * @param {string} [data.middle_name] - Отчество
 * @param {boolean} [lastNameInitial=false] - Сокращать ли фамилию до первой буквы
 * @returns {string} Инициалы в формате "Иванов И.И." или "И И.И." (при lastNameInitial=true)
 *
 * Примеры:
 * getInitialsFullName({last_name: "Иванов", first_name: "Иван", middle_name: "Иванович"})
 * -> "Иванов И.И."
 *
 * getInitialsFullName({last_name: "Иванов", first_name: "Иван"}, true)
 * -> "И И."
 */
export const getInitialsFullName = (
    data: { last_name?: string; first_name?: string; middle_name?: string },
    lastNameInitial = false,
): string => {
    const lastName = lastNameInitial ? data.last_name?.[0] : data.last_name
    const firstName = data.first_name?.[0]
    const middleName = data.middle_name?.[0]

    if (lastName && firstName && middleName) {
        return `${lastName} ${firstName}.${middleName}.`
    } else if (lastName && firstName) {
        return `${lastName} ${firstName}.`
    } else if (lastName) {
        return `${lastName}`
    }
    return ''
}

/**
 * Очищает номер телефона от всех нецифровых символов
 * @param {string} phoneNumber - Номер телефона в произвольном формате
 * @returns {string} Номер, содержащий только цифры
 *
 * Пример:
 * formatAndClearPhoneNumber("+7 (123) 456-78-90") -> "71234567890"
 */
export const formatAndClearPhoneNumber = (phoneNumber: string): string =>
    phoneNumber?.replace(/\D/g, '')

/**
 * Преобразует дату рождения из формата ДДММГГГГ в ISO (YYYY-MM-DD)
 * @param {string} birthday - Дата в формате "ддммгггг" (например "17081990")
 * @returns {string} Дата в формате "YYYY-MM-DD" ("1990-08-17")
 *
 * Пример:
 * formatBirthday("17081990") -> "1990-08-17"
 */
export const formatBirthday = (birthday: string): string => {
    const date = String(birthday).replace(/\D+/g, '')
    const day = date.slice(0, 2)
    const month = date.slice(2, 4)
    const year = date.slice(4, 8)
    return `${year}-${month}-${day}`
}

/**
 * Форматирует номер телефона в российский стандартный вид
 * @param {string} phone - Номер телефона (11 цифр, начинается с 7 или 8)
 * @returns {string} Номер в формате "+7 (XXX) XXX-XX-XX" или исходная строка если невалидный ввод
 *
 * Пример:
 * formatPhoneNumber("79161234567") -> "+7 (916) 123-45-67"
 */
export const formatPhoneNumber = (phone: string): string => {
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length !== 11) return phone
    return `+7 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7, 9)}-${cleaned.slice(9, 11)}`
}

/**
 * Форматирует дату-время в русский локализованный формат
 * @param {string|null|undefined} dateTime - Дата в ISO формате или null/undefined
 * @returns {string} Дата в формате "дд.мм.гггг, чч:мм" или пустая строка для невалидного ввода
 *
 * Пример:
 * formatDateTime("2025-06-14T11:25:26Z") -> "14.06.2025, 14:25"
 */
export const formatDateTime = (dateTime: string | null | undefined): string => {
    if (!dateTime) return ''
    // Если приходит невалидная строка - будет пусто
    const date = new Date(dateTime as string)
    if (isNaN(date.getTime())) return ''
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Конвертирует дату в формат API (YYYY-MM-DD)
 * @param {Date|string|null} [date] - Дата для конвертации (может быть Date, строкой ISO или null/undefined)
 * @returns {string|null} Дата в формате "YYYY-MM-DD" или null для невалидного ввода
 *
 * Примеры:
 * toApiDate(new Date(2025, 5, 14)) -> "2025-06-14"
 * toApiDate("2025-06-14T11:25:26Z") -> "2025-06-14"
 * toApiDate(null) -> null
 */
export function toApiDate(date?: Date | string | null): string | null {
    if (!date) return null
    const d = new Date(date)
    if (isNaN(d.getTime())) return null

    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')

    return `${year}-${month}-${day}`
}

/**
 * Форматирует дату мероприятия в кратком формате
 * @param {string|object|null|undefined} dateTime - Дата в ISO формате или объект с _custom.value
 * @returns {string} Дата в формате "14 авг, 10:00" или пустая строка
 *
 * Примеры:
 * formatResponsibilityDate("2025-08-14T10:00:00Z") -> "14 авг, 10:00"
 * formatResponsibilityDate({_custom: {value: "2025-08-14T10:00:00Z"}}) -> "14 авг, 10:00"
 */
export const formatResponsibilityDate = (dateTime: string | {_custom?: {value: string}} | null | undefined): string => {
    // Извлекаем строку даты
    let dateString: string | null = null;

    if (typeof dateTime === 'object' && dateTime && '_custom' in dateTime && dateTime._custom?.value) {
        dateString = dateTime._custom.value;
    } else if (typeof dateTime === 'string') {
        dateString = dateTime;
    }

    if (!dateString) return '';

    // Создаем Date объект с явным приведением типов
    const date = new Date(dateString as string);
    if (isNaN(date.getTime())) return '';

    const day = date.getDate();
    const month = date.toLocaleString('ru-RU', { month: 'short' }).replace('.', '');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${day} ${month}, ${hours}:${minutes}`;
};


/**
 * Форматирует ФИО в сокращенный вид "Фамилия И.О."
 * @param {Object} employee - Объект с данными сотрудника
 * @param {string} [employee.last_name] - Фамилия
 * @param {string} [employee.first_name] - Имя
 * @param {string} [employee.middle_name] - Отчество
 * @returns {string} Формат "Фамилия И.О." или "Фамилия И." если нет отчества
 *
 * Примеры:
 * formatShortName({last_name: "Иванов", first_name: "Иван", middle_name: "Иванович"})
 * -> "Иванов И.И."
 * formatShortName({last_name: "Петров", first_name: "Петр"})
 * -> "Петров П."
 */
export const formatShortName = (employee: {
    last_name?: string
    first_name?: string
    middle_name?: string
}): string => {
    const lastName = employee.last_name || ''
    const firstNameInitial = employee.first_name ? `${employee.first_name[0]}.` : ''
    const middleNameInitial = employee.middle_name ? `${employee.middle_name[0]}.` : ''

    return `${lastName} ${firstNameInitial}${middleNameInitial}`.trim()
}


/**
 * Форматирует дату в формате "дд.мм.гггг" (без времени)
 * @param {string|Date|null} date - Дата в ISO или Date
 * @returns {string} "15.03.1967" или пустая строка
 */
export const formatDateOnly = (date: string | Date | null): string => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('ru-RU');
};

/**
 * Утилиты для работы с путями и навигацией в документах
 * 
 * Основные функции:
 * - Конвертация между URL и путями
 * - Работа с массивами путей
 * - Навигационная логика
 */

/**
 * Преобразует ID папки в URL параметр
 * @param folderId - ID папки
 * @returns URL параметр
 */
export const folderIdToUrl = (folderId: string | null): string => {
    return folderId || ''
}

/**
 * Преобразует URL параметр в ID папки
 * @param urlParam - URL параметр
 * @returns ID папки или null
 */
export const urlToFolderId = (urlParam: string): string | null => {
    if (!urlParam || urlParam === '') return null
    return urlParam
}

/**
 * Преобразует путь в URL параметр
 * @param path - путь к папке
 * @returns URL параметр
 */
export const pathToUrl = (path: string): string => {
    if (path === '/') {
        return ''
    }
    return path.startsWith('/') ? path.slice(1) : path
}

/**
 * Преобразует URL параметр в путь
 * @param urlParam - URL параметр (может быть строкой или массивом)
 * @returns путь к папке
 */
export const urlToPath = (urlParam: string | string[]): string => {
    if (!urlParam || urlParam === '' || (Array.isArray(urlParam) && urlParam.length === 0))
        return '/'

    if (Array.isArray(urlParam)) {
        const filteredParam = urlParam.filter(Boolean)
        return filteredParam.length > 0 ? filteredParam.join('/') : '/'
    }

    return urlParam === '/' ? '/' : urlParam
}

/**
 * Преобразует путь в массив сегментов
 * @param path - путь к папке
 * @returns массив сегментов пути
 */
export const pathToArray = (path: string): string[] => {
    if (path === '/' || !path) return []
    const cleanPath = path.startsWith('/') ? path.slice(1) : path

    // Разделяем по слешам, но учитываем, что в названиях папок могут быть слеши
    // Проверяем, если это API ответ с составным путем
    const segments = cleanPath.split('/')

    // Фильтруем пустые сегменты
    return segments.filter(Boolean)
}

/**
 * Преобразует массив сегментов в путь
 * @param pathArray - массив сегментов пути
 * @returns путь к папке
 */
export const arrayToPath = (pathArray: string[]): string => {
    if (!pathArray || pathArray.length === 0) return '/'
    return pathArray.join('/')
}

/**
 * Получает родительский путь
 * @param currentPath - текущий путь
 * @returns родительский путь
 */
export const getParentPath = (currentPath: string): string => {
    if (currentPath === '/' || !currentPath) {
        return '/'
    }

    let parentPath = currentPath.slice(0, -4)

    if (!parentPath) {
        parentPath = '/'
    }

    return parentPath
}
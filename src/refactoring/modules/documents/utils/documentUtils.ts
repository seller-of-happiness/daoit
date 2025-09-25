/**
 * Утилиты для работы с документами
 * 
 * Основные функции:
 * - Форматирование размера файлов
 * - Форматирование дат
 * - Получение иконок для файлов
 * - Определение типов файлов
 */

import type { IDocumentItem, IDocument, IDocumentFolder } from '@/refactoring/modules/documents/types/IDocument'

/**
 * Форматирует размер файла в человекочитаемый формат
 * @param bytes - размер в байтах
 * @returns отформатированная строка размера
 */
export const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return '—'

    const units = ['Б', 'КБ', 'МБ', 'ГБ']
    let size = bytes
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024
        unitIndex++
    }

    return `${Math.round(size * 10) / 10} ${units[unitIndex]}`
}

/**
 * Форматирует дату в локализованный формат
 * @param dateString - строка даты в ISO формате
 * @returns отформатированная дата или заглушка
 */
export const formatDate = (dateString: string | null): string => {
    if (!dateString) return '—'

    try {
        return new Date(dateString).toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        })
    } catch {
        return dateString
    }
}

/**
 * Получает иконку для документа или папки на основе расширения
 * @param item - элемент документа
 * @returns CSS класс иконки
 */
export const getDocumentIcon = (item: IDocumentItem): string => {
    if (item.is_dir) {
        return 'pi pi-folder'
    }

    const ext = item.extension?.toLowerCase() || ''
    switch (ext) {
        case 'pdf':
            return 'pi pi-file-pdf'
        case 'doc':
        case 'docx':
            return 'pi pi-file-word'
        case 'xls':
        case 'xlsx':
        case 'csv':
            return 'pi pi-file-excel'
        case 'jpg':
        case 'jpeg':
        case 'png':
        case 'gif':
        case 'webp':
        case 'svg':
            return 'pi pi-image'
        case 'zip':
        case 'rar':
        case '7z':
            return 'pi pi-box'
        case 'mp4':
        case 'mov':
        case 'avi':
        case 'mkv':
            return 'pi pi-video'
        case 'mp3':
        case 'wav':
        case 'ogg':
            return 'pi pi-volume-up'
        default:
            return 'pi pi-file'
    }
}

/**
 * Получает иконку файла по имени файла
 * @param filename - имя файла
 * @returns CSS класс иконки
 */
export const getFileIcon = (filename: string): string => {
    const ext = filename.toLowerCase().split('.').pop() || ''

    const iconMap: Record<string, string> = {
        pdf: 'pi pi-file-pdf',
        doc: 'pi pi-file-word',
        docx: 'pi pi-file-word',
        xls: 'pi pi-file-excel',
        xlsx: 'pi pi-file-excel',
        csv: 'pi pi-file-excel',
        jpg: 'pi pi-image',
        jpeg: 'pi pi-image',
        png: 'pi pi-image',
        gif: 'pi pi-image',
        webp: 'pi pi-image',
        svg: 'pi pi-image',
        zip: 'pi pi-box',
        rar: 'pi pi-box',
        '7z': 'pi pi-box',
        mp4: 'pi pi-video',
        mov: 'pi pi-video',
        avi: 'pi pi-video',
        mkv: 'pi pi-video',
        mp3: 'pi pi-volume-up',
        wav: 'pi pi-volume-up',
        ogg: 'pi pi-volume-up',
    }

    return iconMap[ext] || 'pi pi-file'
}

/**
 * Получает тип файла по расширению
 * @param extension - расширение файла
 * @returns человекочитаемое название типа файла
 */
export const getFileTypeByExtension = (extension: string): string => {
    const ext = extension.toLowerCase()
    const typeMap: Record<string, string> = {
        pdf: 'PDF документ',
        doc: 'Word документ',
        docx: 'Word документ',
        xls: 'Excel таблица',
        xlsx: 'Excel таблица',
        csv: 'CSV файл',
        txt: 'Текстовый файл',
        jpg: 'Изображение',
        jpeg: 'Изображение',
        png: 'Изображение',
        gif: 'Изображение',
        zip: 'Архив',
        rar: 'Архив',
        '7z': 'Архив',
    }
    return typeMap[ext] || 'Файл'
}

/**
 * Получает метку видимости документа
 * @param visibility - уровень видимости
 * @returns человекочитаемая метка
 */
export const getVisibilityLabel = (visibility?: string): string => {
    const visibilityMap: Record<string, string> = {
        creator: 'Только создатель',
        public: 'Публичный',
        private: 'Приватный',
        department: 'Отдел',
    }
    return visibilityMap[visibility || ''] || visibility || '—'
}

/**
 * Получает имя автора документа в унифицированном формате
 * @param createdBy - информация об авторе (строка или объект)
 * @returns отформатированное имя автора
 */
export const getCreatorName = (createdBy: string | { id: string; first_name: string; last_name: string } | undefined): string => {
    if (!createdBy) return '—'
    
    if (typeof createdBy === 'string') {
        return createdBy
    }
    
    if (typeof createdBy === 'object' && createdBy.first_name && createdBy.last_name) {
        return `${createdBy.first_name} ${createdBy.last_name}`
    }
    
    return '—'
}

/**
 * Получает ID автора документа
 * @param createdBy - информация об авторе (строка или объект)
 * @returns ID автора
 */
export const getCreatorId = (createdBy: string | { id: string; first_name: string; last_name: string } | undefined): string | null => {
    if (!createdBy) return null
    
    if (typeof createdBy === 'string') {
        return createdBy
    }
    
    if (typeof createdBy === 'object' && createdBy.id) {
        return createdBy.id
    }
    
    return null
}
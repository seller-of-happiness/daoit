/**
 * Composable для работы с загрузкой файлов
 * 
 * Предоставляет общую логику для:
 * - Выбора файлов
 * - Валидации файлов
 * - Отображения информации о файлах
 * - Очистки выбранных файлов
 */

import { ref, computed, type Ref } from 'vue'
import { formatFileSize, getFileIcon } from '@/refactoring/modules/documents/utils/documentUtils'

export interface FileUploadOptions {
    /** Максимальный размер файла в байтах */
    maxSize?: number
    /** Допустимые расширения файлов */
    allowedExtensions?: string[]
    /** Автоматически заполнять имя из имени файла */
    autoFillName?: boolean
    /** Поле для автозаполнения имени */
    nameField?: Ref<string>
}

export function useFileUpload(options: FileUploadOptions = {}) {
    const selectedFile = ref<File | null>(null)
    const fileUploadRef = ref<any>(null)

    const defaultOptions = {
        maxSize: 100 * 1024 * 1024, // 100MB
        allowedExtensions: [
            'pdf', 'doc', 'docx', 'txt', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg',
            'zip', 'rar', '7z', 'xls', 'xlsx', 'csv', 'mp4', 'mov', 'avi', 'mkv',
            'mp3', 'wav', 'ogg'
        ],
        autoFillName: false,
    }

    const config = { ...defaultOptions, ...options }

    /**
     * Информация о выбранном файле
     */
    const fileInfo = computed(() => {
        if (!selectedFile.value) return null

        return {
            name: selectedFile.value.name,
            size: selectedFile.value.size,
            formattedSize: formatFileSize(selectedFile.value.size),
            icon: getFileIcon(selectedFile.value.name),
            extension: selectedFile.value.name.toLowerCase().split('.').pop() || '',
        }
    })

    /**
     * Проверяет, выбран ли файл
     */
    const hasFile = computed(() => selectedFile.value !== null)

    /**
     * Валидирует размер файла
     */
    const validateFileSize = (file: File): boolean => {
        return file.size <= config.maxSize
    }

    /**
     * Валидирует расширение файла
     */
    const validateFileExtension = (file: File): boolean => {
        const extension = file.name.toLowerCase().split('.').pop() || ''
        return config.allowedExtensions.includes(extension)
    }

    /**
     * Валидирует файл
     */
    const validateFile = (file: File): { isValid: boolean; error?: string } => {
        if (!validateFileSize(file)) {
            return {
                isValid: false,
                error: `Размер файла не должен превышать ${Math.round(config.maxSize / (1024 * 1024))}МБ`
            }
        }

        if (!validateFileExtension(file)) {
            return {
                isValid: false,
                error: `Недопустимый тип файла. Разрешены: ${config.allowedExtensions.join(', ')}`
            }
        }

        return { isValid: true }
    }

    /**
     * Обработчик выбора файла
     */
    const onFileSelect = (event: any): { isValid: boolean; error?: string } => {
        const file = event.files[0]
        if (!file) {
            return { isValid: false, error: 'Файл не выбран' }
        }

        const validation = validateFile(file)
        if (!validation.isValid) {
            return validation
        }

        selectedFile.value = file

        // Автозаполнение имени если включено
        if (config.autoFillName && config.nameField) {
            if (!config.nameField.value.trim()) {
                const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '')
                config.nameField.value = nameWithoutExt
            }
        }

        return { isValid: true }
    }

    /**
     * Очищает выбранный файл
     */
    const clearFile = (): void => {
        selectedFile.value = null
        if (fileUploadRef.value) {
            fileUploadRef.value.clear()
        }
    }

    /**
     * Сбрасывает состояние загрузчика
     */
    const reset = (): void => {
        clearFile()
    }

    /**
     * Получает строку accept для input[type="file"]
     */
    const getAcceptString = (): string => {
        return config.allowedExtensions.map(ext => `.${ext}`).join(',')
    }

    /**
     * Получает максимальный размер в МБ
     */
    const getMaxSizeMB = (): number => {
        return Math.round(config.maxSize / (1024 * 1024))
    }

    return {
        // Состояние
        selectedFile: selectedFile as Ref<File | null>,
        fileUploadRef,
        
        // Вычисляемые свойства
        fileInfo,
        hasFile,
        
        // Методы
        onFileSelect,
        clearFile,
        reset,
        validateFile,
        validateFileSize,
        validateFileExtension,
        
        // Утилиты
        getAcceptString,
        getMaxSizeMB,
    }
}
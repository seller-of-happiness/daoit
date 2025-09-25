/**
 * Composable для валидации форм
 * 
 * Предоставляет общие правила валидации и утилиты
 * для работы с формами документов
 */

import { ref, computed, type Ref } from 'vue'

export interface ValidationRule {
    /** Функция валидации */
    validator: (value: any) => boolean
    /** Сообщение об ошибке */
    message: string
}

export interface ValidationRules {
    [fieldName: string]: ValidationRule[]
}

export interface ValidationErrors {
    [fieldName: string]: string
}

export function useFormValidation() {
    const errors = ref<ValidationErrors>({})

    /**
     * Правила валидации для общих полей
     */
    const commonRules = {
        required: (message: string = 'Поле обязательно для заполнения'): ValidationRule => ({
            validator: (value: any) => {
                if (typeof value === 'string') {
                    return value.trim().length > 0
                }
                return value !== null && value !== undefined
            },
            message,
        }),

        minLength: (min: number, message?: string): ValidationRule => ({
            validator: (value: string) => !value || value.trim().length >= min,
            message: message || `Минимальная длина ${min} символов`,
        }),

        maxLength: (max: number, message?: string): ValidationRule => ({
            validator: (value: string) => !value || value.trim().length <= max,
            message: message || `Максимальная длина ${max} символов`,
        }),

        fileRequired: (message: string = 'Выберите файл'): ValidationRule => ({
            validator: (file: File | null) => file !== null,
            message,
        }),

        fileSize: (maxSizeMB: number, message?: string): ValidationRule => ({
            validator: (file: File | null) => {
                if (!file) return true
                const maxSizeBytes = maxSizeMB * 1024 * 1024
                return file.size <= maxSizeBytes
            },
            message: message || `Размер файла не должен превышать ${maxSizeMB}МБ`,
        }),

        fileType: (allowedTypes: string[], message?: string): ValidationRule => ({
            validator: (file: File | null) => {
                if (!file) return true
                const extension = file.name.toLowerCase().split('.').pop() || ''
                return allowedTypes.includes(extension)
            },
            message: message || `Допустимые типы файлов: ${allowedTypes.join(', ')}`,
        }),
    }

    /**
     * Валидирует одно поле
     */
    const validateField = (fieldName: string, value: any, rules: ValidationRule[]): string => {
        for (const rule of rules) {
            if (!rule.validator(value)) {
                return rule.message
            }
        }
        return ''
    }

    /**
     * Валидирует все поля формы
     */
    const validateForm = (formData: Record<string, any>, rules: ValidationRules): boolean => {
        const newErrors: ValidationErrors = {}
        let isValid = true

        for (const [fieldName, fieldRules] of Object.entries(rules)) {
            const fieldValue = formData[fieldName]
            const error = validateField(fieldName, fieldValue, fieldRules)
            
            if (error) {
                newErrors[fieldName] = error
                isValid = false
            }
        }

        errors.value = newErrors
        return isValid
    }

    /**
     * Очищает ошибки валидации
     */
    const clearErrors = (): void => {
        errors.value = {}
    }

    /**
     * Очищает ошибку конкретного поля
     */
    const clearFieldError = (fieldName: string): void => {
        if (errors.value[fieldName]) {
            delete errors.value[fieldName]
        }
    }

    /**
     * Проверяет, есть ли ошибки в форме
     */
    const hasErrors = computed(() => Object.keys(errors.value).length > 0)

    /**
     * Получает ошибку для конкретного поля
     */
    const getFieldError = (fieldName: string): string => {
        return errors.value[fieldName] || ''
    }

    /**
     * Предустановленные наборы правил для документов
     */
    const documentRules = {
        /** Правила для создания документа */
        createDocument: {
            file: [commonRules.fileRequired()],
            name: [
                commonRules.required('Название документа обязательно'),
                commonRules.minLength(2, 'Название должно содержать минимум 2 символа'),
                commonRules.maxLength(200, 'Название не должно превышать 200 символов'),
            ],
            visibility: [commonRules.required('Выберите уровень видимости')],
        } as ValidationRules,

        /** Правила для создания папки */
        createFolder: {
            name: [
                commonRules.required('Название папки обязательно'),
                commonRules.minLength(2, 'Название должно содержать минимум 2 символа'),
                commonRules.maxLength(100, 'Название не должно превышать 100 символов'),
            ],
            visibility: [commonRules.required('Выберите уровень видимости')],
        } as ValidationRules,

        /** Правила для добавления версии */
        addVersion: {
            file: [commonRules.fileRequired('Выберите файл для новой версии')],
        } as ValidationRules,
    }

    return {
        errors: errors as Ref<ValidationErrors>,
        commonRules,
        documentRules,
        validateField,
        validateForm,
        clearErrors,
        clearFieldError,
        hasErrors,
        getFieldError,
    }
}
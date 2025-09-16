/**
 * Composable для централизованной обработки ошибок
 * 
 * Предоставляет единообразный способ обработки ошибок
 * с логированием и показом уведомлений пользователю
 */

import { useFeedbackStore } from '@/refactoring/modules/feedback/stores/feedbackStore'
import { logger } from '@/refactoring/utils/eventLogger'

export interface ErrorHandlerOptions {
    /** Контекст ошибки (имя файла) */
    context: string
    /** Имя функции где произошла ошибка */
    functionName: string
    /** Заголовок для toast уведомления */
    toastTitle: string
    /** Сообщение для toast уведомления */
    toastMessage: string
    /** Время показа toast (по умолчанию 5000ms) */
    toastTime?: number
    /** Дополнительные данные для логирования */
    additionalData?: Record<string, any>
}

export function useErrorHandler() {
    const feedbackStore = useFeedbackStore()

    /**
     * Обрабатывает ошибку с логированием и показом уведомления
     */
    const handleError = (error: any, options: ErrorHandlerOptions): void => {
        // Логируем ошибку
        logger.error(`${options.context}_${options.functionName}_error`, {
            file: options.context,
            function: options.functionName,
            condition: String(error),
            ...options.additionalData,
        })

        // Показываем уведомление пользователю
        feedbackStore.showToast({
            type: 'error',
            title: options.toastTitle,
            message: options.toastMessage,
            time: options.toastTime || 5000,
        })
    }

    /**
     * Показывает успешное уведомление
     */
    const showSuccess = (title: string, message: string, time: number = 3000): void => {
        feedbackStore.showToast({
            type: 'success',
            title,
            message,
            time,
        })
    }

    /**
     * Обертка для async операций с обработкой ошибок
     */
    const withErrorHandler = async <T>(
        operation: () => Promise<T>,
        options: ErrorHandlerOptions
    ): Promise<T | null> => {
        try {
            return await operation()
        } catch (error) {
            handleError(error, options)
            return null
        }
    }

    return {
        handleError,
        showSuccess,
        withErrorHandler,
    }
}
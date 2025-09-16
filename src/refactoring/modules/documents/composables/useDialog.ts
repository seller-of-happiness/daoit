/**
 * Composable для управления диалогами
 * 
 * Предоставляет общую логику для:
 * - Управления видимостью диалогов
 * - Сброса состояния при закрытии
 * - Обработки событий диалогов
 */

import { ref, computed, watch, type Ref } from 'vue'

export interface DialogOptions {
    /** Автоматически сбрасывать состояние при закрытии */
    autoReset?: boolean
    /** Callback при открытии диалога */
    onOpen?: () => void
    /** Callback при закрытии диалога */
    onClose?: () => void
    /** Callback для сброса состояния */
    onReset?: () => void
}

export function useDialog(options: DialogOptions = {}) {
    const visible = ref(false)
    const isLoading = ref(false)

    const defaultOptions = {
        autoReset: true,
    }

    const config = { ...defaultOptions, ...options }

    /**
     * Открывает диалог
     */
    const open = (): void => {
        visible.value = true
        config.onOpen?.()
    }

    /**
     * Закрывает диалог
     */
    const close = (): void => {
        visible.value = false
        config.onClose?.()
    }

    /**
     * Переключает видимость диалога
     */
    const toggle = (): void => {
        if (visible.value) {
            close()
        } else {
            open()
        }
    }

    /**
     * Сбрасывает состояние диалога
     */
    const reset = (): void => {
        isLoading.value = false
        config.onReset?.()
    }

    /**
     * Устанавливает состояние загрузки
     */
    const setLoading = (loading: boolean): void => {
        isLoading.value = loading
    }

    /**
     * Выполняет операцию с индикатором загрузки
     */
    const withLoading = async <T>(operation: () => Promise<T>): Promise<T | null> => {
        try {
            setLoading(true)
            const result = await operation()
            return result
        } catch (error) {
            throw error
        } finally {
            setLoading(false)
        }
    }

    /**
     * Создает computed свойство для v-model
     */
    const createVModel = (emit: (event: 'update:visible', value: boolean) => void) => {
        return computed({
            get: () => visible.value,
            set: (value: boolean) => {
                visible.value = value
                emit('update:visible', value)
            }
        })
    }

    // Автоматический сброс при закрытии
    if (config.autoReset) {
        watch(visible, (newVisible, oldVisible) => {
            if (oldVisible && !newVisible) {
                // Небольшая задержка для завершения анимации закрытия
                setTimeout(() => {
                    reset()
                }, 100)
            }
        })
    }

    return {
        // Состояние
        visible: visible as Ref<boolean>,
        isLoading: isLoading as Ref<boolean>,
        
        // Методы
        open,
        close,
        toggle,
        reset,
        setLoading,
        withLoading,
        createVModel,
    }
}

/**
 * Composable для управления несколькими диалогами
 */
export function useMultipleDialogs<T extends Record<string, DialogOptions>>(
    dialogs: T
): Record<keyof T, ReturnType<typeof useDialog>> {
    const result = {} as Record<keyof T, ReturnType<typeof useDialog>>

    for (const [key, options] of Object.entries(dialogs) as [keyof T, DialogOptions][]) {
        result[key] = useDialog(options)
    }

    return result
}
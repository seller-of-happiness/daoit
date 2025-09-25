import type { IToastType } from '@/refactoring/modules/feedback/types/IToastType'

/**
 * Состояние feedbackStore.
 */
export interface IFeedbackStoreState {
    // глобальный индикатор загрузки (например, при переходах между страницами)
    isGlobalLoading: boolean
    // индикатор загрузки данных (списки, детали и т.д.)
    toastTrigger: number
    // параметры текущего тоаста
    toast: {
        severity: IToastType
        summary: string
        detail: string
        life: number
    }
    // флаг показа модалки подтверждения удаления
    deletePopup: boolean
    // флаг показа формы создания/редактирования
    createOrUpdatePopup: boolean
    // индикатор загрузки при получении элемента по ID
    loadingOnGetItem: boolean
    // индикатор загрузки при подтверждении (создание/обновление/удаление)
    loadingOnConfirmModal: boolean
    // ошибки валидации от API, ключ — имя поля, значение — массив сообщений
    serverErrors: Record<string, string[]>
}

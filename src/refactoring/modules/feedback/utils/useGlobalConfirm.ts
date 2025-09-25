import { useConfirm } from 'primevue/useconfirm'

/**
 * Хук для глобальных диалогов подтверждения
 *
 * Оборачивает PrimeVue confirm в Promise-интерфейс:
 * - Резолвится при подтверждении действия
 * - Реджектится при отмене
 * - Имеет разумные значения по умолчанию
 *
 * Пример использования:
 * try {
 *   await useGlobalConfirm()({
 *     message: 'Удалить запись?',
 *     acceptLabel: 'Удалить'
 *   })
 *   // Действие при подтверждении
 * } catch {
 *   // Действие при отмене
 * }
 */

export function useGlobalConfirm() {
    const confirm = useConfirm()
    return async (options: {
        message: string
        header?: string
        icon?: string
        acceptLabel?: string
        rejectLabel?: string
        acceptClass?: string
        rejectClass?: string
    }): Promise<void> => {
        return new Promise((resolve, reject) => {
            confirm.require({
                message: options.message,
                header: options.header ?? 'Подтверждение действия',
                icon: options.icon ?? 'pi pi-info-circle',
                acceptLabel: options.acceptLabel ?? 'Продолжить',
                rejectLabel: options.rejectLabel ?? 'Отмена',
                acceptClass: options.acceptClass ?? 'p-button-danger',
                rejectClass: options.rejectClass ?? 'p-button-secondary p-button-outlined',
                accept: () => resolve(),
                reject: () => reject(),
                onHide: () => {},
            })
        })
    }
}

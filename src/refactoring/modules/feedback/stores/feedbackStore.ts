import { defineStore } from 'pinia'

import router from '@/router'
import type { IFeedbackStoreState } from '@/refactoring/modules/feedback/types/IFeedbackStoreState'
import type { IToastType } from '@/refactoring/modules/feedback/types/IToastType'


export const useFeedbackStore = defineStore('feedbackStore', {
    state: (): IFeedbackStoreState => ({
        isGlobalLoading: false,
        isDataLoading: false,
        toastTrigger: 1,
        toast: {
            severity: 'warn',
            summary: '',
            detail: '',
            life: 3000
        },
        deletePopup: false,
        createOrUpdatePopup: false,
        loadingOnGetItem: false,
        loadingOnConfirmModal: false,
        serverErrors: {},
        _loadingTimeout: null as ReturnType<typeof setTimeout> | null,
        _showLoader: false
    }),
    getters: {
        /**
         * Геттер для показа лоадера с учетом задержки
         * Возвращает true только если прошло достаточно времени с момента начала загрузки
         */
        shouldShowLoader: (state: IFeedbackStoreState): boolean => {
            return state.isGlobalLoading && state._showLoader
        }
    },
    actions: {
        /**
         * Отображает всплывающее уведомление (toast) в интерфейсе
         *
         * Параметры:
         * @param type - Тип уведомления (success, info, warn, error)
         * @param title - Заголовок уведомления
         * @param message - Основной текст сообщения
         * @param time - Время отображения в миллисекундах (по умолчанию 3000мс)
         *
         * Особенности:
         * - Управляет состоянием через увеличение счетчика toastTrigger
         * - Поддерживает стандартные типы уведомлений PrimeVue
         * - Позволяет гибко настраивать время отображения
         *
         * Используется для информирования пользователя о результатах операций
         */
        showToast({
                      type,
                      title,
                      message,
                      time
                  }: {
            type: IToastType
            title: string
            message: string
            time?: number
        }) {
            this.toast.severity = type
            this.toast.summary = title
            this.toast.detail = message
            this.toast.life = time || 3000
            this.toastTrigger += 1
        },

        /**
         * Основное действие:
         * - Устанавливает флаг createOrUpdatePopup в true
         * - Открывает модальное окно формы создания
         *
         * Особенности:
         * - Не принимает параметров
         * - Не выполняет сброса данных формы
         */
        showPopup() {
            // Открываем форму создания/редактирования
            this.createOrUpdatePopup = true
        },

        /**
         * Переход на родительский маршрут текущей страницы
         *
         * Логика работы:
         * - Определяет родительский маршрут из текущей цепочки маршрутизации
         * - Выполняет переход на родительский маршрут, если он существует
         *
         * Особенности:
         * - Использует текущий маршрут из router.currentRoute
         * - Находит предпоследний элемент в matched-цепочке как родительский
         * - Возвращает результат router.push (Promise)
         *
         * Применение:
         * - Закрытие модальных окон/форм
         * - Возврат к предыдущему уровню навигации
         * - Обработка отмены действий пользователем
         */
        goToParentRoute() {
            const matched = router.currentRoute.value.matched
            const parentName = matched[matched.length - 2]?.name as string | undefined
            if (parentName) {
                return router.push({ name: parentName })
            }
        },

        /**
         * Устанавливает глобальный лоадер с задержкой
         * Лоадер появляется только если загрузка длится дольше 300мс
         * 
         * @param value - true для включения, false для выключения
         */
        setGlobalLoading(value: boolean) {
            if (value) {
                // Включаем загрузку
                this.isGlobalLoading = true
                
                // Очищаем предыдущий таймер если есть
                if (this._loadingTimeout) {
                    clearTimeout(this._loadingTimeout)
                }
                
                // Устанавливаем таймер на показ лоадера с задержкой 300мс
                this._loadingTimeout = setTimeout(() => {
                    this._showLoader = true
                }, 300)
            } else {
                // Выключаем загрузку
                this.isGlobalLoading = false
                this._showLoader = false
                
                // Очищаем таймер
                if (this._loadingTimeout) {
                    clearTimeout(this._loadingTimeout)
                    this._loadingTimeout = null
                }
            }
        }
    }
})

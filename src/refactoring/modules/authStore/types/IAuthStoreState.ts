import { IPendingRequest } from '@/refactoring/modules/authStore/types/IPendingRequest'

export interface IAuthStoreState {
    authToken: string | null                 // Токен авторизации, хранится в куке
    authTokenExpiry: Date | null            // Время истечения токена
    isAuthenticated: boolean                 // Флаг, указывающий, авторизован ли пользователь
    centrifugeToken: string | null          // Токен Centrifugo для realtime событий
    centrifugeTokenExpiry: Date | null    // Время истечения токена
    centrifugeUrl: string | null            // ссылка центрифуго
    isLogin: boolean                       // Флаг отображения формы входа (true) или восстановления пароля (false)
    isResetPassword: boolean                // Флаг, указывающий, что активна форма восстановления пароля
    messageToUser: string                   // Сообщение для пользователя (например, об успешной отправке кода)
    restoreTelegramCode: string             // Телеграм-код восстановления
    showPinUnlock: boolean                   // Отображение формы разблокировки по PIN
    pendingRequests: IPendingRequest[]       // Массив для хранения запросов которые не были отправлены из-за необходимости ввести PIN
    show2FA: boolean                        // Отображение доп поля ввода кода 2FA из телеграм бота
}

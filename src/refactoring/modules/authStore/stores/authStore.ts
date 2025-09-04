import axios, { AxiosError } from 'axios'
import { defineStore } from 'pinia'
import { useUserStore } from '@/refactoring/modules/user/stores/userStore'
import { useFeedbackStore } from '@/refactoring/modules/feedback/stores/feedbackStore'
import { deleteCookie, getCookie, getCookieDate, setCookie } from '@/refactoring/utils/cookies' // Импорты утилит для работы с куками
import { isTokenValid } from '@/refactoring/modules/authStore/utils/tokenValidation'
import { logger } from '@/refactoring/utils/eventLogger'
import { BASE_URL } from '@/refactoring/environment/environment' // Импорты переменных окружения

import type { IAuthStoreState } from '../types/IAuthStoreState'
import { useCentrifugeStore } from '@/refactoring/modules/centrifuge/stores/centrifugeStore'
import type { IUserType } from '@/refactoring/modules/user/types/IUserType'
import { ECookiesNames } from '@/refactoring/types/ECookiesNames'
import { ICustomAxiosRequestConfig } from '@/refactoring/types/ICustomAxiosRequestConfig'
import { IPendingRequest } from '@/refactoring/modules/authStore/types/IPendingRequest'

export const useAuthStore = defineStore('authStore', {
    state: (): IAuthStoreState => ({
        // Токен авторизации, хранится в куке
        authToken: getCookie(ECookiesNames.AUTH_TOKEN) || null,

        // Время истечения токена
        authTokenExpiry: getCookieDate(ECookiesNames.AUTH_TOKEN_EXPIRY),

        // Флаг, указывающий, авторизован ли пользователь
        isAuthenticated: false,

        // Centrifuge токен
        centrifugeToken: getCookie(ECookiesNames.CENTRIFUGE_TOKEN) || null,

        // Время истечения токена Centrifuge
        centrifugeTokenExpiry: getCookie(ECookiesNames.CENTRIFUGE_TOKEN_EXPIRY)
            ? new Date(getCookie(ECookiesNames.CENTRIFUGE_TOKEN_EXPIRY) as string)
            : null,

        // Ссылка centrifuge
        centrifugeUrl: null,

        // Флаг отображения формы входа (true) или восстановления пароля (false)
        isLogin: true,

        // Флаг, указывающий, что активна форма восстановления пароля
        isResetPassword: false,

        // Сообщение для пользователя (например, об успешной отправке кода)
        messageToUser: '',

        // Телеграм-код восстановления
        restoreTelegramCode: '',

        // Отображение формы разблокировки по PIN
        showPinUnlock: false,

        // Отображение доп поля ввода кода 2FA из телеграм бота
        show2FA: false,

        /**
         * Очередь запросов, которые были заблокированы из-за необходимости ввода PIN-кода
         * Хранит конфигурацию запросов и функции для их разрешения после разблокировки
         */
        pendingRequests: [],
    }),

    actions: {
        /**
         * Добавляет запрос в очередь ожидания разблокировки
         *
         * Выполняет:
         * - Сохраняет конфигурацию запроса и функции resolve/reject
         * - Обеспечивает ограничение на максимальное количество ожидающих запросов
         * - Логирует добавление запроса для отладки
         *
         * Особенности:
         * - Максимальная очередь - 10 запросов (для предотвращения утечек памяти)
         * - При переполнении очереди сразу отклоняет новые запросы
         * - Сохраняет все параметры оригинального запроса для точного повторения
         *
         * @param {IPendingRequest} request - Запрос для добавления в очередь
         */
        addPendingRequest(request: IPendingRequest): void {
            const MAX_PENDING_REQUESTS = 10

            if (this.pendingRequests.length >= MAX_PENDING_REQUESTS) {
                logger.error('addPendingRequest_limit_reached', {
                    file: 'authStore',
                    function: 'addPendingRequest',
                    condition: `⚠️ Достигнут лимит ожидающих запросов (${MAX_PENDING_REQUESTS})`,
                    pendingRequestsCount: this.pendingRequests.length
                })

                request.reject(new Error('Too many pending requests. Please try again later.'))
                return
            }

            this.pendingRequests.push(request)
        },

        /**
         * Повторяет все ожидающие запросы после успешной разблокировки
         *
         * Выполняет:
         * - Создает копию очереди и очищает оригинальную
         * - Для каждого запроса выполняет оригинальный axios-запрос
         * - Разрешает или отклоняет Promise оригинального запроса
         * - Добавляет таймаут для каждого запроса (30 сек)
         * - Логирует процесс повторения запросов
         *
         * Особенности:
         * - Гарантирует очистку очереди даже при ошибках
         * - Обеспечивает обработку запросов в порядке их поступления
         * - Защищает от бесконечного ожидания через таймауты
         */
        retryPendingRequests(): void {
            if (this.pendingRequests.length === 0) {
                return
            }

            const requestsToRetry = [...this.pendingRequests]
            this.pendingRequests = []

            requestsToRetry.forEach(({ config, resolve, reject }) => {
                const requestDescription = `${config.method?.toUpperCase()} ${config.url}`

                // Таймаут для запроса (30 секунд)
                const timeoutId = setTimeout(() => {
                    const error = new Error(`Request timeout after PIN unlock: ${requestDescription}`)
                    logger.error('retryPendingRequests_timeout', {
                        file: 'authStore',
                        function: 'retryPendingRequests',
                        condition: `⏱️ Таймаут запроса: ${requestDescription}`,
                        config
                    })
                    reject(error)
                }, 30000)

                axios(config)
                    .then(response => {
                        clearTimeout(timeoutId)
                        resolve(response)
                    })
                    .catch(error => {
                        clearTimeout(timeoutId)
                        logger.error('retryPendingRequests_error', {
                            file: 'authStore',
                            function: 'retryPendingRequests',
                            condition: `❌ Ошибка при повторении запроса: ${requestDescription}`,
                            error: error.message,
                            config
                        })
                        reject(error)
                    })
            })
        },

        /**
         * Очищает очередь ожидающих запросов с ошибкой
         *
         * Выполняет:
         * - Отклоняет все ожидающие запросы с указанной ошибкой
         * - Очищает очередь запросов
         * - Логирует процесс очистки
         *
         * Используется при:
         * - Выходе пользователя из системы
         * - Закрытии формы PIN без ввода кода
         * - Критических ошибках приложения
         */
        clearPendingRequests(): void {
            if (this.pendingRequests.length === 0) return


            this.pendingRequests.forEach(({ reject }) => {
                reject(new Error('Request cancelled due to session unlock'))
            })

            this.pendingRequests = []
        },

        /**
         * Выполняет аутентификацию пользователя
         *
         * Основной процесс:
         * - Отправляет учетные данные (email/password) на сервер
         * - При успешной аутентификации:
         *   - Сохраняет токены в cookies и хранилище
         *   - Инициализирует данные пользователя
         *   - Устанавливает флаг аутентификации
         * - При ошибке показывает соответствующее сообщение
         *
         * Особенности:
         * - Проверяет полную структуру ответа сервера
         * - Сохраняет три типа токенов (auth, centrifugo, expiry)
         * - Интегрируется с userStore для инициализации данных пользователя
         * - Обрабатывает различные форматы ошибок API
         * - Управляет глобальным состоянием загрузки
         *
         * Возвращает {Promise<boolean>} Результат аутентификации (true/false)
         * @throws {AxiosError} В случае ошибки сетевого запроса
         */
        async login(payload: { username: string; password: string }) {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true
            const { username, password } = payload

            try {
                const response = await axios.post(
                    `${BASE_URL}/api/account/login/`,
                    {
                        username,
                        password,
                    },
                    {
                        skipAuth: true, // важно: не пропускаем через auth-интерцептор
                    } as ICustomAxiosRequestConfig,
                )

                // Обработка 202 статуса (требуется 2FA)
                if (response.status === 202) {
                    this.show2FA = true
                    feedbackStore.isGlobalLoading = false
                    return false
                }

                console.log('Ответ Login', response)

                // Нормализация payload: сервер может вернуть { data: {...} } или просто { ... }
                const data = (response?.data?.data ?? response?.data) as any

                // Бэкенд может прислать:
                // 1) { token: string, expiry: string, user: {...} }
                // 2) { token: { token: string, expiry: string }, employee: {...}, centrifugo?: {...} }
                const tokenStr: string | null = data?.token?.token ?? data?.token ?? null
                const expiryStr: string | null = data?.token?.expiry ?? data?.expiry ?? null
                const userData: IUserType | null = data?.user ?? data?.employee ?? null

                // Проверка структуры ответа (centrifugo опционален)
                const hasToken = !!tokenStr
                const hasExpiry = !!expiryStr
                const hasUser = !!userData

                if (!hasToken || !hasExpiry || !hasUser) {
                    console.error('[Auth] Отсутствуют обязательные поля в ответе', { data })
                    feedbackStore.showToast({
                        type: 'error',
                        title: 'Ошибка',
                        message: 'Некорректный ответ сервера при авторизации',
                        time: 7000,
                    })
                    return false
                }

                // Сохраняем данные пользователя
                localStorage.setItem('user', JSON.stringify(userData))

                const token = tokenStr as string
                const authTokenExpiry = new Date(expiryStr as string)

                // Centrifugo может отсутствовать или быть пустым — это не критично
                const centrifugeToken =
                    data?.centrifugo?.token ?? data?.user?.centrifugo?.token ?? null
                const centrifugeTokenExpiry =
                    (data?.centrifugo?.expiry ?? data?.user?.centrifugo?.expiry)
                        ? new Date(
                              (data?.centrifugo?.expiry ??
                                  data?.user?.centrifugo?.expiry) as string,
                          )
                        : null
                const centrifugeUrl = data?.centrifugo?.url ?? data?.user?.centrifugo?.url ?? null

                this.authToken = token
                this.authTokenExpiry = authTokenExpiry
                this.centrifugeToken = centrifugeToken
                this.centrifugeTokenExpiry = centrifugeTokenExpiry
                this.centrifugeUrl = centrifugeUrl
                this.isAuthenticated = true

                // Устанавливаем куки
                if (this.authToken) {
                    setCookie({
                        name: ECookiesNames.AUTH_TOKEN,
                        value: this.authToken,
                        expires: this.authTokenExpiry,
                        path: '/',
                    })

                    setCookie({
                        name: ECookiesNames.AUTH_TOKEN_EXPIRY,
                        value: this.authTokenExpiry.toISOString(),
                        expires: this.authTokenExpiry,
                        path: '/',
                    })

                    if (this.centrifugeToken && this.centrifugeTokenExpiry) {
                        setCookie({
                            name: ECookiesNames.CENTRIFUGE_TOKEN,
                            value: this.centrifugeToken,
                            expires: this.centrifugeTokenExpiry, // корректный срок жизни для centrifugo
                            path: '/',
                        })

                        setCookie({
                            name: ECookiesNames.CENTRIFUGE_TOKEN_EXPIRY,
                            value: this.centrifugeTokenExpiry.toISOString(),
                            expires: this.centrifugeTokenExpiry,
                            path: '/',
                        })
                    } else {
                        // Если centrifugo не пришёл — пробуем подтянуть в фоне (без влияния на авторизацию)
                        this.refreshCentrifugeToken().catch((e) => {
                            console.warn(
                                '[Auth] Не удалось обновить токен Centrifugo после логина',
                                e,
                            )
                        })
                    }
                }

                // Инициализация пользователя
                const userStore = useUserStore()
                userStore.initializeUser({ user: userData as IUserType })

                // Автоподключение к Centrifugo при успешной авторизации
                try {
                    const centrifugeStore = useCentrifugeStore()
                    await  centrifugeStore.initCentrifuge()
                } catch (e) {
                    console.warn('[Auth] Инициализация Centrifugo не выполнена', e)
                }

                return true
            } catch (error) {
                logger.error('login_error', {
                    file: 'authStore',
                    function: 'login',
                    condition: `❌ Ошибка при входе: ${error}`,
                })

                if (error instanceof AxiosError) {
                    const message =
                        error?.response?.data?.errors?.[0]?.detail || 'Неизвестная ошибка'
                    feedbackStore.showToast({
                        type: 'error',
                        title: 'Ошибка',
                        message,
                        time: 7000,
                    })
                }

                return false
            } finally {
                feedbackStore.isGlobalLoading = false
            }
        },

        /**
         * Выполняет быстрый вход под любым аккаунтом (DEV режим)
         */
        async fastLogin(payload: { uuid: string }) {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true

            try {
                const response = await axios.post(
                    `${BASE_URL}/api/account/login/fast-login/`,
                    {
                        uuid: payload.uuid,
                    },
                    {
                        skipAuth: true,
                    } as ICustomAxiosRequestConfig,
                )

                console.log('Ответ Fast Login', response)

                // Нормализация payload
                const data = (response?.data?.data ?? response?.data) as any

                // Извлекаем данные аналогично обычному login
                const tokenStr: string | null = data?.token?.token ?? data?.token ?? null
                const expiryStr: string | null = data?.token?.expiry ?? data?.expiry ?? null
                const userData: IUserType | null = data?.user ?? data?.employee ?? null

                // Проверка структуры ответа
                const hasToken = !!tokenStr
                const hasExpiry = !!expiryStr
                const hasUser = !!userData

                if (!hasToken || !hasExpiry || !hasUser) {
                    console.error('[Auth] Отсутствуют обязательные поля в ответе fast-login', { data })
                    feedbackStore.showToast({
                        type: 'error',
                        title: 'Ошибка',
                        message: 'Некорректный ответ сервера при быстрой авторизации',
                        time: 7000,
                    })
                    return false
                }

                // Сохраняем данные пользователя
                localStorage.setItem('user', JSON.stringify(userData))

                const token = tokenStr as string
                const authTokenExpiry = new Date(expiryStr as string)

                // Centrifugo токены (опционально)
                const centrifugeToken = data?.centrifugo?.token ?? data?.user?.centrifugo?.token ?? null
                const centrifugeTokenExpiry = data?.centrifugo?.expiry
                    ? new Date(data?.centrifugo?.expiry as string)
                    : null
                const centrifugeUrl = data?.centrifugo?.url ?? data?.user?.centrifugo?.url ?? null

                this.authToken = token
                this.authTokenExpiry = authTokenExpiry
                this.centrifugeToken = centrifugeToken
                this.centrifugeTokenExpiry = centrifugeTokenExpiry
                this.centrifugeUrl = centrifugeUrl
                this.isAuthenticated = true

                // Устанавливаем куки
                if (this.authToken) {
                    setCookie({
                        name: ECookiesNames.AUTH_TOKEN,
                        value: this.authToken,
                        expires: this.authTokenExpiry,
                        path: '/',
                    })

                    setCookie({
                        name: ECookiesNames.AUTH_TOKEN_EXPIRY,
                        value: this.authTokenExpiry.toISOString(),
                        expires: this.authTokenExpiry,
                        path: '/',
                    })

                    if (this.centrifugeToken && this.centrifugeTokenExpiry) {
                        setCookie({
                            name: ECookiesNames.CENTRIFUGE_TOKEN,
                            value: this.centrifugeToken,
                            expires: this.centrifugeTokenExpiry,
                            path: '/',
                        })
                    }
                }

                // Инициализация пользователя
                const userStore = useUserStore()
                userStore.initializeUser({ user: userData as IUserType })

                // Автоподключение к Centrifugo
                try {
                    const centrifugeStore = useCentrifugeStore()
                    await centrifugeStore.initCentrifuge()
                } catch (e) {
                    console.warn('[Auth] Инициализация Centrifugo не выполнена', e)
                }

                return true

            } catch (error) {
                logger.error('fast_login_error', {
                    file: 'authStore',
                    function: 'fastLogin',
                    condition: `❌ Ошибка при быстром входе: ${error}`,
                })

                if (error instanceof AxiosError) {
                    const message = error?.response?.data?.errors?.[0]?.detail || 'Неизвестная ошибка'
                    feedbackStore.showToast({
                        type: 'error',
                        title: 'Ошибка',
                        message,
                        time: 7000,
                    })
                }

                return false
            } finally {
                feedbackStore.isGlobalLoading = false
            }
        },

        /**
         * Выполняет выход пользователя из системы
         *
         * Логика работы:
         * - Отправляет запрос на сервер для завершения сессии
         * - В любом случае (успех/ошибка) очищает локальные данные аутентификации
         * - Покажет уведомление об успешном выходе при статусе 204
         * - Обрабатывает случаи отсутствия токена (прямая очистка)
         *
         * Особенности:
         * - Гарантированно очищает данные авторизации даже при ошибке запроса
         * - Управляет глобальным состоянием загрузки
         * - Логирует процесс выхода для отладки
         *
         * Используется при явном выходе пользователя из системы
         */
        async logout(): Promise<void> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true

            try {
                // Очищаем ожидающие запросы перед выходом
                this.clearPendingRequests()

                if (!this.authToken) {
                    this.clearAuthData()
                    return
                }

                const response = await axios.post(`${BASE_URL}/api/account/logout/`)
                if (response.status === 204) {
                    feedbackStore.showToast({
                        type: 'success',
                        title: 'Выход',
                        message: 'Вы успешно разлогинены',
                        time: 7000,
                    })
                    this.clearAuthData()
                    localStorage.removeItem('user')
                    deleteCookie(ECookiesNames.AUTH_TOKEN)
                    deleteCookie(ECookiesNames.AUTH_TOKEN_EXPIRY)
                    deleteCookie(ECookiesNames.CENTRIFUGE_TOKEN)
                    deleteCookie(ECookiesNames.CENTRIFUGE_TOKEN_EXPIRY)
                }
            } catch (error) {
                logger.error('logout_error', {
                    file: 'authStore',
                    function: 'logout',
                    condition: `❌ Ошибка выхода: ${error}`,
                })
                this.clearAuthData()
            } finally {
                feedbackStore.isGlobalLoading = false
            }
        },


        /**
         * Восстанавливает состояние аутентификации при загрузке приложения
         *
         * Проверяет наличие валидных данных в cookies и localStorage:
         * - Проверяет наличие и срок действия токена
         * - Восстанавливает данные пользователя из localStorage
         * - Инициализирует хранилища при валидных данных
         * - Очищает данные при отсутствии/просрочке токена
         *
         * Особенности:
         * - Используется при старте приложения
         * - Проверяет срок действия токена через isTokenValid()
         * - Синхронизирует состояние между cookies и хранилищем
         * - Гарантирует очистку невалидных данных
         */
        async restoreAuth() {
            const userStore = useUserStore()
            const token = getCookie(ECookiesNames.AUTH_TOKEN)
            const authTokenExpiry = getCookieDate(ECookiesNames.AUTH_TOKEN_EXPIRY)
            const userJson = localStorage.getItem('user')

            if (token && authTokenExpiry && isTokenValid(authTokenExpiry) && userJson) {
                const user = JSON.parse(userJson)

                this.authToken = token
                this.authTokenExpiry = authTokenExpiry
                this.isAuthenticated = true

                if (user?.centrifugo) {
                    this.centrifugeToken = user.centrifugo.token
                    this.centrifugeTokenExpiry = new Date(user.centrifugo.expiry)
                    this.centrifugeUrl = user.centrifugo.url
                }

                if (!isTokenValid(this.centrifugeTokenExpiry)) {
                    try {
                        await this.refreshCentrifugeToken()
                    } catch (error) {
                        console.warn('[RESTORE AUTH] Ошибка обновления токена:', error)
                        // Не разлогиниваем пользователя — продолжаем без Centrifugo
                    }
                } else if (!this.centrifugeUrl) {
                    // Токен валиден, но URL не сохранён — подтянем его с бэка
                    try {
                        await this.refreshCentrifugeToken()
                    } catch (error) {
                        console.warn('[RESTORE AUTH] Не удалось получить URL Centrifugo:', error)
                    }
                } else {
                    console.log('[RESTORE AUTH] Токен Centrifugo валиден')
                }

                userStore.initializeUser({ user })
                console.log('[RESTORE AUTH] Пользователь успешно инициализирован')

                // Подключаем Centrifugo после восстановления сессии
                try {
                    const centrifugeStore = useCentrifugeStore()
                    await centrifugeStore.initCentrifuge()
                } catch (e) {
                    console.warn('[RESTORE AUTH] Не удалось инициализировать Centrifugo', e)
                }
            } else {
                this.clearAuthData()
                localStorage.removeItem('user')
            }
        },

        /**
         * Выполняет аутентификацию пользователя с 2FA кодом
         *
         * Процесс:
         * - Отправляет учетные данные (username, password) и код 2FA на сервер
         * - При успешной аутентификации:
         *   - Сохраняет токены в cookies и хранилище
         *   - Инициализирует данные пользователя
         *   - Устанавливает флаг аутентификации
         *   - Сбрасывает флаг show2FA
         * - При ошибке показывает соответствующее сообщение
         *
         * Возвращает {Promise<boolean>} Результат аутентификации (true/false)
         * @throws {AxiosError} В случае ошибки сетевого запроса
         */
        async loginWith2Fa(payload: { username: string; password: string; code: string }) {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true

            try {
                const response = await axios.post(
                    `${BASE_URL}/api/account/login/verify-2fa/`,
                    {
                        username: payload.username,
                        password: payload.password,
                        code: payload.code
                    },
                    {
                        skipAuth: true,
                    } as ICustomAxiosRequestConfig,
                )

                console.log('Ответ loginWith2Fa', response)

                // Аналогичная обработка ответа как в login
                const data = (response?.data?.data ?? response?.data) as any
                const tokenStr: string | null = data?.token?.token ?? data?.token ?? null
                const expiryStr: string | null = data?.token?.expiry ?? data?.expiry ?? null
                const userData: IUserType | null = data?.user ?? data?.employee ?? null

                if (!tokenStr || !expiryStr || !userData) {
                    console.error('[Auth] Отсутствуют обязательные поля в ответе', { data })
                    feedbackStore.showToast({
                        type: 'error',
                        title: 'Ошибка',
                        message: 'Некорректный ответ сервера при авторизации',
                        time: 7000,
                    })
                    return false
                }

                localStorage.setItem('user', JSON.stringify(userData))

                const token = tokenStr as string
                const authTokenExpiry = new Date(expiryStr as string)

                const centrifugeToken =
                    data?.centrifugo?.token ?? data?.user?.centrifugo?.token ?? null
                const centrifugeTokenExpiry =
                    (data?.centrifugo?.expiry ?? data?.user?.centrifugo?.expiry)
                        ? new Date(
                            (data?.centrifugo?.expiry ??
                                data?.user?.centrifugo?.expiry) as string,
                        )
                        : null
                const centrifugeUrl = data?.centrifugo?.url ?? data?.user?.centrifugo?.url ?? null

                this.authToken = token
                this.authTokenExpiry = authTokenExpiry
                this.centrifugeToken = centrifugeToken
                this.centrifugeTokenExpiry = centrifugeTokenExpiry
                this.centrifugeUrl = centrifugeUrl
                this.isAuthenticated = true
                this.show2FA = false // Сбрасываем флаг 2FA после успешной авторизации

                // Устанавливаем куки (аналогично login)
                if (this.authToken) {
                    setCookie({
                        name: ECookiesNames.AUTH_TOKEN,
                        value: this.authToken,
                        expires: this.authTokenExpiry,
                        path: '/',
                    })

                    setCookie({
                        name: ECookiesNames.AUTH_TOKEN_EXPIRY,
                        value: this.authTokenExpiry.toISOString(),
                        expires: this.authTokenExpiry,
                        path: '/',
                    })

                    if (this.centrifugeToken && this.centrifugeTokenExpiry) {
                        setCookie({
                            name: ECookiesNames.CENTRIFUGE_TOKEN,
                            value: this.centrifugeToken,
                            expires: this.centrifugeTokenExpiry,
                            path: '/',
                        })

                        setCookie({
                            name: ECookiesNames.CENTRIFUGE_TOKEN_EXPIRY,
                            value: this.centrifugeTokenExpiry.toISOString(),
                            expires: this.centrifugeTokenExpiry,
                            path: '/',
                        })
                    } else {
                        this.refreshCentrifugeToken().catch((e) => {
                            console.warn(
                                '[Auth] Не удалось обновить токен Centrifugo после логина',
                                e,
                            )
                        })
                    }
                }

                // Инициализация пользователя
                const userStore = useUserStore()
                userStore.initializeUser({ user: userData as IUserType })

                // Автоподключение к Centrifugo
                try {
                    const centrifugeStore = useCentrifugeStore()
                    await centrifugeStore.initCentrifuge()
                } catch (e) {
                    console.warn('[Auth] Инициализация Centrifugo не выполнена', e)
                }

                return true
            } catch (error) {
                logger.error('loginWith2Fa_error', {
                    file: 'authStore',
                    function: 'loginWith2Fa',
                    condition: `❌ Ошибка при входе с 2FA: ${error}`,
                })

                if (error instanceof AxiosError) {
                    const message =
                        error?.response?.data?.errors?.[0]?.detail || 'Неизвестная ошибка'
                    feedbackStore.showToast({
                        type: 'error',
                        title: 'Ошибка',
                        message,
                        time: 7000,
                    })
                }

                return false
            } finally {
                feedbackStore.isGlobalLoading = false
            }
        },

        /**
         * Очищает все данные аутентификации пользователя
         *
         * Выполняет:
         * - Удаление токенов из cookies
         * - Сброс состояния в хранилище (authToken, expiry, isAuthenticated)
         * - Очистку данных пользователя в userStore
         *
         * Особенности:
         * - Гарантированно приводит систему в неаутентифицированное состояние
         * - Используется при выходе и при обнаружении невалидной сессии
         * - Не требует подтверждения сервера (локальная очистка)
         */
        clearAuthData() {
            const userStore = useUserStore()
            deleteCookie(ECookiesNames.AUTH_TOKEN)
            deleteCookie(ECookiesNames.AUTH_TOKEN_EXPIRY)
            deleteCookie(ECookiesNames.CENTRIFUGE_TOKEN)
            deleteCookie(ECookiesNames.CENTRIFUGE_TOKEN_EXPIRY)
            this.authToken = null
            this.authTokenExpiry = null
            this.isAuthenticated = false
            this.centrifugeToken = null
            this.centrifugeUrl = null
            this.centrifugeTokenExpiry = null
            userStore.user = null
        },

        /**
         * Обновляет токен для подключения к Centrifugo
         *
         * Выполняет:
         * - Запрос нового токена и URL для Centrifugo
         * - Обновление данных в хранилище (токен, URL, срок действия)
         * - Обработку ошибок с автоматическим логаутом при неудаче
         *
         * Особенности:
         * - Управляет состоянием загрузки через feedbackStore
         * - При неполных данных ответа автоматически разлогинивает пользователя
         * - Подробное логирование ошибок (включая Axios-ошибки)
         * - Гарантированно снимает состояние загрузки в finally
         */
        async refreshCentrifugeToken() {
            console.groupCollapsed('[CENTRIFUGO] Начало обновления токена')
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true

            try {
                const response = await axios.post(`${BASE_URL}/api/centrifugo/refresh-token/`)
                const data = response?.data ?? {}

                // Разрешаем отсутствие url (часто он статичен). Главное — token + expiry
                const hasToken = !!data.token
                const hasExpiry = !!data.expiry
                const url = data.url ?? null

                if (hasToken && hasExpiry) {
                    const centrifugeToken = data.token as string
                    const centrifugeTokenExpiry = new Date(data.expiry as string)

                    this.centrifugeToken = centrifugeToken
                    this.centrifugeTokenExpiry = centrifugeTokenExpiry
                    this.centrifugeUrl = url

                    // Сохраняем куки для Centrifugo
                    setCookie({
                        name: ECookiesNames.CENTRIFUGE_TOKEN,
                        value: this.centrifugeToken,
                        expires: this.centrifugeTokenExpiry,
                        path: '/',
                    })
                    setCookie({
                        name: ECookiesNames.CENTRIFUGE_TOKEN_EXPIRY,
                        value: this.centrifugeTokenExpiry.toISOString(),
                        expires: this.centrifugeTokenExpiry,
                        path: '/',
                    })

                    console.log('[CENTRIFUGO] Токен обновлён')
                    return true
                }

                // 🔸 Неполные данные — НЕ логаутим пользователя. Чистим только центрифуговые данные.
                console.warn('[CENTRIFUGO] Неполные данные в ответе сервера', data)
                this.centrifugeToken = null
                this.centrifugeTokenExpiry = null
                this.centrifugeUrl = url
                deleteCookie(ECookiesNames.CENTRIFUGE_TOKEN)
                deleteCookie(ECookiesNames.CENTRIFUGE_TOKEN_EXPIRY)
                return false
            } catch (error: unknown) {
                if (axios.isAxiosError(error)) {
                    console.error('[CENTRIFUGO] Axios ошибка:', {
                        response: error.response?.data,
                        status: error.response?.status,
                    })
                } else {
                    console.error('[CENTRIFUGO] Неизвестная ошибка:', error)
                }

                // 🔸 Ошибка — тоже НЕ логаутим auth-сессию. Чистим только центрифуговые данные.
                this.centrifugeToken = null
                this.centrifugeTokenExpiry = null
                deleteCookie(ECookiesNames.CENTRIFUGE_TOKEN)
                deleteCookie(ECookiesNames.CENTRIFUGE_TOKEN_EXPIRY)
                return false
            } finally {
                feedbackStore.isGlobalLoading = false
                console.groupEnd()
            }
        },

        /**
         * Запрашивает код восстановления пароля
         *
         * Выполняет:
         * - Отправку username (СНИЛС/Телефон/Почта) для получения кода восстановления
         * - Обработку успешного ответа (сохранение данных телеграм-бота)
         * - Отображение пользователю информации о способе получения кода
         *
         * Особенности:
         * - Управляет состоянием загрузки через feedbackStore
         * - При ошибке показывает унифицированное сообщение
         * - Логирует ошибки для последующего анализа
         * - Возвращает boolean результат операции
         */
        async getRestoreCode(payload: { username: string }): Promise<boolean> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true

            try {
                const response = await axios.post(
                    `${BASE_URL}/api/account/password/reset/`,
                    payload,
                )

                if (response.status === 200) {
                    const botName = response.data.telegram_bot
                    const userPhone = response.data.phone_number
                    this.messageToUser = `Код отправлен в <a href="https://t.me/${botName}" target="_blank">телеграмм</a> по номеру ${userPhone}`
                    return true
                }
            } catch (error) {
                logger.error('getRestoreCode_error', {
                    file: 'authStore',
                    function: 'getRestoreCode',
                    condition: `❌ Ошибка при запросе: ${error}`,
                })
                feedbackStore.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: 'Произошла ошибка при выполнении запроса, пожалуйста попробуйте снова',
                    time: 7000,
                })
                return false
            } finally {
                feedbackStore.isGlobalLoading = false
            }
            feedbackStore.showToast({
                type: 'error',
                title: 'Ошибка',
                message: 'Произошла ошибка при выполнении запроса, пожалуйста попробуйте снова',
                time: 7000,
            })
            return false
        },

        /**
         * Проверяет код восстановления пароля
         *
         * Выполняет:
         * - Валидацию кода восстановления на сервере
         * - Обработку успешной и неуспешной проверки
         *
         * Особенности:
         * - Использует отдельный флаг загрузки (isDataLoading)
         * - При неверном коде показывает соответствующее сообщение
         * - Логирует ошибки с детализацией
         * - Возвращает boolean результат проверки
         */
        async checkResetCode(payload: { username: string; code: string }): Promise<boolean> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isDataLoading = true

            try {
                const response = await axios.post(`${BASE_URL}/api/account/reset-code/`, payload)

                if (response.status === 200) return true
            } catch (error) {
                logger.error('checkResetCode_error', {
                    file: 'authStore',
                    function: 'checkResetCode',
                    condition: `❌ Ошибка при запросе: ${error}`,
                })
                feedbackStore.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: 'Произошла ошибка при выполнении запроса, пожалуйста попробуйте снова',
                    time: 7000,
                })
                return false
            } finally {
                feedbackStore.isDataLoading = false
            }
            feedbackStore.showToast({
                type: 'error',
                title: 'Ошибка',
                message: 'Код не прошел проверку!',
                time: 7000,
            })
            return false
        },

        /**
         * Обновляет пароль пользователя
         *
         * Выполняет:
         * - Отправку нового пароля вместе с кодом подтверждения
         * - Обработку успешного изменения пароля
         * - Нотификацию пользователя о результате операции
         *
         * Особенности:
         * - Требует наличия валидного кода подтверждения
         * - Показывает разные сообщения при успехе/ошибке
         * - Логирует ошибки с пометкой setPassword
         * - Возвращает boolean результат операции
         */
        async updatePassword(payload: {
            username: string
            code: string
            password: string
        }): Promise<boolean> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true

            try {
                const response = await axios.post(`${BASE_URL}/api/account/set-password/`, payload)
                if (response.status === 200) {
                    feedbackStore.showToast({
                        type: 'success',
                        title: 'Успех!',
                        message: 'Установка нового пароля успешно произведена',
                        time: 7000,
                    })
                    return true
                }
            } catch (error) {
                logger.error('setPassword_error', {
                    file: 'authStore',
                    function: 'setPassword',
                    condition: `❌ Ошибка при попытке обновления пароля: ${error}`,
                })
                feedbackStore.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: 'Произошла ошибка при обновлении пароля, пожалуйста попробуйте снова',
                    time: 7000,
                })
                return false
            } finally {
                feedbackStore.isGlobalLoading = false
            }
            feedbackStore.showToast({
                type: 'error',
                title: 'Ошибка',
                message: 'Не удалось обновить пароль, пожалуйста попробуйте снова',
                time: 7000,
            })
            return false
        },

        /**
         * Активирует учетную запись пользователя
         *
         * Выполняет:
         * - Отправку персональных данных для активации
         * - Обработку успешной активации
         * - Автоматический переход к форме восстановления пароля
         *
         * Особенности:
         * - Требует полного набора персональных данных
         * - При успехе автоматически меняет состояние на isResetPassword
         * - Показывает контекстные сообщения об ошибках
         * - Логирует ошибки с пометкой activateAccount
         * - Возвращает boolean результат операции
         */
        async activateAccount(payload: {
            snils: string
            last_name: string
            first_name: string
            middle_name: string
            birth_date: string
            email: string
            phone_number: string
        }): Promise<boolean> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true
            try {
                const response = await axios.post(`${BASE_URL}/api/account/activation/`, payload)

                if (response.status === 200) {
                    feedbackStore.showToast({
                        type: 'success',
                        title: 'Успех!',
                        message: 'Активация аккаунта произведена успешно',
                        time: 7000,
                    })
                    this.isLogin = false
                    this.isResetPassword = true
                    return true
                }
            } catch (error) {
                logger.error('activateAccount_error', {
                    file: 'authStore',
                    function: 'activateAccount',
                    condition: `❌ Ошибка при попытке активации аккаунта: ${error}`,
                })
                feedbackStore.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message:
                        'Произошла ошибка при попытке активации аккаунта, пожалуйста попробуйте снова',
                    time: 7000,
                })
                return false
            } finally {
                feedbackStore.isGlobalLoading = false
            }
            feedbackStore.showToast({
                type: 'error',
                title: 'Ошибка',
                message: 'Не удалось активировать аккаунт, пожалуйста попробуйте снова',
                time: 7000,
            })
            return false
        },

        /**
         * Разблокировка приложения с помощью PIN-кода
         *
         * Отправляет введённый PIN на сервер для разблокировки
         *
         * Особенности:
         * - POST-запрос на /api/account/pin/unlock/
         * - Управление глобальным лоадером
         * - Обработка ошибок с логированием через EventLogger
         * - Возвращает boolean: успех или ошибка
         */
        async unlockWithPin(payload: { pin: string }): Promise<boolean> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true

            try {
                const response = await axios.post(`${BASE_URL}/api/account/pin/unlock/`, payload)

                if (response.status === 200) {
                    this.showPinUnlock = false
                    return true
                }
            } catch (error) {
                logger.error('unlockWithPin_error', {
                    file: 'authStore',
                    function: 'unlockWithPin',
                    condition: `❌ Ошибка при разблокировке PIN: ${error}`,
                })

                feedbackStore.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: 'Неверный PIN-код или ошибка сервера',
                    time: 7000,
                })
                return false
            } finally {
                feedbackStore.isGlobalLoading = false
            }

            return false
        },

        /**
         * Удаление PIN-кода по учетным данным
         *
         * Отправляет логин и пароль для сброса PIN-кода
         *
         * Особенности:
         * - POST-запрос на /api/account/pin/remove/
         * - Управление глобальным лоадером
         * - Обработка ошибок с логированием через EventLogger
         * - Возвращает boolean: успех или ошибка
         */
        async removePin(payload: { username: string; password: string }): Promise<boolean> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true

            try {
                const response = await axios.post(`${BASE_URL}/api/account/pin/remove/`, payload)

                if (response.status === 200) {
                    feedbackStore.showToast({
                        type: 'success',
                        title: 'Успех',
                        message: 'PIN-код успешно сброшен',
                        time: 5000,
                    })
                    return true
                }
            } catch (error) {
                logger.error('removePin_error', {
                    file: 'authStore',
                    function: 'removePin',
                    condition: `❌ Ошибка при сбросе PIN: ${error}`,
                })

                feedbackStore.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: 'Неверные учетные данные или ошибка сервера',
                    time: 7000,
                })
                return false
            } finally {
                feedbackStore.isGlobalLoading = false
            }

            return false
        },
    },
})

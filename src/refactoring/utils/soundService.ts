/**
 * Продвинутый сервис звуковых уведомлений (как в Bitrix24/Telegram)
 *
 * Особенности:
 * - Автоматическая активация при первом пользовательском взаимодействии
 * - Поддержка системных уведомлений через Service Worker
 * - Web Audio API как основной способ воспроизведения
 * - HTML5 Audio как fallback
 * - Умное управление состоянием AudioContext
 * - Сохранение настроек в localStorage
 * - Диагностика проблем с аудио
 */

interface SoundConfig {
    volume: number // 0.0 - 1.0
    enabled: boolean
    wasActivated: boolean // Был ли звук когда-либо активирован
    useSystemNotifications: boolean // Использовать системные уведомления
}

class SoundService {
    private sounds: Map<string, HTMLAudioElement> = new Map()
    private config: SoundConfig = {
        volume: 0.7,
        enabled: true,
        wasActivated: false,
        useSystemNotifications: false,
    }
    private isAudioUnlocked: boolean = false
    private pendingSounds: string[] = []
    private audioContext: AudioContext | null = null
    private audioBuffer: AudioBuffer | null = null
    private isActivating: boolean = false
    private serviceWorkerRegistration: ServiceWorkerRegistration | null = null

    constructor() {
        this.loadConfig()
        this.preloadSounds()
        this.initWebAudio()
        this.setupServiceWorker()
        this.setupAutoUnlock()

        // Если пользователь уже ранее дал разрешение на уведомления – включаем системные уведомления
        if (typeof window !== 'undefined' && 'Notification' in window) {
            if (Notification.permission === 'granted' && !this.config.useSystemNotifications) {
                this.config.useSystemNotifications = true
                this.saveConfig()
            }
        }
    }

    /**
     * Загружает конфигурацию из localStorage
     */
    private loadConfig(): void {
        try {
            const saved = localStorage.getItem('chat-sound-config')
            if (saved) {
                this.config = { ...this.config, ...JSON.parse(saved) }
            }
        } catch (error) {
            console.warn('Не удалось загрузить настройки звука:', error)
        }
    }

    /**
     * Сохраняет конфигурацию в localStorage
     */
    private saveConfig(): void {
        try {
            localStorage.setItem('chat-sound-config', JSON.stringify(this.config))
        } catch (error) {
            console.warn('Не удалось сохранить настройки звука:', error)
        }
    }

    /**
     * Предзагружает звуковые файлы
     */
    private preloadSounds(): void {
        const soundFiles = {
            'new-message': '/sounds/new-message.wav',
            // Можно добавить другие звуки в будущем
            // 'notification': '/sounds/notification.wav',
            // 'error': '/sounds/error.wav'
        }

        Object.entries(soundFiles).forEach(([key, path]) => {
            try {
                const audio = new Audio(path)
                audio.preload = 'auto'
                audio.volume = this.config.volume

                // Обработка ошибок загрузки
                audio.addEventListener('error', (e) => {
                    console.error(`❌ Не удалось загрузить звуковой файл: ${path}`, e)
                })

                this.sounds.set(key, audio)
            } catch (error) {
                console.error(`❌ Ошибка создания Audio объекта для ${key}:`, error)
            }
        })
    }

    /**
     * Настройка Service Worker для звуковых уведомлений (как в Битрикс24/Telegram)
     */
    private async setupServiceWorker(): Promise<void> {
        if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
            return
        }

        try {
            const registration = await navigator.serviceWorker.register('/sw.js', {
                scope: '/',
            })

            this.serviceWorkerRegistration = registration

            // Слушаем сообщения от Service Worker
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data?.type === 'SOUND_PLAYED') {
                    console.log('🔊 Звук воспроизведен через Service Worker')
                }
            })
        } catch (error) {
            console.warn('⚠️ Не удалось зарегистрировать Service Worker:', error)
        }
    }

    /**
     * Инициализирует Web Audio API для альтернативного воспроизведения
     */
    private async initWebAudio(): Promise<void> {
        try {
            if (typeof window === 'undefined' || !window.AudioContext) {
                return
            }

            this.audioContext = new AudioContext()

            // Загружаем аудио буфер
            try {
                const response = await fetch('/sounds/new-message.wav')
                const arrayBuffer = await response.arrayBuffer()
                this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer)
            } catch (error) {
                console.warn('⚠️ Не удалось загрузить аудио буфер:', error)
            }
        } catch (error) {
            console.warn('⚠️ Ошибка инициализации Web Audio API:', error)
        }
    }

    /**
     * Настраивает автоматическую разблокировку аудио
     */
    private setupAutoUnlock(): void {
        const unlockEvents = ['click', 'touchstart', 'keydown', 'mousedown']

        const unlockAudio = async () => {
            if (this.isAudioUnlocked) return

            const success = await this.attemptUnlock()
            if (success) {
                this.isAudioUnlocked = true
                this.playPendingSounds()

                // Удаляем слушатели после успешной активации
                unlockEvents.forEach((event) => {
                    document.removeEventListener(event, unlockAudio)
                })
            }
        }

        if (typeof document !== 'undefined') {
            unlockEvents.forEach((event) => {
                document.addEventListener(event, unlockAudio, { passive: true, once: false })
            })
        }
    }

    /**
     * Попытка разблокировки аудио
     */
    private async attemptUnlock(): Promise<boolean> {
        if (this.isAudioUnlocked) {
            return true
        }

        try {
            // Создаем тестовый звук
            const testAudio = new Audio()
            testAudio.volume = 0.01
            testAudio.muted = true

            // Пытаемся воспроизвести
            await testAudio.play()
            testAudio.pause()
            testAudio.currentTime = 0

            // Также пробуем активировать AudioContext
            if (this.audioContext && this.audioContext.state === 'suspended') {
                try {
                    await this.audioContext.resume()
                } catch (e) {
                    // Игнорируем ошибки AudioContext
                }
            }

            // Проверяем итоговое состояние AudioContext
            if (this.audioContext && this.audioContext.state === 'running') {
                this.isAudioUnlocked = true
                this.config.wasActivated = true
                this.saveConfig()
            }

            return true
        } catch (error) {
            return false
        }
    }

    /**
     * Воспроизводит отложенные звуки
     */
    private async playPendingSounds(): Promise<void> {
        if (this.pendingSounds.length === 0) return

        for (const soundKey of this.pendingSounds) {
            try {
                await this.playSound(soundKey)
            } catch (error) {
                console.warn(`Не удалось воспроизвести отложенный звук ${soundKey}:`, error)
            }
        }

        this.pendingSounds = []
    }

    /**
     * Запрашивает разрешение на уведомления для разблокировки аудио
     */
    async ensureNotifications(): Promise<boolean> {
        if (typeof window === 'undefined' || !('Notification' in window)) {
            return false
        }

        // Уже есть разрешение
        if (Notification.permission === 'granted') {
            if (!this.config.useSystemNotifications) {
                this.config.useSystemNotifications = true
                this.saveConfig()
            }
            return true
        }

        // Если пользователь ранее явно запретил — уважать запрет
        if (Notification.permission === 'denied') {
            return false
        }

        // default → запросим разрешение
        const perm = await Notification.requestPermission()
        if (perm === 'granted') {
            this.config.useSystemNotifications = true
            this.saveConfig()
            return true
        }

        return false
    }

    /**
     * Воспроизводит звук по ключу
     */
    async playSound(soundKey: string): Promise<void> {
        if (!this.config.enabled) {
            return
        }

        // Попытка через Web Audio API (наиболее надежный способ)
        if (this.audioContext && this.audioBuffer) {
            try {
                if (this.audioContext.state === 'suspended') {
                    await this.audioContext.resume()
                }

                if (this.audioContext.state === 'running') {
                    const webAudioOk = await this.playWithWebAudio(false)
                    if (webAudioOk) {
                        this.isAudioUnlocked = true
                        return
                    }
                }
            } catch (e) {
                // Fallback к HTML5 Audio
            }
        }

        // Fallback: HTML5 Audio (универсальный способ)
        const audio = this.sounds.get(soundKey)
        if (audio) {
            try {
                audio.currentTime = 0
                audio.volume = this.config.volume
                audio.muted = false

                await audio.play()
                this.isAudioUnlocked = true
                return
            } catch (e) {
                // Fallback к системным уведомлениям
            }
        }

        // Fallback: системные уведомления (если разрешены)
        if (this.config.useSystemNotifications && this.config.wasActivated) {
            const swOk = await this.playWithServiceWorker()
            if (swOk) {
                return
            }
        }

        // Если ничего не сработало, добавляем в очередь
        if (!this.pendingSounds.includes(soundKey)) {
            this.pendingSounds.push(soundKey)
        }
    }

    /**
     * Альтернативное воспроизведение через Web Audio API
     */
    private async playWithWebAudio(silent: boolean = false): Promise<boolean> {
        if (!this.audioContext || !this.audioBuffer) {
            return false
        }

        try {
            // Возобновляем контекст если он приостановлен
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume()
            }

            // Создаем источник звука
            const source = this.audioContext.createBufferSource()
            const gainNode = this.audioContext.createGain()

            source.buffer = this.audioBuffer
            gainNode.gain.value = silent ? 0.01 : this.config.volume

            // Соединяем: источник -> регулятор громкости -> выход
            source.connect(gainNode)
            gainNode.connect(this.audioContext.destination)

            // Воспроизводим
            source.start(0)

            return true
        } catch (error) {
            return false
        }
    }

    /**
     * Воспроизведение через Service Worker (как в Битрикс24/Telegram)
     */
    private async playWithServiceWorker(): Promise<boolean> {
        if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
            return false
        }

        // Показ системного уведомления со звуком
        try {
            if (this.serviceWorkerRegistration) {
                await this.serviceWorkerRegistration.showNotification('💬 Новое сообщение', {
                    icon: '/favicon.ico',
                    badge: '/favicon.ico',
                    silent: false,
                    tag: 'chat-message',
                    requireInteraction: false,
                })
                return true
            }
        } catch (e) {
            // Игнорируем ошибки
        }

        // Fallback через postMessage
        try {
            if (navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({
                    type: 'PLAY_SOUND',
                    sound: 'new-message',
                })
                return true
            }
        } catch (error) {
            // Игнорируем ошибки
        }

        return false
    }

    /**
     * Воспроизводит звук нового сообщения
     */
    async playNewMessageSound(): Promise<void> {
        await this.playSound('new-message')
    }

    /**
     * Включает/отключает звуковые уведомления
     */
    setEnabled(enabled: boolean): void {
        this.config.enabled = enabled
        this.saveConfig()
    }

    /**
     * Устанавливает громкость звуков
     */
    setVolume(volume: number): void {
        // Ограничиваем громкость от 0 до 1
        this.config.volume = Math.max(0, Math.min(1, volume))
        this.saveConfig()

        // Обновляем громкость для всех загруженных звуков
        this.sounds.forEach((audio) => {
            audio.volume = this.config.volume
        })
    }

    /**
     * Возвращает текущие настройки
     */
    getConfig(): SoundConfig {
        return { ...this.config }
    }

    /**
     * Проверяет, включены ли звуки
     */
    isEnabled(): boolean {
        return this.config.enabled
    }

    /**
     * Проверяет, был ли звук когда-либо активирован пользователем
     */
    wasEverActivated(): boolean {
        return this.config.wasActivated
    }

    /**
     * Проверяет, разблокирован ли звук (публичный метод)
     */
    get audioUnlocked(): boolean {
        return this.isAudioUnlocked
    }

    /**
     * Принудительная активация звука
     */
    async forceActivateImmediately(): Promise<boolean> {
        // Защита от повторных вызовов
        if (this.isActivating) {
            return false
        }

        if (this.isAudioUnlocked) {
            return true
        }

        this.isActivating = true

        try {
            // Принудительно возобновляем AudioContext
            if (this.audioContext && this.audioContext.state === 'suspended') {
                await this.audioContext.resume()
            }

            // Проверяем состояние после попытки возобновления
            if (this.audioContext && this.audioContext.state === 'running') {
                this.isAudioUnlocked = true
                this.config.wasActivated = true
                this.saveConfig()

                // Тестируем звук (тихо, чтобы не мешать)
                try {
                    await this.playWithWebAudio(true) // Тихий тест
                } catch (error) {
                    // Игнорируем ошибки тестового звука
                }

                return true
            } else {
                return false
            }
        } catch (error) {
            return false
        } finally {
            this.isActivating = false
        }
    }
}

// Создаем единственный экземпляр сервиса
export const soundService = new SoundService()

// Делаем сервис доступным глобально для отладки
if (typeof window !== 'undefined') {
    ;(window as any).soundService = soundService
    ;(window as any).testSound = () => soundService.playNewMessageSound()
}

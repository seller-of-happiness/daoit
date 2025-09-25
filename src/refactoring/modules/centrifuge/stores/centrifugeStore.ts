import { defineStore } from 'pinia'
import { Centrifuge, type TransportEndpoint } from 'centrifuge'
import { useAuthStore } from '@/refactoring/modules/authStore/stores/authStore'

// локальный хелпер: превращает что угодно в JSON-safe POJO
const toSafe = (v: unknown, seen = new WeakSet<object>()): any => {
    if (v == null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v
    if (v instanceof Date) return v.toISOString()
    if (v instanceof Error) return { name: v.name, message: v.message, stack: (v.stack || '').split('\n').slice(0, 5) }

    if (Array.isArray(v)) {
        return v.map((x) => toSafe(x, seen))
    }

    if (typeof v === 'object') {
        const obj = v as Record<string, unknown>
        if (seen.has(obj)) return '[circular]'
        seen.add(obj)

        // Коллекции → безопасный вид
        if (v instanceof Map) {
            const out: any[] = []
            for (const [k, val] of v.entries()) out.push({ key: String(k), value: toSafe(val as unknown, seen) })
            return out
        }
        if (v instanceof Set) {
            const out: any[] = []
            for (const val of v.values()) out.push(toSafe(val as unknown, seen))
            return out
        }
        if (ArrayBuffer.isView(v)) return `[typed array length=${(v as ArrayBufferView).byteLength}]`
        if (v instanceof ArrayBuffer) return `[arraybuffer length=${v.byteLength}]`

        // Обычный объект
        const out: Record<string, any> = {}
        for (const key of Object.keys(obj)) {
            const val = obj[key]
            if (typeof val === 'function' || typeof val === 'symbol') continue
            out[key] = toSafe(val, seen)
        }
        return out
    }

    // Фолбэк
    try { return JSON.parse(JSON.stringify(v)) } catch { return String(v) }
}

export const useCentrifugeStore = defineStore('centrifuge', {
    state: () => ({
        client: null as Centrifuge | null,
        connected: false,
        connecting: false,
        subscriptions: new Map<string, any>(),
        handlers: new Map<string, (data: any) => void>(),
        logs: [] as Array<{ time: string; type: string; details: unknown }>,
        reconnectAttempts: 0,
        maxReconnectAttempts: 5,
        reconnectInterval: null as number | null,
        pingInterval: null as number | null,
        lastPingTime: null as number | null,
        connectionLost: false,
    }),

    actions: {
        logEvent(type: string, details: unknown) {
            const timestamp = new Date().toISOString()
            const safe = toSafe(details)
            this.logs.push({ time: timestamp, type, details: toSafe(details) })
            if (this.logs.length > 200) this.logs.shift()
            console.debug('[CENTRIFUGE]', type, safe)
        },

        clearTimers() {
            if (this.reconnectInterval) {
                clearTimeout(this.reconnectInterval)
                this.reconnectInterval = null
            }
            if (this.pingInterval) {
                clearInterval(this.pingInterval)
                this.pingInterval = null
            }
        },

        startPingInterval() {
            this.clearTimers()
            this.pingInterval = setInterval(() => {
                this.checkConnection()
            }, 30000) // Проверка каждые 30 секунд
        },

        checkConnection() {
            if (!this.connected || !this.client) {
                this.logEvent('Connection check failed', {
                    connected: this.connected,
                    hasClient: !!this.client,
                })
                this.handleConnectionLoss()
                return
            }

            // Простая проверка активности соединения
            this.lastPingTime = Date.now()
        },

        handleConnectionLoss() {
            if (this.connectionLost) return // Уже обрабатываем

            this.connectionLost = true
            this.connected = false
            this.logEvent('Connection lost detected', {
                reconnectAttempts: this.reconnectAttempts,
            })

            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.scheduleReconnect()
            } else {
                this.logEvent('Max reconnection attempts reached', {
                    maxAttempts: this.maxReconnectAttempts,
                })
            }
        },

        scheduleReconnect() {
            if (this.reconnectInterval) return

            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000) // Exponential backoff, max 30s
            this.logEvent('Scheduling reconnection', {
                attempt: this.reconnectAttempts + 1,
                delay,
            })

            this.reconnectInterval = setTimeout(() => {
                this.reconnectAttempts++
                this.attemptReconnect()
            }, delay)
        },

        async attemptReconnect() {
            if (this.connecting || this.connected) return

            this.logEvent('Attempting reconnection', {
                attempt: this.reconnectAttempts,
            })

            try {
                await this.initCentrifuge()
                if (this.connected) {
                    this.connectionLost = false
                    this.reconnectAttempts = 0
                    this.logEvent('Reconnection successful', {})
                }
            } catch (error) {
                this.logEvent('Reconnection failed', { error })
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.scheduleReconnect()
                }
            }
        },

        resetConnectionState() {
            this.clearTimers()
            this.connected = false
            this.connecting = false
            this.connectionLost = false
            this.reconnectAttempts = 0
            this.lastPingTime = null
        },

        async initCentrifuge() {
            if (this.connecting) return

            const authStore = useAuthStore()

            if (!authStore.isAuthenticated) {
                this.logEvent('Skipping initialization', {
                    reason: 'User not authenticated',
                })
                return
            }

            this.connecting = true

            // Если токена нет — пробуем обновить и только потом подключаемся
            if (!authStore.centrifugeToken) {
                const ok = await authStore.refreshCentrifugeToken()
                if (!ok || !authStore.centrifugeToken) {
                    this.connecting = false
                    return
                }
            }

            const centrifugoUrl = authStore.centrifugeUrl || ''
            const endpointToUse = centrifugoUrl
            if (!endpointToUse) {
                return
            }

            const transports: TransportEndpoint[] = [
                {
                    transport: 'websocket',
                    endpoint: endpointToUse,
                },
            ]

            const token = authStore.centrifugeToken ?? undefined

            try {
                if (this.client) {
                    try {
                        this.client.disconnect()
                    } catch {}
                    this.client = null
                }

                this.client = new Centrifuge(transports, {
                    token,
                })

                this.client.on('connecting', (ctx) => {
                    this.logEvent('Connecting', ctx)
                    this.connected = false
                })

                this.client.on('connected', (ctx) => {
                    this.logEvent('Connected successfully', ctx)
                    this.connected = true
                    this.connecting = false
                    this.connectionLost = false
                    this.reconnectAttempts = 0
                    this.startPingInterval()
                })

                this.client.on('disconnected', (ctx) => {
                    this.logEvent('Disconnected', ctx)
                    this.connected = false
                    this.connecting = false
                    this.clearTimers()

                    // Если отключение не было планируемым, пытаемся переподключиться
                    if (!this.connectionLost) {
                        setTimeout(() => {
                            this.handleConnectionLoss()
                        }, 1000)
                    }
                })

                this.client.on('error', (ctx) => {
                    this.logEvent('Error occurred', ctx)
                    this.connecting = false
                    this.handleConnectionLoss()
                })

                this.client.connect()
            } catch (e) {
                this.logEvent('Initialization failed', { error: e })
                this.connecting = false
                throw e
            }
        },

        centrifugeSubscribe(channel: string) {
            if (!this.client) {
                this.logEvent('Subscription attempt failed', {
                    channel,
                    reason: 'Client not initialized',
                })
                return
            }

            if (this.subscriptions.has(channel)) {
                return
            }

            try {
                const sub = this.client.newSubscription(channel)

                sub.on('publication', (ctx) => {
                    this.logEvent('Received publication', {
                        channel,
                        data: ctx.data,
                        offset: ctx.offset,
                        tags: ctx.tags,
                    })
                    const handler = this.handlers.get(channel)
                    if (handler) {
                        try {
                            handler(ctx.data)
                        } catch (e) {
                            this.logEvent('Handler error', e)
                        }
                    }
                })

                sub.on('subscribing', (ctx) => {
                    this.logEvent('Subscribing attempt', {
                        channel,
                        ctx,
                    })
                })

                sub.on('subscribed', (ctx) => {
                    this.logEvent('Subscription successful', {
                        channel,
                        details: ctx,
                    })
                    this.subscriptions.set(channel, sub)
                })

                sub.on('unsubscribed', (ctx) => {
                    this.logEvent('Unsubscribed', { channel, ctx })
                    this.subscriptions.delete(channel)
                })

                sub.on('error', (ctx) => {
                    this.logEvent('Subscription error', {
                        channel,
                        error: ctx,
                    })
                })

                sub.subscribe()
            } catch (e) {
                this.logEvent('Subscription failed', { channel, error: e })
            }
        },

        async subscribe(channel: string, onPublication: (data: any) => void) {
            if (!this.client) {
                await this.initCentrifuge()
            }
            this.handlers.set(channel, onPublication)
            this.centrifugeSubscribe(channel)
        },

        centrifugeUnsubscribe(channel: string) {
            try {
                if (!this.client) return

                const sub = this.subscriptions.get(channel)
                if (sub) {
                    this.logEvent('Unsubscribing', { channel })
                    sub.unsubscribe()
                    this.subscriptions.delete(channel)
                }
                this.handlers.delete(channel)
            } catch (e) {
                this.logEvent('Unsubscribe error', {
                    channel,
                    error: e,
                })
            }
        },

        getUnsubscribeCodeDescription(code: number): string {
            const descriptions: Record<number, string> = {
                102: 'Нет прав доступа к каналу',
                103: 'Канал не найден или недоступен',
                108: 'Токен подписки недействителен',
                109: 'Токен подписки истек',
                0: 'Нормальная отписка',
            }
            return descriptions[code] || `Неизвестный код: ${code}`
        },

        diagnostics() {
            return {
                connected: this.connected,
                connecting: this.connecting,
                connectionLost: this.connectionLost,
                reconnectAttempts: this.reconnectAttempts,
                hasClient: !!this.client,
                subscriptions: Array.from(this.subscriptions.keys()),
                handlers: Array.from(this.handlers.keys()),
                lastLog: this.logs[this.logs.length - 1] || null,
                logsCount: this.logs.length,
                lastPingTime: this.lastPingTime,
            }
        },
    },

    getters: {
        connectionStatus: (state) => {
            if (state.connecting) return 'connecting'
            if (state.connected) return 'connected'
            if (state.connectionLost) return 'reconnecting'
            return 'disconnected'
        },

        isOnline: (state) => state.connected && !state.connectionLost,
    },
})

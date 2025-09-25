// utils/centrifugeHelper.ts
import { nextTick } from 'vue'
import { useCentrifugeStore } from '@/refactoring/modules/centrifuge/stores/centrifugeStore'
import { useUserStore } from '@/refactoring/modules/user/stores/userStore'
import type { IRealtimePayload } from '@/refactoring/modules/centrifuge/types/IRealtimePayload'

interface SubscribeOptions<T> {
    channelName: string
    channelId?: string | number
    callback: (data: IRealtimePayload<T>) => Promise<void> | void
    requireConnection?: boolean
}

interface ChannelConfig {
    baseChannel: string
    requiresUserId?: boolean
}

const CHANNEL_CONFIGS: Record<string, ChannelConfig> = {
    adverseevent: {
        baseChannel: 'tables:adverseevent',
        requiresUserId: true
    },
    supportservice: {
        baseChannel: 'tables:supportservice',
        requiresUserId: true
    },
    ticket: {
        baseChannel: 'tables:ticket',
        requiresUserId: true
    }
}

export const useCentrifugeHelper = () => {
    const centrifugeStore = useCentrifugeStore()
    const userStore = useUserStore()

    /**
     * Инициализирует Centrifuge соединение если оно еще не установлено
     */
    const ensureConnection = async (): Promise<void> => {
        if (!centrifugeStore.connected) {
            await centrifugeStore.initCentrifuge()
        }
    }

    /**
     * Формирует название канала на основе конфигурации
     */
    const buildChannelName = (channelType: string, channelId?: string | number): string => {
        const config = CHANNEL_CONFIGS[channelType]
        if (!config) {
            throw new Error(`Unknown channel type: ${channelType}`)
        }

        let channelName = config.baseChannel

        // Добавляем ID если передан
        if (channelId !== undefined) {
            channelName += String(channelId)
        }

        // Добавляем user ID если требуется
        if (config.requiresUserId) {
            const userId = String(userStore.user?.id)
            if (!userId) {
                throw new Error(`User ID is required for channel type: ${channelType}`)
            }
            channelName += `#${userId}`
        }

        return channelName
    }

    /**
     * Подписывается на канал с автоматической инициализацией соединения
     */
    const subscribe = async <T>(options: SubscribeOptions<T>): Promise<void> => {
        const {
            channelName,
            channelId,
            callback,
            requireConnection = true
        } = options

        try {
            if (requireConnection) {
                await ensureConnection()
            }

            const uuid = String(userStore.user?.id)
            if (!uuid) {
                centrifugeStore.logEvent('Subscribe skipped: missing user uuid', {
                    user: userStore.user
                })
                return
            }

            const fullChannelName = buildChannelName(channelName, channelId)
            await nextTick()

            await centrifugeStore.subscribe(
                fullChannelName,
                async (data: IRealtimePayload<T>) => {
                    if (!data?.event_type || !data?.data) return
                    await callback(data)
                }
            )

        } catch (error) {
            centrifugeStore.logEvent('Subscribe error', {
                error,
                channelName,
                channelId
            })
            throw error
        }
    }

    /**
     * Универсальный метод для подписки на обновления списков
     */
    const subscribeToList = async <T>(
        entityType: 'adverseevent' | 'supportservice' | 'ticket',
        callback: (data: IRealtimePayload<T>) => Promise<void> | void
    ): Promise<void> => {
        await subscribe({
            channelName: entityType,
            callback
        })
    }

    /**
     * Универсальный метод для подписки на конкретную сущность
     */
    const subscribeToEntity = async <T>(
        entityType: 'adverse_event' | 'support_service',
        entityId: string | number,
        callback: (data: IRealtimePayload<T>) => Promise<void> | void
    ): Promise<void> => {
        await subscribe({
            channelName: entityType,
            channelId: entityId,
            callback
        })
    }

    return {
        ensureConnection,
        subscribe,
        subscribeToList,
        subscribeToEntity,
        buildChannelName
    }
}

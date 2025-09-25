/**
 * Composable для работы со звуковыми уведомлениями в чате
 *
 * Предоставляет удобный интерфейс для:
 * - Управления включением/отключением звука
 * - Проверки статуса активации
 * - Запроса разрешений на уведомления
 * - Воспроизведения тестовых звуков
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { soundService } from '@/refactoring/utils/soundService'

export function useSound() {
    const isEnabled = ref(soundService.isEnabled())
    const isUnlocked = ref(soundService.audioUnlocked)
    const volume = ref(soundService.getConfig().volume)
    const wasEverActivated = ref(soundService.wasEverActivated())

    // Периодически обновляем состояние (для синхронизации между компонентами)
    let updateInterval: number | null = null

    const updateState = () => {
        isEnabled.value = soundService.isEnabled()
        isUnlocked.value = soundService.audioUnlocked
        volume.value = soundService.getConfig().volume
        wasEverActivated.value = soundService.wasEverActivated()
    }

    onMounted(() => {
        updateState()
        // Обновляем состояние каждые 2 секунды
        updateInterval = window.setInterval(updateState, 2000)
    })

    onUnmounted(() => {
        if (updateInterval) {
            clearInterval(updateInterval)
        }
    })

    // Computed properties для UI
    const soundIcon = computed(() => {
        if (!isEnabled.value) return 'pi pi-volume-off'
        if (isUnlocked.value) return 'pi pi-volume-up'
        return 'pi pi-volume-down'
    })

    const soundSeverity = computed(() => {
        if (!isEnabled.value) return 'danger'
        if (isUnlocked.value) return 'success'
        return 'warning'
    })

    const soundTooltip = computed(() => {
        if (!isEnabled.value) return 'Включить звуковые уведомления'
        if (isUnlocked.value) return 'Отключить звуковые уведомления'
        return 'Нажмите для активации звука'
    })

    const needsActivation = computed(() => {
        return isEnabled.value && !isUnlocked.value
    })

    // Методы для управления звуком
    const toggleSound = async (): Promise<void> => {
        if (needsActivation.value) {
            // Активируем звук
            const activated = await soundService.forceActivateImmediately()
            if (activated) {
                updateState()
                // Воспроизводим тестовый звук
                await soundService.playNewMessageSound()
            }
            return
        }

        // Переключаем состояние
        const newState = !isEnabled.value
        soundService.setEnabled(newState)

        if (newState) {
            // При включении запрашиваем разрешения и активируем
            await soundService.ensureNotifications()
            const activated = await soundService.forceActivateImmediately()
            if (activated) {
                updateState()
                await soundService.playNewMessageSound()
            }
        } else {
            updateState()
        }
    }

    const setVolume = (newVolume: number): void => {
        soundService.setVolume(newVolume)
        updateState()
    }

    const playTestSound = async (): Promise<void> => {
        await soundService.playNewMessageSound()
    }

    const requestNotifications = async (): Promise<boolean> => {
        return await soundService.ensureNotifications()
    }

    const forceActivate = async (): Promise<boolean> => {
        const result = await soundService.forceActivateImmediately()
        updateState()
        return result
    }

    return {
        // Реактивные состояния
        isEnabled,
        isUnlocked,
        volume,
        wasEverActivated,

        // Computed для UI
        soundIcon,
        soundSeverity,
        soundTooltip,
        needsActivation,

        // Методы
        toggleSound,
        setVolume,
        playTestSound,
        requestNotifications,
        forceActivate,
        updateState,
    }
}

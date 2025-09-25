<template>
    <div class="sound-settings">
        <div class="flex flex-col gap-4">
            <!-- Основное переключение звука -->
            <div class="flex items-center justify-between">
                <div class="flex flex-col">
                    <label class="font-semibold text-surface-900 dark:text-surface-0">
                        Звуковые уведомления
                    </label>
                    <span class="text-sm text-surface-600 dark:text-surface-400">
                        Воспроизводить звук при получении новых сообщений
                    </span>
                </div>
                <ToggleSwitch v-model="isEnabled" @change="onToggleSound" />
            </div>

            <!-- Дополнительные настройки (показываем только если звук включен) -->
            <div v-if="isEnabled" class="ml-4 flex flex-col gap-4">
                <!-- Статус активации -->
                <div class="flex items-center gap-2">
                    <i :class="statusIcon" :style="{ color: statusColor }"></i>
                    <span class="text-sm" :style="{ color: statusColor }">
                        {{ statusText }}
                    </span>
                </div>

                <!-- Кнопка активации (если нужна) -->
                <div v-if="needsActivation" class="flex flex-col gap-2">
                    <Button
                        label="Активировать звук"
                        icon="pi pi-volume-up"
                        size="small"
                        @click="onForceActivate"
                        :loading="isActivating"
                    />
                    <span class="text-xs text-surface-500 dark:text-surface-400">
                        Для воспроизведения звука требуется разрешение браузера
                    </span>
                </div>

                <!-- Регулятор громкости -->
                <div class="flex flex-col gap-2">
                    <label class="text-sm font-medium text-surface-700 dark:text-surface-300">
                        Громкость: {{ Math.round(volume * 100) }}%
                    </label>
                    <Slider
                        v-model="volume"
                        :min="0"
                        :max="1"
                        :step="0.1"
                        @update:modelValue="onVolumeChange"
                        class="w-full"
                    />
                </div>

                <!-- Тестовый звук -->
                <Button
                    label="Проверить звук"
                    icon="pi pi-play"
                    size="small"
                    outlined
                    @click="playTestSound"
                    :disabled="!isUnlocked"
                />

                <!-- Системные уведомления -->
                <div class="flex items-center justify-between">
                    <div class="flex flex-col">
                        <label class="text-sm font-medium text-surface-700 dark:text-surface-300">
                            Системные уведомления
                        </label>
                        <span class="text-xs text-surface-500 dark:text-surface-400">
                            Показывать уведомления даже когда вкладка неактивна
                        </span>
                    </div>
                    <Button
                        :label="notificationButtonLabel"
                        :icon="notificationButtonIcon"
                        size="small"
                        outlined
                        @click="requestNotifications"
                        :disabled="notificationPermission === 'denied'"
                    />
                </div>

                <!-- Информация о разрешениях -->
                <div
                    v-if="notificationPermission !== 'granted'"
                    class="text-xs text-surface-500 dark:text-surface-400"
                >
                    <i class="pi pi-info-circle mr-1"></i>
                    {{ notificationHelpText }}
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSound } from '@/refactoring/modules/chat/composables/useSound'

const {
    isEnabled,
    isUnlocked,
    volume,
    needsActivation,
    toggleSound,
    setVolume,
    playTestSound,
    requestNotifications,
    forceActivate,
} = useSound()

const isActivating = ref(false)

// Проверяем разрешение на уведомления
const notificationPermission = computed(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
        return 'not-supported'
    }
    return Notification.permission
})

// Статус активации
const statusIcon = computed(() => {
    if (!isEnabled.value) return 'pi pi-volume-off'
    if (isUnlocked.value) return 'pi pi-check-circle'
    return 'pi pi-volume-down'
})

const statusColor = computed(() => {
    if (!isEnabled.value) return '#6b7280' // gray
    if (isUnlocked.value) return '#10b981' // green
    return '#f59e0b' // amber
})

const statusText = computed(() => {
    if (!isEnabled.value) return 'Звук отключен'
    if (isUnlocked.value) return 'Звук готов к воспроизведению'
    return 'Требуется активация звука'
})

// Кнопка системных уведомлений
const notificationButtonLabel = computed(() => {
    switch (notificationPermission.value) {
        case 'granted':
            return 'Разрешено'
        case 'denied':
            return 'Запрещено'
        case 'not-supported':
            return 'Не поддерживается'
        default:
            return 'Разрешить'
    }
})

const notificationButtonIcon = computed(() => {
    switch (notificationPermission.value) {
        case 'granted':
            return 'pi pi-check'
        case 'denied':
            return 'pi pi-times'
        case 'not-supported':
            return 'pi pi-minus'
        default:
            return 'pi pi-bell'
    }
})

const notificationHelpText = computed(() => {
    switch (notificationPermission.value) {
        case 'denied':
            return 'Уведомления запрещены. Измените настройки в браузере для включения.'
        case 'not-supported':
            return 'Ваш браузер не поддерживает системные уведомления.'
        default:
            return 'Разрешите уведомления для получения звуковых сигналов при неактивной вкладке.'
    }
})

// Обработчики
const onToggleSound = async () => {
    await toggleSound()
}

const onVolumeChange = (value: number | number[]) => {
    const newVolume = Array.isArray(value) ? value[0] : value
    setVolume(newVolume)
}

const onForceActivate = async () => {
    isActivating.value = true
    try {
        await forceActivate()
    } finally {
        isActivating.value = false
    }
}
</script>

<style lang="scss">
@use '../styles' as *;
</style>

<style lang="scss" scoped>
@use '../styles/mixins' as *;
@use '../styles/variables' as *;
.sound-settings {
    max-width: 400px;

    .flex {
        &.flex-col {
            @include flex-column-gap(1rem);
        }

        &.items-center {
            align-items: center;
        }

        &.justify-between {
            justify-content: space-between;
        }
    }

    .font-semibold {
        @include form-label-primary;
    }

    .text-sm {
        @include form-label-secondary;
    }

    .ml-4 {
        margin-left: 1rem;
    }

    .gap-4 {
        gap: 1rem;
    }

    .gap-2 {
        gap: 0.5rem;
    }

    .w-full {
        width: 100%;
    }
}
</style>

<template>
    <Transition name="slide-down">
        <div v-if="showBanner" class="sound-activation-banner">
            <div class="banner-content">
                <div class="banner-icon">
                    <i class="pi pi-volume-up"></i>
                </div>

                <div class="banner-text">
                    <h4 class="banner-title">Включить звуковые уведомления</h4>
                    <p class="banner-description">
                        Для воспроизведения звуков новых сообщений требуется разрешение браузера
                    </p>
                </div>

                <div class="banner-actions">
                    <Button
                        label="Включить звук"
                        icon="pi pi-check"
                        @click="activateSound"
                        :loading="isActivating"
                        size="small"
                    />
                    <Button
                        icon="pi pi-times"
                        text
                        @click="dismissBanner"
                        size="small"
                        severity="secondary"
                        v-tooltip.bottom="'Скрыть'"
                    />
                </div>
            </div>
        </div>
    </Transition>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useSound } from '@/refactoring/modules/chat/composables/useSound'

const {
    isEnabled,
    isUnlocked,
    needsActivation,
    forceActivate,
    requestNotifications,
    wasEverActivated,
} = useSound()

const isActivating = ref(false)
const isDismissed = ref(false)

// Проверяем нужно ли показывать баннер
const showBanner = computed(() => {
    // Показываем баннер только если:
    // - не отклонен пользователем
    // - звук включен
    // - требуется активация (звук не разблокирован)
    // - пользователь еще НИКОГДА не активировал звук
    return (
        !isDismissed.value &&
        isEnabled.value &&
        needsActivation.value &&
        !isUnlocked.value &&
        !wasEverActivated.value
    )
})

// Активация звука
const activateSound = async () => {
    isActivating.value = true

    try {
        // Сначала запрашиваем разрешение на уведомления
        await requestNotifications()

        // Затем активируем звук
        const activated = await forceActivate()

        if (activated) {
            // Если активация успешна, скрываем баннер
            isDismissed.value = true

            // Показываем успешное уведомление
            const toast = document.createElement('div')
            toast.className =
                'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50'
            toast.textContent = '✅ Звуковые уведомления включены'
            document.body.appendChild(toast)

            setTimeout(() => {
                document.body.removeChild(toast)
            }, 3000)
        }
        } catch (error) {
            // Ошибка активации звука
        } finally {
        isActivating.value = false
    }
}

// Скрытие баннера
const dismissBanner = () => {
    isDismissed.value = true

    // Сохраняем в локальном хранилище что пользователь отклонил
    try {
        localStorage.setItem('sound-banner-dismissed', 'true')
    } catch (e) {
        // Игнорируем ошибки локального хранилища
    }
}

// Проверяем при монтировании был ли баннер уже отклонен
onMounted(() => {
    try {
        const dismissed = localStorage.getItem('sound-banner-dismissed')
        if (dismissed === 'true') {
            isDismissed.value = true
        }
    } catch (e) {
        // Игнорируем ошибки локального хранилища
    }
})
</script>

<style lang="scss">
@use '../styles' as *;
</style>

<style lang="scss" scoped>
@use '../styles/mixins' as *;
@use '../styles/variables' as *;
.sound-activation-banner {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.banner-content {
    @include flex-row-gap(1rem);
    align-items: center;
    padding: 0.875rem 1.5rem;
    max-width: 1200px;
    margin: 0 auto;
}

.banner-icon {
    @include flex-center;
    width: $chat-icon-size-large;
    height: $chat-icon-size-large;
    background: rgba(255, 255, 255, 0.15);
    border-radius: $chat-icon-border-radius-rounded;
    font-size: 1.125rem;
    flex-shrink: 0;
}

.banner-text {
    flex: 1;
    min-width: 0;
}

.banner-title {
    font-size: 0.875rem;
    font-weight: $chat-title-font-weight;
    margin: 0 0 0.25rem 0;
    line-height: 1.2;
}

.banner-description {
    font-size: 0.75rem;
    margin: 0;
    opacity: 0.9;
    line-height: 1.3;
}

.banner-actions {
    @include flex-row-gap(0.5rem);
    align-items: center;
    flex-shrink: 0;
}

// Адаптивные настройки
@media (max-width: 768px) {
    .banner-content {
        padding: 0.75rem 1rem;
        gap: 0.75rem;
    }

    .banner-icon {
        width: $chat-icon-size-small;
        height: $chat-icon-size-small;
        font-size: 1rem;
    }

    .banner-title {
        font-size: 0.8rem;
    }

    .banner-description {
        font-size: 0.7rem;
    }

    .banner-actions {
        gap: 0.25rem;
    }
}

@media (max-width: 480px) {
    .banner-content {
        flex-direction: column;
        align-items: stretch;
        gap: 0.5rem;
        text-align: center;
    }

    .banner-actions {
        justify-content: center;
    }
}
</style>

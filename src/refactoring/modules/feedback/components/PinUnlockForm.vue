<script setup lang="ts">
/*
 * Компонент формы разблокировки по PIN-коду
 *
 * Особенности:
 * - Двухэтапный процесс (ввод PIN / сброс по учетным данным)
 * - Использует стандартные компоненты аутентификации
 * - Четкое разделение состояний формы
 * - Валидация вводимых данных
 */

import { ref, computed } from 'vue'
import { useAuthStore } from '@/refactoring/modules/authStore/stores/authStore'
import { useFeedbackStore } from '@/refactoring/modules/feedback/stores/feedbackStore'
import InputWithValidation from '@/refactoring/modules/authStore/components/InputWithValidation.vue'
import PasswordInputWithValidation from '@/refactoring/modules/authStore/components/PasswordInputWithValidation.vue'
import { logger } from '@/refactoring/utils/eventLogger'

const authStore = useAuthStore()
const feedbackStore = useFeedbackStore()

// Реактивные данные формы
const pin = ref('')
const pinError = ref('')
const username = ref('')
const password = ref('')

// Ссылки на компоненты валидации
const usernameInputRef = ref()
const passwordInputRef = ref()

// Состояния формы
enum PinUnlockStep {
    ENTER_PIN,
    RESET_PIN
}
const currentStep = ref(PinUnlockStep.ENTER_PIN)

/**
 * Текст для основной кнопки формы
 */
const submitButtonText = computed(() => {
    return currentStep.value === PinUnlockStep.ENTER_PIN
        ? 'Разблокировать'
        : 'Сбросить PIN'
})

/**
 * Текст для кнопки переключения режима
 */
const toggleButtonText = computed(() => {
    return currentStep.value === PinUnlockStep.ENTER_PIN
        ? 'Забыли PIN?'
        : 'Вернуться к вводу PIN'
})

/**
 * Переключает между режимами формы
 */
const toggleFormMode = () => {
    currentStep.value = currentStep.value === PinUnlockStep.ENTER_PIN
        ? PinUnlockStep.RESET_PIN
        : PinUnlockStep.ENTER_PIN
    pinError.value = ''
}

/**
 * Обрабатывает ввод PIN-кода для разблокировки
 *
 * Выполняет:
 * - Валидацию наличия введенного PIN-кода
 * - Отправку запроса на разблокировку
 * - Повтор ожидающих запросов при успехе
 * - Обработку ошибок с показом сообщения
 *
 * Особенности:
 * - Управляет состоянием загрузки через feedbackStore
 * - Логирует процесс разблокировки
 * - Гарантирует снятие состояния загрузки в finally
 */
const handleSubmit = async () => {
    if (!pin.value.trim()) {
        pinError.value = 'Введите PIN-код'
        return
    }

    feedbackStore.isGlobalLoading = true
    pinError.value = ''

    try {
        const success = await authStore.unlockWithPin({ pin: pin.value })
        if (success) {
            authStore.showPinUnlock = false

            // Повторяем запросы, которые ожидали разблокировки
            authStore.retryPendingRequests()
        } else {
            logger.error('pinUnlock_submit_failed', {
                file: 'PinUnlock.vue',
                function: 'handleSubmit',
                condition: '❌ Неверный PIN-код'
            })
            pinError.value = 'Неверный PIN-код'
        }
    } catch (error) {
        logger.error('pinUnlock_submit_error', {
            file: 'PinUnlock.vue',
            function: 'handleSubmit',
            condition: `⚠️ Ошибка при разблокировке: ${error}`,
            error
        })
        pinError.value = 'Ошибка при разблокировке'
    } finally {
        pin.value = ''
        feedbackStore.isGlobalLoading = false
    }
}

/**
 * Обрабатывает сброс PIN-кода по учетным данным
 *
 * Выполняет:
 * - Валидацию полей формы
 * - Отправку запроса на сброс PIN
 * - Повтор ожидающих запросов при успехе
 * - Обработку ошибок с показом сообщения
 *
 * Особенности:
 * - Использует глобальное состояние загрузки
 * - Логирует процесс сброса PIN
 * - Гарантирует снятие состояния загрузки в finally
 */
const handleResetPin = async () => {

    feedbackStore.isGlobalLoading = true

    try {

        const success = await authStore.removePin({
            username: username.value,
            password: password.value
        })

        if (success) {

            authStore.showPinUnlock = false

            // Повторяем запросы, которые ожидали разблокировки
            authStore.retryPendingRequests()

            feedbackStore.showToast({
                type: 'success',
                title: 'Успех',
                message: 'PIN-код успешно сброшен',
                time: 5000,
            })
        }
    } catch (error) {
        logger.error('pinReset_error', {
            file: 'PinUnlock.vue',
            function: 'handleResetPin',
            condition: `❌ Ошибка при сбросе PIN: ${error}`,
            error
        })

        feedbackStore.showToast({
            type: 'error',
            title: 'Ошибка',
            message: 'Неверные учетные данные или ошибка сервера',
            time: 7000,
        })
    } finally {
        feedbackStore.isGlobalLoading = false
    }
}

</script>

<template>
    <div
        v-if="authStore.showPinUnlock"
        class="pin-unlock-overlay"
    >
        <div class="pin-unlock-form">
            <div class="pin-unlock-header">
                <h3 class="pin-unlock-title">
                    {{ currentStep === PinUnlockStep.ENTER_PIN ? 'Введите PIN-код' : 'Сброс PIN-кода' }}
                </h3>
                <p class="pin-unlock-subtitle">
                    {{ currentStep === PinUnlockStep.ENTER_PIN
                    ? 'Для разблокировки приложения'
                    : 'Для сброса введите учетные данные' }}
                </p>
            </div>

            <!-- Режим ввода PIN -->
            <template v-if="currentStep === PinUnlockStep.ENTER_PIN">
                <InputText
                    v-model="pin"
                    type="number"
                    placeholder="PIN-код"
                    class="w-full pin-unlock__input"
                    inputClass="w-full"
                    @keydown.enter="currentStep === PinUnlockStep.ENTER_PIN ? handleSubmit() : handleResetPin()"
                    autofocus
                />
                <div v-if="pinError" class="pin-unlock__error">{{ pinError }}</div>
            </template>

            <!-- Режим сброса PIN -->
            <template v-else>
                <InputWithValidation
                    ref="usernameInputRef"
                    v-model="username"
                    class="w-full pin-unlock__input"
                />

                <PasswordInputWithValidation
                    ref="passwordInputRef"
                    v-model="password"
                    class="w-full pin-unlock__input"
                />
            </template>

            <div class="pin-unlock-actions">
                <Button
                    :label="submitButtonText"
                    class="pin-unlock-button"
                    @click="currentStep === PinUnlockStep.ENTER_PIN ? handleSubmit() : handleResetPin()"
                />

                <Button
                    :label="toggleButtonText"
                    class="pin-unlock-toggle-button"
                    @click="toggleFormMode"
                />
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss">
.pin-unlock {
    &-overlay {
        position: fixed;
        top: 0;
        left: 0;
        z-index: 100000;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100vw;
        height: 100vh;
        background-color: rgba(0, 0, 0, 0.85);
    }

    &-form {
        background: white;
        padding: 2rem;
        border-radius: 12px;
        width: 100%;
        max-width: 400px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);

        .dark-mode & {
            background: var(--surface-900);
        }
    }

    &-header {
        text-align: center;
        margin-bottom: 1.5rem;
    }

    &-title {
        color: var(--text-color);
        font-size: 1.25rem;
        font-weight: 600;
        margin-bottom: 0.5rem;
    }

    &-subtitle {
        color: var(--text-secondary-color);
        font-size: 0.9rem;
        line-height: 1.4;
    }

    /* Сообщения об ошибках */
    &__error {
        color: red;
        text-align: center;
        margin-top: 0.3rem;
    }

    &__input {
        width: 100%;
        margin-bottom: 1rem;

        appearance: textfield;
        -moz-appearance: textfield;
        -webkit-appearance: none;

        &::-webkit-outer-spin-button,
        &::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
        }

        &--invalid {
            border-color: red !important;
        }
    }

    &-error {
        color: var(--red-500);
        font-size: 0.875rem;
        margin: -0.75rem 0 1rem;
        text-align: center;
    }

    &-actions {
        margin-top: 1.5rem;
    }

    &-button {
        width: 100%;
        background-color: var(--p-blue-400);
        border: none;

        &:hover {
            border: none !important;
        }
    }

    &-toggle-button {
        width: 100%;
        margin-top: 0.75rem;
        background: transparent;
        color: var(--primary-color);
        border: none;
        box-shadow: none;

        &:hover {
            background: transparent;
            border: none !important;
        }
    }
}

.app-dark .pin-unlock-form {
    background-color: var(--p-surface-900);
}
</style>

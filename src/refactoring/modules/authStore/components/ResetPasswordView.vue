<script setup lang="ts">
/*
 * Компонент формы восстановления пароля
 *
 * Основные функции:
 * - Многоэтапный процесс восстановления пароля:
 * 1. Запрос кода подтверждения по СНИЛС
 * 2. Ввод полученного кода
 * 3. Установка нового пароля
 * - Валидация вводимых данных на каждом этапе
 * - Интеграция с API восстановления пароля
 *
 * Особенности:
 * - Пошаговая реализация с enum состояниями
 * - Динамическое изменение интерфейса в зависимости от этапа
 * - Комплексная валидация полей (СНИЛС, код, пароль)
 * - Обратная связь через toast-уведомления
 *
 * Используемые хранилища:
 * - authStore: управление процессом аутентификации
 * - feedbackStore: обработка состояния загрузки и уведомлений
 *
 * Подключенные компоненты:
 * - InputWithValidation: поле ввода с валидацией для СНИЛС
 * - PasswordInputWithValidation: поле ввода пароля с валидацией
 */

// Импорты Vue
import { ref, computed } from 'vue'

// Импорты хранилищ Pinia
import { useAuthStore } from '@/refactoring/modules/authStore/stores/authStore'
import { useFeedbackStore } from '@/refactoring/modules/feedback/stores/feedbackStore'

// Импорты компонентов
import InputWithValidation from '@/refactoring/modules/authStore/components/InputWithValidation.vue'
import PasswordInputWithValidation from '@/refactoring/modules/authStore/components/PasswordInputWithValidation.vue'

// Инициализация хранилищ
const authStore = useAuthStore()
const feedbackStore = useFeedbackStore()

// Реактивные данные формы
const username = ref('') // Введенный СНИЛС
const code = ref('') // Код подтверждения
const codeError = ref('') // Ошибка валидации кода
const newPassword = ref('') // Новый пароль

// Рефы для валидации
const usernameRef = ref() // Ссылка на компонент валидации СНИЛС
const passwordInputRef = ref() // Ссылка на компонент валидации пароля

/**
 * Enum для управления этапами восстановления пароля
 * - REQUEST_CODE: этап запроса кода подтверждения
 * - ENTER_CODE: этап ввода полученного кода
 * - ENTER_NEW_PASSWORD: этап установки нового пароля
 */
enum ResetStep {
    REQUEST_CODE,
    ENTER_CODE,
    ENTER_NEW_PASSWORD
}

const currentStep = ref(ResetStep.REQUEST_CODE) // Текущий этап восстановления
const codeRegex = /^\d{6}$/ // Регулярное выражение для валидации кода (6 цифр)

/**
 * Очищает код подтверждения от нецифровых символов
 * - Используется перед валидацией и отправкой кода
 */
const cleanCode = (val: string) => val.replace(/\D/g, '')

/**
 * Запрашивает код подтверждения для восстановления
 * - Валидирует СНИЛС перед отправкой запроса
 * - При успехе переводит на этап ввода кода
 */
const requestCode = async () => {
    if (!(await usernameRef.value?.validate())) return

    const success = await authStore.getRestoreCode({ username: username.value })
    if (success) {
        currentStep.value = ResetStep.ENTER_CODE
    }
}

/**
 * Валидирует введенный код подтверждения
 * - Проверяет что код состоит из 6 цифр
 * - Показывает ошибку при несоответствии формату
 */
const validateCode = async () => {
    code.value = cleanCode(code.value)
    if (!codeRegex.test(code.value)) {
        feedbackStore.showToast({
            type: 'error',
            title: 'Ошибка',
            message: 'Код должен состоять из 6 цифр',
            time: 7000,
        })
        return false
    }
    return true
}

/**
 * Отправляет код подтверждения на проверку
 * - Валидирует код перед отправкой
 * - При успехе переводит на этап смены пароля
 * - При ошибке сбрасывает процесс и показывает сообщение
 */
const submitCode = async () => {
    if (!(await validateCode())) return

    const success = await authStore.checkResetCode({
        username: username.value,
        code: code.value
    })

    if (success) {
        currentStep.value = ResetStep.ENTER_NEW_PASSWORD
    }
}

/**
 * Обновляет пароль пользователя
 * - Валидирует новый пароль перед отправкой
 * - При успехе возвращает на форму входа
 */
const updatePassword = async () => {
    const success = await authStore.updatePassword({
        username: username.value,
        code: code.value,
        password: newPassword.value
    })

    if (success) {
        showLoginForm()
    }
}

/**
 * Вычисляемый текст для кнопки отправки
 * - Меняется в зависимости от текущего этапа
 */
const buttonText = computed(() => {
    switch (currentStep.value) {
        case ResetStep.REQUEST_CODE: return 'Запросить код'
        case ResetStep.ENTER_CODE: return 'Отправить код'
        case ResetStep.ENTER_NEW_PASSWORD: return 'Обновить пароль'
        default: return 'Далее'
    }
})

/**
 * Обработчик клика по основной кнопке формы
 * - Вызывает соответствующий метод для текущего этапа
 */
const handleButtonClick = () => {
    switch (currentStep.value) {
        case ResetStep.REQUEST_CODE: requestCode(); break
        case ResetStep.ENTER_CODE: submitCode(); break
        case ResetStep.ENTER_NEW_PASSWORD: updatePassword(); break
    }
}

/**
 * Возвращает на форму входа
 * - Сбрасывает все состояния и ошибки
 * - Активирует флаг формы входа в authStore
 */
const showLoginForm = () => {
    codeError.value = ''
    authStore.messageToUser = ''
    authStore.restoreTelegramCode = ''
    authStore.isResetPassword = false
    authStore.isLogin = true
}

</script>

<!--
  Шаблон формы:
  - Динамическое отображение полей в зависимости от этапа
  - Поле СНИЛС (всегда видимо, но disabled после 1 этапа)
  - Блок ввода кода (только на 2 этапе)
  - Блок ввода пароля (только на 3 этапе)
  - Динамическая кнопка с изменяющимся текстом
  - Кнопка отмены для возврата к форме входа
-->
<template>
    <div class="auth-form__form-container">
        <form @submit.prevent="handleButtonClick">
            <input-with-validation
                ref="usernameRef"
                v-model="username"
                :disabled="currentStep !== ResetStep.REQUEST_CODE"
            />

            <div v-if="currentStep === ResetStep.ENTER_CODE" class="auth-form__code-container">
                <div class="auth-form__message" v-html="authStore.messageToUser"></div>
                <div class="auth-form__hint">Код действителен в течении 15 минут!</div>

                <label for="code" class="auth-form__label">Код подтверждения</label>
                <app-inputtext
                    id="code"
                    v-model="code"
                    placeholder="Введите 6-значный код"
                    class="auth-form__input ml-2"
                    maxlength="6"
                />
                <div v-if="codeError" class="auth-form__error">{{ codeError }}</div>
            </div>

            <password-input-with-validation
                v-if="currentStep === ResetStep.ENTER_NEW_PASSWORD"
                ref="passwordInputRef"
                v-model="newPassword"
                label="Новый пароль"
            />

            <Button
                type="submit"
                :label="buttonText"
                class="auth-form__button"
                :loading="feedbackStore.isGlobalLoading"
            ></Button>

            <Button
                type="submit"
                label="Отмена"
                class="auth-form__action-button"
                :loading="feedbackStore.isGlobalLoading"
                @click="showLoginForm"
            ></Button>
        </form>
    </div>
</template>

<style scoped lang="scss">
.auth-form {
    &__form-container {
        width: 100%;
    }

    &__code-container {
        margin-top: 1rem;
    }

    &__action-button {
        width: 100%;
        height: 100%;
        background-color: var(--p-blue-400);
        border: none;
        margin-top: 10px;
        &:hover {
            border: none !important;
        }
    }

    &__message {
        margin-bottom: 0.5rem;
        color: var(--text-color);
        line-height: 1.4;
    }

    &__hint {
        margin-bottom: 1rem;
        color: var(--text-muted-color);
        font-size: 0.9rem;
    }

    &__button {
        width: 100%;
        margin-top: 20px;
    }
    &__error {
        color: red;
        text-align: center;
        margin-top: 0.5rem;
    }
}
</style>

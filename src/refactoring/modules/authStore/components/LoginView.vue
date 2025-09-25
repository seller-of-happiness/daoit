<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/refactoring/modules/authStore/stores/authStore'
import { useFeedbackStore } from '@/refactoring/modules/feedback/stores/feedbackStore'
import { ERouteNames } from '@/router/ERouteNames'
import InputWithValidation from '@/refactoring/modules/authStore/components/InputWithValidation.vue'
import PasswordInputWithValidation from '@/refactoring/modules/authStore/components/PasswordInputWithValidation.vue'
import TwoFaCodeInput from '@/refactoring/modules/authStore/components/TwoFaCodeInput.vue'


// Инициализация роутера и хранилищ
const router = useRouter()
const authStore = useAuthStore()
const feedbackStore = useFeedbackStore()

// Реактивные переменные формы
const username = ref('') // Значение поля "Логин" (СНИЛС или телефон)
const password = ref('') // Значение поля "Пароль"
const twoFaCode = ref('') //поле для кода 2FA
const usernameInputRef = ref() // Ссылка на input "Логин"
const passwordInputRef = ref() // Ссылка на input "Пароль"
const twoFaCodeInputRef = ref() // Ссылка на инпут 2FA


/**
 * Проверяет, пуста ли форма
 * Используется для управления состоянием кнопки отправки
 */
const isFormEmpty = computed(() => {
    // Учитываем show2FA при проверке пустой формы
    if (authStore.show2FA) {
        return !username.value.trim() || !password.value.trim() || !twoFaCode.value.trim()
    }
    return !username.value.trim() || !password.value.trim()
})

/**
 * Обработчик отправки формы
 *
 * Логика работы:
 * 1. Очистка введенных значений от пробелов
 * 2. Сброс предыдущих ошибок
 * 3. Валидация email и пароля
 * 4. При наличии ошибок - прерывание отправки
 * 5. Вызов метода авторизации из хранилища
 * 6. Редирект при успешной авторизации
 */
const handleSubmit = async () => {
    const isUsernameValid = await usernameInputRef.value?.validate()

    if (!isUsernameValid) return

    // [Если требуется 2FA - вызываем соответствующую функцию
    if (authStore.show2FA) {
        const isCodeValid = await twoFaCodeInputRef.value?.validate()
        if (!isCodeValid) return

        const success = await authStore.loginWith2Fa({
            username: username.value,
            password: password.value,
            code: twoFaCode.value
        })
        if (success) {
            try {
                await router.push({ name: ERouteNames.ACTUAL })
            } catch (error) {
                console.error('Redirect failed:', error)
            }
        }
    } else {
        // Стандартный логин
        const success = await authStore.login({
            username: username.value,
            password: password.value
        })
        if (success) {
            try {
                await router.push({ name: ERouteNames.ACTUAL })
            } catch (error) {
                console.error('Redirect failed:', error)
            }
        }
    }
}
</script>

<template>
    <div class="auth-form__form-container">
        <form @submit.prevent="handleSubmit">
            <input-with-validation
                ref="usernameInputRef"
                v-model="username"
            />


            <password-input-with-validation
                ref="passwordInputRef"
                v-model="password"
            />

            <!-- Показываем инпут для 2FA кода если требуется -->
            <two-fa-code-input
                v-if="authStore.show2FA"
                ref="twoFaCodeInputRef"
                v-model="twoFaCode"
            />

            <Button
                @click="handleSubmit"
                type="submit"
                label="Войти"
                class="auth-form__button"
                :loading="feedbackStore.isGlobalLoading"
                :disabled="feedbackStore.isGlobalLoading || isFormEmpty"
            ></Button>
        </form>
    </div>
</template>

<style scoped lang="scss">
/*
  Основные стили формы авторизации:
  - Адаптивный дизайн
  - Поддержка темной/светлой темы через CSS-переменные
  - Стили для состояний (ошибки, наведение, фокус)
*/

.auth-form {
    &__container {
        width: 100%;
    }

    &__form-container {
        width: 100%;
    }

    &__button {
        width: 100%;
        margin-top: 20px;
    }

    &__wrapper {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
    }

    /* Градиентная рамка */
    &__gradient {
        border-radius: 56px;
        padding: 0.3rem;
        background: linear-gradient(
                180deg,
                var(--primary-color) 10%,
                rgba(33, 150, 243, 0) 30%
        );
    }

    /* Основной блок формы */
    &__box {
        padding: 4rem;
        width: 100%;
        aspect-ratio: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        background-color: white;
        border-radius: 56px;
    }

    /* Заголовок формы */
    &__header {
        text-align: center;
        margin-bottom: 2rem;
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    /* Стили логотипа */
    &__logo {
        margin-bottom: 0.75rem;
    }

    /* Подзаголовок */
    &__subtitle {
        color: var(--text-muted-color);
        font-weight: 500;
        margin-top: 10px;
    }

    /* Метки полей ввода */
    &__label {
        display: block;
        color: var(--surface-900);
        font-size: 1.25rem;
        font-weight: 500;
        margin-block: 0.5rem;
    }



    &__reset {
        margin-top: 10px;
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
        color: var(--p-blue-500);
        cursor: pointer;
        background: transparent;
        border: none;
        &:hover {
            background: transparent !important;
            border: none !important;
            color: var(--text-color) !important;
        }
    }

    &__checkbox-container {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 0.5rem;
        margin-bottom: 2rem;
        gap: 2rem;
    }

    &__checkbox-wrapper {
        display: flex;
        align-items: center;
    }

    &__checkbox-label {
        display: flex;
        align-items: center;
    }

    &__checkbox {
        margin-right: 0.5rem;
    }

    &__checkbox-text {
        font-size: 1rem;
    }

    &__button {
        width: 100%;
        margin-top: 20px;
    }

    /* Сообщения об ошибках */
    &__error {
        color: red;
        text-align: center;
        margin-top: 0.3rem;
    }



    /* Блок переключения темы */
    &__theme-toggle {
        display: flex;
        width: 100%;
        justify-content: flex-end;
        margin-bottom: 1.5rem;

        .auth-form__theme-btn {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(240, 243, 250, 0.92);
            border: 1px solid rgba(120,130,150,0.10);
            box-shadow: 0 2px 8px 0 rgba(32, 45, 72, 0.07);
            cursor: pointer;
            transition:
                background 0.16s,
                border-color 0.16s,
                box-shadow 0.18s;

            .pi {
                color: #4662a5;
                font-size: 1.1rem;
                transition: color 0.16s;
            }

            &:hover, &:focus-visible {
                background: rgba(220, 225, 242, 1);
                border-color: #4662a5;
                box-shadow: 0 4px 14px 0 rgba(32, 45, 72, 0.13);
            }

            &:active {
                background: rgba(195, 205, 230, 1);
            }
        }
    }

    /* Темная тема */
    .app-dark &__theme-toggle .auth-form__theme-btn {
        background: rgba(36, 40, 56, 0.96); // чуть светлее основного
        border: 1px solid rgba(120,130,160,0.13);

        .pi {
            color: #e8ecf9;
        }

        &:hover, &:focus-visible {
            background: rgba(46, 54, 79, 1);
            border-color: #7ca1ff;
        }
        &:active {
            background: rgba(30, 36, 48, 0.93);
        }
    }
}

/* Стили иконок для поля пароля */
.pi-eye {
    transform: scale(1.6);
    margin-right: 1rem;
}

.pi-eye-slash {
    transform: scale(1.6);
    margin-right: 1rem;
}

/* Переопределения для темной темы */
.app-dark .login {
    background-color: var(--p-surface-950);
}

.app-dark .auth-form__box {
    background-color: var(--p-surface-900);
}

.app-dark .auth-form__gradient {
    background: linear-gradient(
            180deg,
            var(--p-primary-800) 10%,
            rgba(33, 150, 243, 0.04) 30%
    );
}

.app-dark .auth-form__label {
    color: var(--p-surface-0);
}

.app-dark .auth-form__input {
    background-color: var(--p-surface-800) !important;
    color: var(--p-surface-0) !important;

    &::placeholder {
        color: var(--p-text-muted-color, #b0b7c3) !important;
        opacity: 1;
    }
}

.app-dark .auth-form__password :deep(input) {
    background-color: var(--p-surface-800) !important;
    color: var(--p-surface-0) !important;

    &::placeholder {
        color: var(--p-text-muted-color, #b0b7c3) !important;
        opacity: 1;
    }
}

.app-dark .auth-form__subtitle {
    color: var(--p-text-muted-color, #b0b7c3);
}
</style>

<script setup lang="ts">
/*
 * Компонент формы активации аккаунта
 *
 * Основные функции:
 * - Ввод персональных данных для активации аккаунта
 * - Валидация введенных данных (обязательные поля, форматы)
 * - Отправка данных на сервер для активации
 * - Переключение между формами авторизации
 *
 * Особенности:
 * - Комплексная валидация полей (СНИЛС, email, телефон)
 * - Требуется либо email, либо телефон
 * - Интеграция с authStore для управления состоянием
 * - Использование кастомного компонента InputWithValidation
 *
 * Используемые хранилища:
 * - authStore: управление процессом авторизации/активации
 * - feedbackStore: обработка состояния загрузки
 *
 * Подключенные компоненты:
 * - InputWithValidation: компонент с валидацией для СНИЛС
 */

// Импорты Vue и сторонних библиотек
import { ref } from 'vue'

// Импорты хранилищ Pinia
import { useAuthStore } from '@/refactoring/modules/authStore/stores/authStore'
import { useFeedbackStore } from '@/refactoring/modules/feedback/stores/feedbackStore'

// Вспомогательные функции и утилиты
import { toApiDate } from '@/refactoring/utils/formatters'

// Импорты дочерних компонентов
import InputWithValidation from '@/refactoring/modules/authStore/components/InputWithValidation.vue'

// Инициализация хранилищ
const authStore = useAuthStore()
const feedbackStore = useFeedbackStore()

// Реактивные данные формы
const snils = ref('') // Номер СНИЛС
const lastName = ref('') // Фамилия пользователя
const firstName = ref('') // Имя пользователя
const middleName = ref('') // Отчество пользователя (необязательное)
const birthDate = ref<Date | null>(null) // Дата рождения
const email = ref('') // Email пользователя
const phoneNumber = ref('') // Номер телефона


// Рефы для валидации
const snilsInputRef = ref() // Ссылка на компонент валидации СНИЛС

// Регулярные выражения для валидации
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/ // Валидация email
const phoneRegex = /^(\+7|8|7)?\d{10}$/ // Валидация телефона

// Ошибки валидации
const lastNameError = ref('') // Ошибка фамилии
const firstNameError = ref('') // Ошибка имени
const birthDateError = ref('') // Ошибка даты рождения
const emailError = ref('') // Ошибка email
const phoneError = ref('') // Ошибка телефона

/**
 * Очищает номер телефона от лишних символов
 * - Удаляет все нецифровые символы
 * - Используется перед валидацией и отправкой на сервер
 */
const cleanPhone = (val: string) => val.replace(/\D/g, '')

/**
 * Валидирует обязательные поля формы
 * - Проверяет что поле не пустое
 * - Возвращает текст ошибки или пустую строку
 */
const validateRequiredField = (value: string, fieldName: string) => {
    if (!value.trim()) {
        return `Пожалуйста, введите ${fieldName}`
    }
    return ''
}

/**
 * Валидирует дату рождения
 * - Проверяет что дата выбрана
 * - Устанавливает ошибку в birthDateError
 * - Возвращает boolean результат валидации
 */
const validateBirthDate = () => {
    birthDateError.value = birthDate.value ? '' : 'Пожалуйста, укажите дату рождения'
    return !!birthDate.value
}

/**
 * Валидирует email по регулярному выражению
 * - Проверяет соответствие формату email
 * - Устанавливает ошибку в emailError
 * - Возвращает boolean результат валидации
 */
const validateEmail = () => {
    emailError.value = ''
    if (email.value && !emailRegex.test(email.value)) {
        emailError.value = 'Некорректный email'
        return false
    }
    return true
}

/**
 * Валидирует номер телефона
 * - Очищает номер перед проверкой
 * - Проверяет соответствие формату телефона
 * - Устанавливает ошибку в phoneError
 * - Возвращает boolean результат валидации
 */
const validatePhone = () => {
    phoneError.value = ''
    if (phoneNumber.value && !phoneRegex.test(cleanPhone(phoneNumber.value))) {
        phoneError.value = 'Некорректный номер телефона'
        return false
    }
    return true
}

/**
 * Комплексная валидация всей формы
 * - Проверяет все обязательные поля
 * - Валидирует СНИЛС через ref компонент
 * - Проверяет что указан email или телефон
 * - Возвращает boolean результат валидации
 */
const validateForm = async () => {
    // Валидация обязательных полей
    lastNameError.value = validateRequiredField(lastName.value, 'фамилию')
    firstNameError.value = validateRequiredField(firstName.value, 'имя')
    const isBirthDateValid = validateBirthDate()

    // Валидация СНИЛС
    const isSnilsValid = await snilsInputRef.value?.validate()

    // Валидация email или телефона
    const isEmailValid = validateEmail()
    const isPhoneValid = validatePhone()

    // Проверка что хотя бы одно из полей (email или телефон) заполнено
    const isContactInfoProvided = email.value || phoneNumber.value
    if (!isContactInfoProvided) {
        emailError.value = 'Укажите email или номер телефона'
        phoneError.value = 'Укажите email или номер телефона'
    }

    return (
        isSnilsValid &&
        !lastNameError.value &&
        !firstNameError.value &&
        isBirthDateValid &&
        isEmailValid &&
        isPhoneValid &&
        isContactInfoProvided
    )
}

/**
 * Обработчик отправки формы
 * - Выполняет валидацию формы
 * - Формирует payload для отправки
 * - Вызывает метод активации аккаунта из authStore
 */
const handleSubmit = async () => {
    if (!(await validateForm())) return

    const payload = {
        snils: snils.value,
        last_name: lastName.value,
        first_name: firstName.value,
        middle_name: middleName.value,
        birth_date: toApiDate(birthDate.value) || '',
        email: email.value,
        phone_number: phoneNumber.value ? cleanPhone(phoneNumber.value) : ''
    }

    await authStore.activateAccount(payload)
}

/**
 * Переключает на форму входа
 * - Сбрасывает флаги активации и восстановления
 * - Устанавливает флаг формы входа
 */
const showLoginForm = () => {
    authStore.isResetPassword = false
    authStore.isLogin = true
}
</script>

<!--
  Шаблон формы:
  - Поля ввода персональных данных
  - Валидационные сообщения об ошибках
  - Кнопки отправки формы и отмены
  - Стилизованные контейнеры и разделители
-->
<template>
    <div class="auth-form__form-container">
        <form @submit.prevent="handleSubmit">
            <input-with-validation
                ref="snilsInputRef"
                v-model="snils"
                label="СНИЛС"
                placeholder="Введите СНИЛС"
            />

            <div class="auth-form__input-container">
                <label for="lastName" class="auth-form__label">Фамилия</label>
                <app-inputtext
                    id="lastName"
                    v-model="lastName"
                    placeholder="Введите фамилию"
                    class="auth-form__input"
                    :class="{ 'auth-form__input--invalid': lastNameError }"
                />
                <div v-if="lastNameError" class="auth-form__error">{{ lastNameError }}</div>
            </div>

            <div class="auth-form__input-container">
                <label for="firstName" class="auth-form__label">Имя</label>
                <app-inputtext
                    id="firstName"
                    v-model="firstName"
                    placeholder="Введите имя"
                    class="auth-form__input"
                    :class="{ 'auth-form__input--invalid': firstNameError }"
                />
                <div v-if="firstNameError" class="auth-form__error">{{ firstNameError }}</div>
            </div>

            <div class="auth-form__input-container">
                <label for="middleName" class="auth-form__label">Отчество (если есть)</label>
                <app-inputtext
                    id="middleName"
                    v-model="middleName"
                    placeholder="Введите отчество"
                    class="auth-form__input"
                />
            </div>

            <div class="auth-form__input-container">
                <label for="birthDate" class="auth-form__label">Дата рождения</label>
                <DatePicker
                    id="birthDate"
                    v-model="birthDate"
                    placeholder="Выберите дату"
                    dateFormat="dd.mm.yy"
                    showIcon
                    class="auth-form__input"
                    :class="{ 'auth-form__input--invalid': birthDateError }"
                />
                <div v-if="birthDateError" class="auth-form__error">{{ birthDateError }}</div>
            </div>

            <div class="auth-form__input-container">
                <label for="email" class="auth-form__label">Email</label>
                <app-inputtext
                    id="email"
                    v-model="email"
                    placeholder="Введите email"
                    class="auth-form__input"
                    :class="{ 'auth-form__input--invalid': emailError }"
                    @blur="validateEmail"
                />
                <div v-if="emailError" class="auth-form__error">{{ emailError }}</div>
            </div>

            <div class="auth-form__or-divider">или</div>

            <div class="auth-form__input-container">
                <label for="phone" class="auth-form__label">Номер телефона</label>
                <app-inputtext
                    id="phone"
                    v-model="phoneNumber"
                    placeholder="Введите номер телефона"
                    class="auth-form__input"
                    :class="{ 'auth-form__input--invalid': phoneError }"
                    @blur="validatePhone"
                />
                <div v-if="phoneError" class="auth-form__error">{{ phoneError }}</div>
            </div>

            <Button
                type="submit"
                label="Активировать аккаунт"
                class="auth-form__button"
                :loading="feedbackStore.isGlobalLoading"
            />

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

    &__input-container {
        margin-bottom: 1rem;
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

    &__label {
        display: block;
        color: var(--surface-900);
        font-size: 1.25rem;
        font-weight: 500;
        margin-block: 0.5rem;
    }

    &__input {
        width: 100%;


        &--invalid {
            border-color: red !important;
        }

        :deep(.p-datepicker) {
            background-color: rgb(232, 240, 254);
        }
    }

    &__error {
        color: red;
        text-align: center;
        margin-top: 0.3rem;
    }

    &__or-divider {
        display: flex;
        align-items: center;
        margin: 1rem 0;
        color: var(--text-muted-color);
        text-align: center;

        &::before,
        &::after {
            content: '';
            flex: 1;
            border-bottom: 1px solid var(--surface-300);
        }

        &::before {
            margin-right: 1rem;
        }

        &::after {
            margin-left: 1rem;
        }
    }

    &__button {
        width: 100%;
        margin-top: 20px;
    }
}

.app-dark {
    .auth-form {
        &__label {
            color: var(--p-surface-0);
        }

        &__input {
            color: var(--p-surface-0) !important;

            &::placeholder {
                color: var(--p-text-muted-color, #b0b7c3) !important;
                opacity: 1;
            }

            :deep(.p-datepicker) {
                background-color: var(--p-surface-800);
                color: var(--p-surface-0);
            }
        }

        &__or-divider {
            color: var(--p-text-muted-color);

            &::before,
            &::after {
                border-bottom-color: var(--p-surface-600);
            }
        }
    }
}
</style>

<script setup lang="ts">
/*
 * Компонент поля ввода кода 2FA из телеграм бота
 *
 * Основные функции:
 * - Ввод только цифр
 * - Валидация на пустое поле
 * - Интеграция с v-model
 * - Визуализация ошибок валидации
 */

import { computed, ref } from 'vue'

const props = defineProps({
    modelValue: {
        type: String,
        required: true
    },
    label: {
        type: String,
        default: 'Код из телеграм бота'
    },
    placeholder: {
        type: String,
        default: 'Введите цифровой код'
    },
    disabled: {
        type: Boolean,
        default: false
    },
    id: {
        type: String,
        default: 'twoFaCode'
    }
})

const emit = defineEmits(['update:modelValue'])

const error = ref('')

const value = computed({
    get() {
        return props.modelValue
    },
    set(val: string) {
        // Разрешаем ввод только цифр
        const cleanedValue = val.replace(/\D/g, '')
        emit('update:modelValue', cleanedValue)
    }
})

const validate = () => {
    error.value = ''
    if (!value.value) {
        error.value = 'Пожалуйста, введите код из телеграм бота'
        return false
    }
    return true
}

defineExpose({ validate })
</script>

<template>
    <div class="auth-form__input-container">
        <label :for="id" class="auth-form__label">
            {{ label }}
        </label>
        <app-inputtext
            :id="id"
            type="number"
            inputmode="numeric"
            :placeholder="placeholder"
            v-model="value"
            class="auth-form__input"
            :class="{ 'auth-form__input--invalid': error }"
            :disabled="disabled"
        />
        <div v-if="error" class="auth-form__error">{{ error }}</div>
    </div>
</template>

<style lang="scss" scoped>
.auth-form {
    &__input-container {
        margin-bottom: 1rem;
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

    &__error {
        color: red;
        text-align: center;
        margin-top: 0.5rem;
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
        }
    }
}
</style>

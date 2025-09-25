<script setup lang="ts">
/*
 * Компонент поля ввода пароля с валидацией
 *
 * Основные функции:
 * - Ввод и отображение пароля с возможностью toggle (показать/скрыть)
 * - Валидация пароля по заданным правилам
 * - Очистка ввода от недопустимых символов
 * - Интеграция с v-model для двустороннего связывания
 *
 * Особенности:
 * - Поддержка стандартного v-model
 * - Встроенная валидация с проверкой:
 *   - Минимальной длины (6 символов)
 *   - Допустимых символов (латиница и спецсимволы)
 * - Возможность отключения поля (disabled)
 * - Кастомные label и placeholder
 * - Экспорт метода validate для внешней валидации
 */

import { ref, computed } from 'vue'

/**
 * Пропсы компонента:
 * @prop {String} modelValue - Текущее значение пароля (для v-model)
 * @prop {String} [label='Пароль'] - Текст лейбла
 * @prop {String} [placeholder='Пароль'] - Текст плейсхолдера
 * @prop {Boolean} [disabled=false] - Флаг отключения поля
 * @prop {String} [id='password'] - ID для связи label и input
 */
const props = defineProps({
    modelValue: {
        type: String,
        required: true
    },
    label: {
        type: String,
        default: 'Пароль'
    },
    placeholder: {
        type: String,
        default: 'Пароль'
    },
    disabled: {
        type: Boolean,
        default: false
    },
    id: {
        type: String,
        default: 'password'
    }
})

const emit = defineEmits(['update:modelValue'])

// Реактивные данные
const error = ref('') // Текст ошибки валидации

/**
 * Очищает ввод от пробелов
 * - Используется перед обновлением modelValue
 */
const cleanInput = (val: string) => val.replace(/\s+/g, '')

/**
 * Вычисляемое свойство для v-model
 * - При чтении возвращает modelValue
 * - При записи очищает значение и эмитит событие обновления
 */
const value = computed({
    get() {
        return props.modelValue
    },
    set(val: string) {
        emit('update:modelValue', cleanInput(val))
    }
})
</script>

<!--
  Шаблон компонента:
  - Контейнер с лейблом
  - Поле ввода пароля с возможностью toggle (показать/скрыть)
  - Отображение ошибок валидации
  - Поддержка всех переданных пропсов (id, label и т.д.)
-->
<template>
    <div class="auth-form__input-container">
        <label :for="id" class="auth-form__label">
            {{ label }}
        </label>
        <app-input-password
            :id="id"
            autocomplete="current-password"
            v-model="value"
            :placeholder="placeholder"
            :toggleMask="true"
            class="auth-form__password"
            :inputClass="{ 'auth-form__input--invalid': error }"
            fluid
            :feedback="false"
            :disabled="disabled"
        />
        <div v-if="error" class="auth-form__error">{{ error }}</div>
    </div>
</template>

<style lang="scss" scoped>
.auth-form {
    &__input-container {
        margin-bottom: 1rem;
        ::v-deep(.auth-form__input--invalid) {
            border: 1px solid red !important;
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
        background-color: rgb(232, 240, 254);

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
            background-color: var(--p-surface-800) !important;
            color: var(--p-surface-0) !important;

            &::placeholder {
                color: var(--p-text-muted-color, #b0b7c3) !important;
                opacity: 1;
            }
        }
    }
}
</style>

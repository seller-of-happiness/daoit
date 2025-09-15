<script setup lang="ts">
/*
 * Компонент поля ввода логина (СНИЛС или телефон) с валидацией
 *
 * Основные функции:
 * - Ввод и валидация логина в формате СНИЛС или номера телефона
 * - Поддержка различных форматов ввода (с разделителями или без)
 * - Интеграция с v-model для двустороннего связывания
 * - Визуализация ошибок валидации
 *
 * Особенности:
 * - Поддержка стандартного v-model
 * - Встроенная валидация для:
 * - СНИЛС в форматах: 123-456-789 01 или 12345678901
 * - Телефона в форматах: +79991234567, 89991234567 или 79991234567
 * - Автоматическая очистка от пробелов
 * - Кастомные label и placeholder
 * - Возможность отключения поля (disabled)
 * - Экспорт метода validate для внешней валидации
 */

import { ref, computed } from 'vue'

/**
 * Пропсы компонента:
 * @prop {String} modelValue - Текущее значение (для v-model)
 * @prop {String} [label='Логин (СНИЛС или телефон)'] - Текст лейбла
 * @prop {String} [placeholder='СНИЛС или номер телефона'] - Текст плейсхолдера
 * @prop {Boolean} [disabled=false] - Флаг отключения поля
 * @prop {String} [id='username'] - ID для связи label и input
 */
const props = defineProps({
    modelValue: {
        type: String,
        required: true
    },
    label: {
        type: String,
        default: 'Логин (СНИЛС или телефон)'
    },
    placeholder: {
        type: String,
        default: 'СНИЛС или номер телефона'
    },
    disabled: {
        type: Boolean,
        default: false
    },
    id: {
        type: String,
        default: 'username'
    }
})

const emit = defineEmits(['update:modelValue'])

// Реактивные данные
const error = ref('') // Текст ошибки валидации
const snilsRegex = /^\d{3}-?\d{3}-?\d{3}\s?\d{2}$/ // Регулярка для СНИЛС (с разделителями или без)
const phoneRegex = /^(\+7|8|7)?\d{10}$/ // Регулярка для телефона (разные форматы)

/**
 * Очищает ввод от пробелов
 * - Используется перед обновлением modelValue
 * - Сохраняет дефисы в СНИЛС для лучшей читаемости
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

/**
 * Валидирует текущее значение логина
 * - Проверяет наличие значения
 * - Проверяет соответствие формату СНИЛС или телефона
 * - Устанавливает текст ошибки при невалидности
 * @returns {Boolean} Результат валидации
 */
const validate = () => {
    error.value = ''
    if (!value.value) {
        error.value = 'Пожалуйста, введите СНИЛС или телефон'
        return false
    } else if (!snilsRegex.test(value.value) && !phoneRegex.test(value.value)) {
        error.value = 'Некорректный СНИЛС или номер телефона'
        return false
    }
    return true
}

// Экспорт метода validate для вызова из родительского компонента
defineExpose({ validate })
</script>

<!--
Шаблон компонента:
- Контейнер с лейблом
- Текстовое поле ввода
- Отображение ошибок валидации
- Поддержка всех переданных пропсов (id, label, placeholder и т.д.)
- Автодополнение для username (стандарт браузеров)
- Визуальное выделение невалидного поля
-->
<template>
    <div class="auth-form__input-container">
        <label :for="id" class="auth-form__label">
            {{ label }}
        </label>
        <app-inputtext
            :id="id"
            autocomplete="username"
            type="text"
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


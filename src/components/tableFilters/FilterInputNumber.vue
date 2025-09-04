<script setup lang="ts">
/*
* Компонент числового ввода с FloatLabel.
*
* Основные функции:
* - Ввод числовых значений с валидацией
* - Поддержка состояния загрузки (блокировка ввода)
* - Автоматическая нормализация null/undefined значений
* - Десятичный режим ввода (mode="decimal")
* - Интеграция с FloatLabel для улучшенного UX
* - Кастомизируемый placeholder и классы
*/

import { watch } from 'vue'

// Определение пропсов компонента
defineProps({
    loading: {
        type: Boolean,
        default: false // Флаг состояния загрузки (блокирует ввод)
    },
    placeholder: {
        type: String,
        default: '№' // Текст плейсхолдера по умолчанию
    },
    labelFor: {
        type: String,
        required: true // Обязательный ID для связи label с input
    },
    className: {
        type: String // Дополнительные CSS классы
    },
})

// Двустороннее связывание числового значения
const inputValue = defineModel<number | null>()

// Наблюдатель за изменением значения
watch(inputValue, (newValue) => {
    // Нормализация undefined/null значений к null
    if (newValue === undefined || newValue === null) {
        inputValue.value = null
    }
})
</script>

<template>
    <!-- Компонент FloatLabel для плавающего лейбла -->
    <FloatLabel :class="className" variant="on">
        <!--
          Компонент числового ввода:
          - v-model: двустороннее связывание значения
          - disabled: блокировка при загрузке
          - inputId: связь с лейблом
          - mode: десятичный формат ввода
          - class: стилизация
        -->
        <InputNumber
            v-model="inputValue"
            :disabled="loading"
            :inputId="labelFor"
            mode="decimal"
            class="w-full"
        />
        <!-- Лейбл для поля ввода -->
        <label :for="labelFor">{{ placeholder }}</label>
    </FloatLabel>
</template>

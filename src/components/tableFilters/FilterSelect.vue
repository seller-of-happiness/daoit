<script setup lang="ts">
/*
* Компонент Select с FloatLabel для выбора одного значения.
*
* Основные функции:
* - Одиночный выбор значения из списка
* - Поддержка состояния загрузки (блокировка интерфейса)
* - Возможность очистки выбора (showClear)
* - Адаптивная ширина (col-span responsive classes)
* - Интеграция с FloatLabel для улучшенного UX
* - Поддержка кастомного placeholder
*/

// Двустороннее связывание выбранного значения
const filterSelect = defineModel()

// Пропсы компонента
defineProps({
    loading: {
        type: Boolean,
        default: false, // Флаг состояния загрузки (блокирует интерактивность)
    },
    placeholder: {
        type: String,
        default: 'Select an option', // Текст плейсхолдера по умолчанию
    },
    labelFor: {
        type: String,
        required: true, // Обязательный ID для связи label с select
    },
    options: {
        type: Array,
        required: true, // Массив доступных опций для выбора
    },
})
</script>

<template>
    <!-- FloatLabel с адаптивными классами ширины -->
    <FloatLabel class="col-span-12 lg:col-span-6 xl:col-span-3" variant="on">
        <!--
          Компонент Select:
          - v-model: связь с выбранным значением
          - loading/disabled: состояние загрузки
          - inputId: связь с лейблом
          - options: массив доступных опций
          - showClear: кнопка очистки выбора
          - class: растягивание на всю ширину
        -->
        <Select
            v-model="filterSelect"
            :loading="loading"
            :disabled="loading"
            :inputId="labelFor"
            :options="options"
            showClear
            class="w-full"
        />
        <!-- Лейбл для поля выбора -->
        <label :for="labelFor">{{ placeholder }}</label>
    </FloatLabel>
</template>

<!-- Стили компонента (пустые) -->
<style lang="scss" scoped></style>

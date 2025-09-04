<script setup lang="ts">
/*
* Компонент MultiSelect с FloatLabel для выбора нескольких опций.
*
* Основные функции:
* - Множественный выбор опций с чипсами (chips)
* - Поддержка состояния загрузки (блокировка интерфейса)
* - Фильтрация опций при вводе
* - Кастомизация отображаемых полей (optionLabel/optionValue)
* - Автоматическая подпись (FloatLabel)
* - Ограничение количества отображаемых выбранных элементов (maxSelectedLabels)
* - Возможность очистки выбора (showClear)
*/

// Определение пропсов компонента
defineProps({
    loading: Boolean, // Состояние загрузки (блокирует интерактивность)
    placeholder: { type: String, default: 'Select an option' }, // Текст плейсхолдера
    labelFor: { type: String, required: true }, // ID для связи с лейблом
    options: { type: Array, required: true }, // Массив доступных опций
    className: String, // Дополнительные CSS-классы
    optionLabel: { type: String, default: 'name' }, // Поле для отображения опций
    optionValue: { type: String, default: 'id' }, // Поле для значения опций
    display: { type: String, default: 'chip' } // Стиль отображения выбранных элементов
})

// Двустороннее связывание выбранных значений
const selectedDepartments = defineModel()
</script>

<template>
    <!-- Компонент FloatLabel для улучшенного UX -->
    <FloatLabel :class="className" variant="on">
        <!--
          Компонент MultiSelect:
          - v-model: связь с выбранными значениями
          - showClear: кнопка очистки выбора
          - loading/disabled: состояние загрузки
          - options: массив доступных опций
          - display: стиль отображения (chip)
          - optionLabel/optionValue: кастомизация полей
          - filter: включение фильтрации
          - maxSelectedLabels: ограничение видимых выбранных элементов
        -->
        <MultiSelect
            v-model="selectedDepartments"
            showClear
            :loading="loading"
            :disabled="loading"
            :options="options"
            :display="display"
            :option-label="optionLabel"
            :option-value="optionValue"
            filter
            :maxSelectedLabels="3"
            class="w-full"
            style="min-height: 33px"
        />
        <!-- Лейбл для поля ввода -->
        <label :for="labelFor">{{ placeholder }}</label>
    </FloatLabel>
</template>

<script setup lang="ts">
/*
* Компонент MultiSelect с фильтрацией для выбора нескольких значений.
*
* Основные функции:
* - Множественный выбор значений с возможностью фильтрации
* - Поддержка состояния загрузки (блокировка интерфейса)
* - Кастомизация отображаемых полей (optionLabel/optionValue)
* - Обработка событий фильтрации и изменения
* - Ограничение количества отображаемых выбранных элементов
* - Возможность очистки выбора (showClear)
* - Интеграция с FloatLabel для улучшенного UX
*/

import type { MultiSelectFilterEvent } from 'primevue/multiselect'
import type { IFilterProps } from '@/refactoring/types/IFilterProps'

// Двустороннее связывание выбранных значений (массив чисел)
const filterSelectMultiple = defineModel<number[]>()

/**
 * Обработчик события фильтрации
 * @param e - Событие фильтрации MultiSelect
 */
function onFilter(e: MultiSelectFilterEvent) {
    // Логирование события фильтрации (при необходимости)
}

// Получение пропсов с типизацией через IFilterProps
defineProps<IFilterProps>()
</script>

<template>
    <!-- Компонент FloatLabel для плавающей подписи -->
    <FloatLabel :class="className" variant="on">
        <!--
          Компонент MultiSelect:
          - v-model: связь с выбранными значениями
          - loading/disabled: состояние загрузки
          - id: связь с лейблом
          - options: массив доступных опций
          - display: стиль отображения выбранных элементов
          - optionLabel/optionValue: кастомизация полей
          - showClear: кнопка очистки выбора
          - filter: включение фильтрации
          - @filter: обработчик фильтрации
          - max-selected-labels: лимит отображаемых выбранных элементов
          - @change: обработчик изменения значения
          - class/style: базовые стили
        -->
        <MultiSelect
            v-model="filterSelectMultiple"
            :loading="loading"
            :disabled="loading"
            :id="labelFor"
            :options="options"
            :display="display"
            :option-label="optionLabel"
            :option-value="optionValue"
            showClear
            filter
            @filter="onFilter"
            :max-selected-labels="3"
            @change="changeHandler"
            class="w-full"
            style="min-height: 33px"
        />
        <!-- Лейбл для поля ввода -->
        <label :for="labelFor">{{ placeholder }}</label>
    </FloatLabel>
</template>

<!-- Стили компонента (пустые) -->
<style lang="scss" scoped></style>

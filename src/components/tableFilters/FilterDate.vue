<script setup lang="ts">
/*
 * Компонент выбора диапазона дат с временем.
 *
 * Основные функции:
 * - Позволяет выбрать начальную и конечную дату с временем
 * - Использует 24-часовой формат времени
 * - Формат даты: день.месяц.год (dd.mm.yy)
 * - Поддерживает состояние загрузки (блокирует ввод)
 * - Адаптивный дизайн (вертикальное расположение на мобильных устройствах)
 * - Работает через v-model для двустороннего связывания данных
 */

// Пропсы:
// - loading: состояние загрузки (true/false)
// - withTime: управляет выбором времени (по умолчанию включено)

import { useApiStore } from '@/refactoring/modules/apiStore/stores/apiStore'


const apiStore = useApiStore()

defineProps({ loading: Boolean, withTime: { type: Boolean, default: true } })

// Модель для даты начала периода (двустороннее связывание)
const dateStart = defineModel<Date | null>('dateStart')

// Модель для даты окончания периода (двустороннее связывание)
const dateEnd = defineModel<Date | null>('dateEnd')

function setRange(start: Date | null, end: Date | null) {
    console.log('setRange', start, end)
    dateStart.value = start
    dateEnd.value = end

    apiStore.filters.created_after = start
    apiStore.filters.created_before = end
}
defineExpose({ setRange })
</script>

<template>
    <!-- Основной контейнер компонента -->
    <div>
        <!-- Заголовок блока выбора даты -->
        <p class="mb-4 md:mb-2">Дата и время</p>

        <!-- Контейнер с полями ввода (адаптивный макет) -->
        <div class="flex flex-col md:flex-row gap-5 md:gap-2">
            <!-- Блок выбора начальной даты -->
            <FloatLabel variant="on" class="">
                <!--
                  Компонент Calendar для выбора даты начала:
                  - v-model: связь с dateStart
                  - disabled: блокировка при загрузке
                  - showTime: включает выбор времени
                  - hourFormat: 24-часовой формат
                  - dateFormat: формат dd.mm.yy
                  - inputId: идентификатор для связи с label
                -->
                <DatePicker
                    v-model="dateStart"
                    :disabled="loading"
                    :showTime="withTime"
                    hourFormat="24"
                    dateFormat="dd.mm.yy"
                    inputId="timeSelectStart"
                />
                <label for="timeSelectStart">От</label>
            </FloatLabel>

            <!-- Блок выбора конечной даты -->
            <FloatLabel variant="on" class="">
                <!--
                  Компонент Calendar для выбора даты окончания:
                  - v-model: связь с dateEnd
                  - disabled: блокировка при загрузке
                  - showTime: включает выбор времени
                  - hourFormat: 24-часовой формат
                  - dateFormat: формат dd.mm.yy
                  - inputId: идентификатор для связи с label
                -->
                <Calendar
                    v-model="dateEnd"
                    :disabled="loading"
                    :showTime="withTime"
                    hourFormat="24"
                    dateFormat="dd.mm.yy"
                    inputId="timeSelectEnd"
                />
                <label for="timeSelectEnd">До</label>
            </FloatLabel>
        </div>
    </div>
</template>

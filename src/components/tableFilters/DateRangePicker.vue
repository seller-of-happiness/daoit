<script setup lang="ts">
/**
 * Компонент: DateRangePicker — универсальный фильтр по диапазону дат.
 *
 * Назначение:
 * - Управляет парой дат «От»/«До» (с поддержкой времени).
 * - Обновляет значения в переданном сторе (через props.store.filters[afterKey/beforeKey]).
 * - Дебаунсит сетевые запросы при изменении дат и эмитит событие 'change'.
 * - Позволяет быстро очистить выбранные даты.
 *
 * Контракты и соглашения:
 * - Ожидается, что `props.store` содержит объект `filters` с ключами, заданными в `afterKey`/`beforeKey`.
 * - Тип значений дат в `filters`: `Date | null`.
 * - Компонент **не** делает сетевые запросы сам — он эмитит `change`, а родитель инициирует загрузку.
 *
 * Пропсы:
 * - store: { filters: Record<string, Date | null> } — целевое хранилище с объектом filters. (обязательный)
 * - loading: boolean — внешний индикатор загрузки для блокировки UI (опциональный).
 * - afterKey: string — имя ключа в store.filters для даты «От» (default: 'created_after').
 * - beforeKey: string — имя ключа в store.filters для даты «До» (default: 'created_before').
 * - dateOnly: boolean - режим отображения только даты (без времени) (default: false)
 *
 * События:
 * - 'change' — эмитится с дебаунсом 120мс при любом изменении диапазона.
 *
 * Локальное состояние:
 * - dateAfterLocal / dateBeforeLocal — локальные копии дат, синхронизированные с store.filters.
 * - datesKey — числовой ключ для принудительного перерендеринга инпутов даты.
 * - dateFetchTimer — идентификатор таймера дебаунса.
 *
 * Поток данных:
 * UI → onAfterChange/onBeforeChange → applyDatePatch → (обновление local и store.filters) → scheduleDateFetch() → emit('change')
 */

import { ref, onUnmounted, watch } from 'vue'

/**
 * Пропсы компонента.
 * store: объект с полем filters, в котором будут изменяться значения afterKey/beforeKey.
 * loading: внешний флаг загрузки (для блокировки контролов в шаблоне, если нужно).
 * afterKey/beforeKey: имена ключей в store.filters для дат «От»/«До».
 */
const props = defineProps({
    store: {
        type: Object,
        required: true
    },
    loading: {
        type: Boolean,
        default: false
    },
    afterKey: {
        type: String,
        default: 'created_after'
    },
    beforeKey: {
        type: String,
        default: 'created_before'
    },
    dateOnly: {
        type: Boolean,
        default: false
    }
})

/**
 * События компонента.
 * - change: эмитится при изменении диапазона (с дебаунсом).
 */
const emit = defineEmits(['change'])

// ================== STATE ==================

/**
 * Локальное значение даты «От».
 * Инициализируется из store.filters[afterKey], поддерживает двустороннюю синхронизацию.
 */
const dateAfterLocal = ref<Date | null>(props.store.filters[props.afterKey] ?? null)

/**
 * Локальное значение даты «До».
 * Инициализируется из store.filters[beforeKey], поддерживает двустороннюю синхронизацию.
 */
const dateBeforeLocal = ref<Date | null>(props.store.filters[props.beforeKey] ?? null)

/**
 * Ключ для принудительного перерендеринга контролов даты (иногда нужно, чтобы сброс отразился в UI).
 */
const datesKey = ref(0)

/**
 * Идентификатор таймера дебаунса сетевого запроса/эмита 'change'.
 * Используем window.setTimeout → тип number | undefined.
 */
let dateFetchTimer: number | undefined

/**
 * Дебаунс эмита события 'change'.
 * Запускает emit('change') через 120мс после последнего вызова.
 * Используется после любых изменений диапазона дат.
 */
const scheduleDateFetch = () => {
    if (dateFetchTimer) clearTimeout(dateFetchTimer)
    dateFetchTimer = window.setTimeout(() => {
        emit('change')
    }, 120)
}

/**
 * Применяет патч к датам и синхронизирует значения со стором.
 *
 * Алгоритм:
 * 1) Если в patch есть 'start' — обновляем dateAfterLocal и props.store.filters[afterKey].
 * 2) Если в patch есть 'end'   — обновляем dateBeforeLocal и props.store.filters[beforeKey].
 * 3) Планируем дебаунс-эмит 'change'.
 *
 * @param patch Объект вида { start?: Date|null; end?: Date|null }.
 */
const applyDatePatch = (patch: { start?: Date | null; end?: Date | null }) => {
    if ('start' in patch) {
        dateAfterLocal.value = patch.start ?? null
        props.store.filters[props.afterKey] = dateAfterLocal.value
    }
    if ('end' in patch) {
        dateBeforeLocal.value = patch.end ?? null
        props.store.filters[props.beforeKey] = dateBeforeLocal.value
    }
    scheduleDateFetch()
}

/**
 * Хендлер изменения начальной даты «От».
 * Принимает различные формы значения (Date | Date[] | (Date|null)[] | null | undefined),
 * нормализует к Date|null и вызывает applyDatePatch({ start }).
 *
 * @param value Значение из дата-пикера.
 */
const onAfterChange = (value: Date | Date[] | (Date | null)[] | null | undefined) => {
    const date = Array.isArray(value) ? value[0] : value
    applyDatePatch({ start: date instanceof Date ? date : null })
}

/**
 * Хендлер изменения конечной даты «До».
 * Аналогично onAfterChange: нормализует значение и вызывает applyDatePatch({ end }).
 *
 * @param value Значение из дата-пикера.
 */
const onBeforeChange = (value: Date | Date[] | (Date | null)[] | null | undefined) => {
    const date = Array.isArray(value) ? value[0] : value
    applyDatePatch({ end: date instanceof Date ? date : null })
}

/**
 * Сбрасывает обе даты (start/end) в null.
 * Увеличивает datesKey, чтобы форсировать перерендер датапикеров.
 */
const clearDates = () => {
    applyDatePatch({ start: null, end: null })
    datesKey.value++ // Форсируем перерендер
}

/**
 * Следит за внешним изменением store.filters[afterKey] и подтягивает его в локальное состояние.
 * Если значение меняется «снаружи», обновляем dateAfterLocal и инкрементим datesKey
 * для принудительного обновления UI при необходимости.
 */
watch(
    () => props.store.filters[props.afterKey],
    (newVal) => {
        if (newVal?.getTime() !== dateAfterLocal.value?.getTime()) {
            dateAfterLocal.value = newVal ?? null
            datesKey.value++
        }
    }
)

/**
 * Аналогичный вотчер для store.filters[beforeKey] → dateBeforeLocal.
 */
watch(
    () => props.store.filters[props.beforeKey],
    (newVal) => {
        if (newVal?.getTime() !== dateBeforeLocal.value?.getTime()) {
            dateBeforeLocal.value = newVal ?? null
            datesKey.value++
        }
    }
)

/**
 * Очистка таймера дебаунса при размонтировании компонента.
 */
onUnmounted(() => {
    if (dateFetchTimer) clearTimeout(dateFetchTimer)
})
</script>

<template>
    <div class="date-range-picker flex flex-col md:flex-row gap-4 items-end">
        <div class="flex-1 flex flex-col md:flex-row gap-4">
            <div class="flex-1">
                <label class="block font-bold mb-2" for="date_after_picker">От</label>
                <DatePicker
                    :key="`after-${datesKey}`"
                    v-model="dateAfterLocal"
                    :disabled="loading"
                    :showTime="!dateOnly"
                    showIcon
                    showButtonBar
                    hourFormat="24"
                    dateFormat="dd.mm.yy"
                    inputId="date_after_picker"
                    class="w-full"
                    :hideOnDateTimeSelect="true"
                    @update:model-value="onAfterChange"
                />
            </div>

            <div class="flex-1">
                <label class="block font-bold mb-2" for="date_before_picker">До</label>
                <DatePicker
                    :key="`before-${datesKey}`"
                    v-model="dateBeforeLocal"
                    :disabled="loading"
                    :showTime="!dateOnly"
                    showIcon
                    showButtonBar
                    hourFormat="24"
                    dateFormat="dd.mm.yy"
                    inputId="date_before_picker"
                    :hideOnDateTimeSelect="true"
                    class="w-full"
                    @update:model-value="onBeforeChange"
                />
            </div>
        </div>

        <Button
            v-if="dateAfterLocal || dateBeforeLocal"
            size="small"
            text
            severity="secondary"
            icon="pi pi-times"
            @click="clearDates"
            label="Очистить даты"
            aria-label="Очистить даты"
        />
    </div>
</template>

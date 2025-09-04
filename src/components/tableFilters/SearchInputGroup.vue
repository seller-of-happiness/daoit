<script setup lang="ts">
/**
 * Компонент SearchInputGroup - универсальный блок поиска с переключением режимов
 *
 * Основной функционал:
 * - Переключение между поиском по тексту и номеру
 * - Интеграция с различными хранилищами через props
 * - Поддержка дебаунса и обработки нажатия Enter
 * - Очистка поиска
 *
 * Props:
 * - store: Хранилище (apiStore или supportServiceStore)
 * - loading: Состояние загрузки
 * - searchKey: Ключ для текстового поиска в хранилище (по умолчанию 'search')
 * - numberKey: Ключ для числового поиска в хранилище (по умолчанию 'number')
 */

import { ref, watch } from 'vue'
import FilterInputNumber from '@/components/tableFilters/FilterInputNumber.vue'

/**
 * Пропсы:
 * - store: целевое хранилище с объектом filters (обязательный).
 * - loading: внешний индикатор загрузки для блокировки UI (опционально).
 * - searchKey: имя ключа текстового поиска в store.filters (по умолчанию 'search').
 * - numberKey: имя ключа числового поиска в store.filters (по умолчанию 'number').
 */
const props = defineProps({
    /** Хранилище, содержащее объект filters (ожидаются ключи searchKey/numberKey). */
    store: {
        type: Object,
        required: true
    },
    /** Флаг внешней загрузки для дизейбла инпутов/кнопок. */
    loading: {
        type: Boolean,
        default: false
    },
    /** Ключ в store.filters для текстового поиска. */
    searchKey: {
        type: String,
        default: 'search'
    },
    /** Ключ в store.filters для числового поиска. */
    numberKey: {
        type: String,
        default: 'number'
    }
})

/**
 * События:
 * - 'search' — эмитится после применения фильтров (как текстового, так и числового) и при очистке.
 */
const emit = defineEmits(['search'])

// ================== STATE ==================

/**
 * Локальное значение текстового инпута.
 * Инициализируется из store.filters[searchKey]; синхронизируется watch'ем ниже.
 */
const searchInput = ref<string>(props.store.filters[props.searchKey] || '')

/**
 * Текущий режим поиска: 'number' — по номеру, 'text' — по строке.
 * По умолчанию — 'number'.
 */
const numberMode = ref<'text' | 'number'>('number')


/**
 * Выполняет поиск с учётом текущего режима.
 *
 * Алгоритм:
 * - Режим 'number':
 *   1) Берём значение props.store.filters[numberKey], приводим к числу.
 *   2) Если конечное значение — конечное число → пишем его; иначе → null.
 *   3) Очищаем текстовый фильтр (searchKey = '').
 * - Режим 'text':
 *   1) Пишем searchInput в props.store.filters[searchKey].
 *   2) Сбрасываем числовой фильтр (numberKey = null).
 * - В конце эмитим 'search' для родителя (он сам решает, когда дергать API).
 */
const doSearch = () => {
    if (numberMode.value === 'number') {
        const n = props.store.filters[props.numberKey]
        props.store.filters[props.numberKey] = Number.isFinite(n as number) ? Number(n) : null
        props.store.filters[props.searchKey] = ''
    } else {
        props.store.filters[props.searchKey] = searchInput.value
        props.store.filters[props.numberKey] = null
    }
    emit('search')
}

/**
 * Полная очистка поиска.
 * - Сбрасывает оба фильтра в хранилище: searchKey → '', numberKey → null.
 * - Сбрасывает локальный input.
 * - Эмитит 'search' (родитель перезагружает данные).
 */
const clearSearch = () => {
    searchInput.value = ''
    props.store.filters[props.searchKey] = ''
    props.store.filters[props.numberKey] = null
    emit('search')
}

/**
 * Поддерживает обратную синхронизацию:
 * если store.filters[searchKey] изменился «снаружи», подтягиваем его в локальный input.
 */
watch(
    () => props.store.filters[props.searchKey],
    (val) => {
        if (val !== searchInput.value) searchInput.value = val
    }
)
</script>

<template>
    <InputGroup class="flex-1">
        <InputGroupAddon v-if="store.filters[numberKey] !== null">
            <Button icon="pi pi-times" severity="secondary" @click="clearSearch" />
        </InputGroupAddon>

        <div class="search-input-group__mode">
            <Select
                :options="[{label: '№', value: 'number'}, {label: 'Текст', value: 'text'}]"
                v-model="numberMode"
                option-label="label"
                option-value="value"
                class="w-full"
            />
        </div>

        <InputText
            v-if="numberMode==='text'"
            :loading="loading"
            v-model="searchInput"
            placeholder="Поиск"
            class="flex-1"
            @keyup.enter="doSearch"
        />
        <FilterInputNumber
            v-else
            labelFor="selectedNumber"
            :placeholder="'№'"
            :loading="loading"
            v-model="store.filters[numberKey]"
            @keyup.enter="doSearch"
            class="flex-1 input"
        />

        <InputGroupAddon>
            <Button icon="pi pi-search" severity="secondary" @click="doSearch" />
        </InputGroupAddon>
    </InputGroup>
</template>

<style scoped lang="scss">
.search-input-group {
    &__mode {
        flex: 0 0 110px;
        min-width: 110px;
        margin-right: 10px;
    }
}

.p-inputgroup .p-inputtext, .p-inputgroup .p-inputwrapper {
    width: 100% !important;
    height: 100% !important;
}

:deep(.p-inputnumber .p-inputtext) {
    border-radius: var(--p-multiselect-border-radius) 0 0 var(--p-multiselect-border-radius) !important;
}

:deep([data-pc-name="inputtext"]) {
    border-radius: var(--p-multiselect-border-radius) 0 0 var(--p-multiselect-border-radius) !important;
}
</style>

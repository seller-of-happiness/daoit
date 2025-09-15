<script setup lang="ts">
/**
 * Компонент SearchInputGroup — упрощённый текстовый поиск (один режим)
 *
 * Функционал:
 * - Поиск по тексту через store.filters[searchKey]
 * - Дебаунс/блокировка — передаётся через проп loading (дизейбл кнопок/инпута)
 * - Очистка поиска
 *
 * Props:
 * - store: Хранилище (обязательный), ожидается объект filters с ключом searchKey
 * - loading: Состояние загрузки (опционально)
 * - searchKey: Ключ для текстового поиска (по умолчанию 'search')
 */

import { ref, watch } from 'vue'

const props = defineProps({
    store: { type: Object, required: true },
    loading: { type: Boolean, default: false },
    searchKey: { type: String, default: 'search' }
})

const emit = defineEmits(['search'])

// локальная модель для ввода
const searchInput = ref<string>(props.store.filters[props.searchKey] || '')

// применить поиск (пишем в store и эмитим)
const doSearch = () => {
    props.store.filters[props.searchKey] = searchInput.value
    emit('search')
}

// очистить поиск (обнуляем и эмитим)
const clearSearch = () => {
    searchInput.value = ''
    props.store.filters[props.searchKey] = ''
    emit('search')
}

// обратная синхронизация, если снаружи меняют filters[searchKey]
watch(
    () => props.store.filters[props.searchKey],
    (val) => {
        if (val !== searchInput.value) searchInput.value = val || ''
    }
)
</script>

<template>
    <InputGroup class="flex-1">
        <InputGroupAddon v-if="searchInput">
            <Button icon="pi pi-times" severity="secondary" :disabled="loading" @click="clearSearch" />
        </InputGroupAddon>

        <InputText
            v-model="searchInput"
            placeholder="Поиск по любым полям"
            class="flex-1"
            :disabled="loading"
            @keyup.enter="doSearch"
        />

        <InputGroupAddon>
            <Button icon="pi pi-search" severity="secondary" :disabled="loading" @click="doSearch" />
        </InputGroupAddon>
    </InputGroup>
</template>

<style scoped lang="scss">
.p-inputgroup .p-inputtext, .p-inputgroup .p-inputwrapper {
    width: 100% !important;
    height: 100% !important;
}

:deep([data-pc-name="inputtext"]) {
    border-radius: var(--p-multiselect-border-radius) 0 0 var(--p-multiselect-border-radius) !important;
}
</style>

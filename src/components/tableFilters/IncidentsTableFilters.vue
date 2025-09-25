<script setup lang="ts">
/*
* Компонент FiltersPanel - панель фильтрации и поиска для таблицы нежелательных событий
*
* Основной функционал:
* - Управление всеми фильтрами через хранилище apiStore
* - Поддержка быстрых пресетов фильтрации
* - Поиск по номеру/тексту с переключением режимов
* - Фильтрация по отделениям (мультиселект с подсветкой совпадений)
* - Фильтрация по категориям/типам событий (древовидный выбор)
* - Фильтрация по датам с дебаунсом запросов
* - Отображение активных фильтров в виде чипов
* - Адаптивный интерфейс с возможностью сворачивания
*
* Особенности:
* - Интеграция с PrimeVue компонентами
* - Дебаунс сетевых запросов при изменении дат
* - Подсветка совпадений при фильтрации отделений
* - Синхронизация локальных и глобальных состояний
*/

// ================== IMPORTS ==================
import { useApiStore } from '@/refactoring/modules/apiStore/stores/apiStore'
import { useFeedbackStore } from '@/refactoring/modules/feedback/stores/feedbackStore'

// Компоненты фильтров
import FilterTreeSelect from '@/components/tableFilters/FilterTreeSelect.vue'

// Типы
import type { IVModelTreeSelect } from '@/refactoring/types/IVModelTreeSelect'
import type { ITreeNode } from '@/refactoring/modules/apiStore/types/ITreeNode'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import SearchInputGroup from '@/components/tableFilters/SearchInputGroup.vue'
import DateRangePicker from '@/components/tableFilters/DateRangePicker.vue'

// ================== STORES ==================
const apiStore = useApiStore() // Хранилище данных и фильтров
const feedbackStore = useFeedbackStore() // Хранилище состояния загрузки

// ================== STATE ==================
const primeTreeModal = ref<Record<string, boolean>>({}) // Состояние выбранных узлов дерева категорий
const isFiltersCollapsed = ref(true) // Состояние свернутости панели фильтров

const suppressFilterWatch = ref(false) // Флаг для подавления watch-эффектов

const departmentsKey = ref(0) // Ключ для принудительного перерендера мультиселекта отделений


/**
 * Инициирует запрос на сервер с текущими фильтрами
 */
const triggerServerFilter = () => {
    apiStore.nextAdverseEventsCursor = null
    void apiStore.fetchFilteredAdverseEvents()
}

// Автоматическое применение фильтров при изменении отделений
watch(
    () => apiStore.filters.department.slice(),
    () => {
        departmentsKey.value++
        if (suppressFilterWatch.value) return
        triggerServerFilter()
    }
)


/**
 * Возвращает метку выбранной категории для отображения в плейсхолдере
 */
const selectedCategoryLabel = computed(() => {
    if (!primeTreeModal.value || Object.keys(primeTreeModal.value).length === 0) return ''
    const selectedKey = Object.keys(primeTreeModal.value)[0]

    const findCategory = (nodes: ITreeNode[]): string | null => {
        for (const node of nodes) {
            if (node.key === selectedKey) return node.label
            if (node.children?.length) {
                const found = findCategory(node.children)
                if (found) return found
            }
        }
        return null
    }

    return findCategory(apiStore.categoryTypeTree) || ''
})

/**
 * Обработчик изменения выбранных категорий/типов событий
 */
const onChangeTreeSelect = (selectedKeys: IVModelTreeSelect | null) => {
    if (!selectedKeys || Object.keys(selectedKeys).length === 0) {
        primeTreeModal.value = {}
        apiStore.filters.event_type = []
        apiStore.filters.category = []
        triggerServerFilter()
        return
    }

    const selectedKey = Object.keys(selectedKeys)[0]
    primeTreeModal.value = { [selectedKey]: true }

    if (selectedKey.includes('-')) {
        apiStore.filters.event_type = [Number(selectedKey.split('-')[1])]
        apiStore.filters.category = []
    } else {
        apiStore.filters.event_type = []
        apiStore.filters.category = [Number(selectedKey)]
    }

    triggerServerFilter()
}



/**
 * Применяет быстрый пресет фильтрации
 * @param preset - тип пресета ('my_active', 'current_month', 'prev_month', 'high_risk')
 */
const applyQuickPreset = (preset: 'my_active' | 'current_month' | 'prev_month' | 'high_risk') => {
    suppressFilterWatch.value = true

    // Тоггл «Высокий риск»
    if (preset === 'high_risk') {
        apiStore.filters.is_high_risk = !apiStore.filters.is_high_risk
        triggerServerFilter()
        return
    }

    // Тоггл «Мои активные НС»
    if (preset === 'my_active') {
        apiStore.filters.is_active = !apiStore.filters.is_active
        triggerServerFilter()
        return
    }

    // Диапазоны дат
    if (preset === 'current_month' || preset === 'prev_month') {
        apiStore.resetFilters()
        const now = new Date()
        const y = now.getFullYear()
        const m = now.getMonth()
        const start = new Date(y, preset === 'current_month' ? m : m - 1, 1)
        const end = new Date(y, preset === 'current_month' ? m + 1 : m, 0)

        // Прямое обновление хранилища
        apiStore.filters.created_after = start
        apiStore.filters.created_before = end

        suppressFilterWatch.value = false
        triggerServerFilter() // Вызываем напрямую, так как DateRangePicker будет синхронизирован через watchers
        return
    }

    suppressFilterWatch.value = false
}

/**
 * Переключает состояние свернутости панели фильтров
 */
const toggleFilters = () => {
    isFiltersCollapsed.value = !isFiltersCollapsed.value
}


/**
 * Двусторонняя модель для мультиселекта отделений
 */
const departmentsModel = computed<string[] | null>({
    get: () => apiStore.filters.department,
    set: (val) => { apiStore.filters.department = Array.isArray(val) ? val : [] }
})

// ===== Dropdown "Отделение" — автофокус и подсветка =====
/**
 * Реализация расширенного поведения для мультиселекта отделений:
 * - Автоматический фокус на поле фильтра при открытии
 * - Подсветка совпадений при фильтрации
 * - Очистка фильтра при закрытии
 */

/**
 * Ссылка на компонент MultiSelect для отделений
 * @type {import('vue').Ref<ComponentPublicInstance | null>}
 */
const departmentDropdown = ref()

/**
 * Текущее значение фильтра в выпадающем списке отделений
 * Используется для подсветки совпадений в реальном времени
 * @type {import('vue').Ref<string>}
 */
const departmentFilter = ref('')

/**
 * WeakSet для отслеживания уже привязанных input-элементов
 * Позволяет избежать дублирования обработчиков событий
 * @type {WeakSet<HTMLInputElement>}
 */
const boundInputs = new WeakSet<HTMLInputElement>()

/**
 * MutationObserver для отслеживания появления/изменения DOM-элементов
 * Используется для обнаружения открытого dropdown и привязки к его полю фильтрации
 * @type {MutationObserver | null}
 */
let mo: MutationObserver | null = null

/**
 * Подсвечивает совпадения в названиях отделений при фильтрации
 */
const highlightDepartmentMatch = (label: string, q: string): string => {
    if (!q) return label
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`(${safe})`, 'ig')
    return label.replace(re, '<mark>$1</mark>')
}

/**
 * Пытается привязать обработчики к полю фильтрации в выпадающем списке
 */
const tryBindFilterInput = () => {
    // Ищем все overlay мультиселектов на странице
    const panels = Array.from(document.querySelectorAll('.p-multiselect-panel, .p-multiselect-overlay')) as HTMLElement[]

    for (const panel of panels) {
        // Проверяем, что это overlay нашего компонента
        const isOurDropdown = panel.closest('.p-multiselect') === departmentDropdown.value?.$el
        if (!isOurDropdown) continue

        const input = panel.querySelector('input.p-multiselect-filter') as HTMLInputElement | null
        if (input && !boundInputs.has(input)) {
            boundInputs.add(input)

            // Фокусируемся при появлении
            setTimeout(() => {
                input.focus()
                input.select()
            }, 0)

            // Следим за изменениями фильтра
            input.addEventListener('input', (e) => {
                departmentFilter.value = (e.target as HTMLInputElement).value || ''
            }, { passive: true })
        }
    }
}

onMounted(() => {
    mo = new MutationObserver(() => tryBindFilterInput())
    mo.observe(document.body, { childList: true, subtree: true })
    // Если панель уже есть в DOM - сразу привяжемся
    tryBindFilterInput()

    // Дополнительно вешаем обработчик на клик по самому селекту
    const dropdown = departmentDropdown.value?.$el
    if (dropdown) {
        dropdown.addEventListener('click', () => {
            setTimeout(tryBindFilterInput, 0)
        })
    }
})

onUnmounted(() => {
    mo?.disconnect()
    mo = null
})
</script>

<template>
    <section class="filters-panel card col-span-12">
        <header class="filters-panel__header flex justify-between items-center border-surface-200 dark:border-surface-700">
            <Button
                size="small"
                label="Фильтр и поиск"
                :icon="isFiltersCollapsed ? 'pi pi-filter' : 'pi pi-filter-slash'"
                @click="toggleFilters"
                class="filters-panel__header-btn"
            />
            <Button
                size="small"
                :icon="isFiltersCollapsed ? 'pi pi-chevron-down' : 'pi pi-chevron-up'"
                severity="secondary"
                text
                rounded
                @click.stop="toggleFilters"
                aria-label="Toggle filters"
                class="filters-panel__toggle"
            />
            <div class="filters-panel__quick">
                <Button
                    size="small"
                    :label="apiStore.filters.is_active ? 'Мои активные НС (фильтрация активна)' : 'Мои активные НС'"
                    icon="pi pi-bolt"
                    @click.stop="applyQuickPreset('my_active')"
                />
            </div>
        </header>

        <Transition name="fade">
            <div v-show="!isFiltersCollapsed" class="filters-panel__content grid grid-cols-12 gap-4">
                <!-- Первая строка: пресеты и отделения -->
                <div class="col-span-12 flex flex-col lg:flex-row gap-4">
                    <!-- Быстрые пресеты -->
                    <div class="filters-panel__presets flex-1 flex flex-wrap gap-2 mt-2">
                        <Button size="small" label="Текущий месяц" icon="pi pi-calendar" @click="applyQuickPreset('current_month')" />
                        <Button size="small" label="Прошлый месяц" icon="pi pi-calendar-times" @click="applyQuickPreset('prev_month')" />
                        <Button
                            size="small"
                            :label="apiStore.filters.is_high_risk ? 'Высокий риск (фильтрация активна)' : 'Высокий риск'"
                            icon="pi pi-exclamation-triangle"
                            severity="danger"
                            outlined
                            @click="applyQuickPreset('high_risk')"
                        />
                    </div>
                </div>

                <div class="col-span-12 flex flex-col lg:flex-row gap-4">
                    <!-- Отделения -->
                    <MultiSelect
                        ref="departmentDropdown"
                        :key="departmentsKey"
                        class="flex-1 min-w-[250px]"
                        append-to="self"
                        :filter="true"
                        showClear
                        :reset-filter-on-hide="true"
                        display="chip"
                        :loading="feedbackStore.isGlobalLoading"
                        :options="apiStore.flatDepartments"
                        v-model="departmentsModel"
                        option-label="name"
                        option-value="id"
                        placeholder="Отделение"
                        @hide="departmentFilter = ''"
                    >
                        <template #option="slotProps">
                            <span v-html="highlightDepartmentMatch(slotProps.option?.name ?? '', departmentFilter)"></span>
                        </template>
                    </MultiSelect>
                </div>

                <!-- Вторая строка: поиск и категории -->
                <div class="col-span-12 flex flex-col lg:flex-row gap-4">
                    <!-- Поиск (заменен на новый компонент) -->
                    <SearchInputGroup
                        :store="apiStore"
                        :loading="feedbackStore.isGlobalLoading"
                        @search="triggerServerFilter"
                    />

                    <!-- Категории/типы -->
                    <FilterTreeSelect
                        class="flex-1"
                        labelFor="categoryTypeTree"
                        :placeholder="selectedCategoryLabel || 'Категории НС'"
                        :loading="feedbackStore.isGlobalLoading"
                        :hideTree="true"
                        selectionMode="single"
                        :changeHandler="onChangeTreeSelect"
                        :options="apiStore.categoryTypeTree"
                        v-model="primeTreeModal"
                    />
                </div>

                <!-- Третья строка: даты (заменена на новый компонент) -->
                <DateRangePicker
                    :store="apiStore"
                    :loading="feedbackStore.isGlobalLoading"
                    @change="triggerServerFilter"
                    class="col-span-12"
                    :dateOnly="true"
                />

                <!-- Четвертая строка: чипы фильтров -->
                <div class="filters-panel__chips col-span-12 flex flex-wrap gap-2">
                    <Tag v-for="d in apiStore.filters.department" :key="`dep-${d}`" severity="info" :value="`Отделение: ${apiStore.getDepartmentName(String(d))}`" />
                    <Tag v-for="t in apiStore.filters.event_type" :key="`type-${t}`" severity="success" :value="`Тип: ${t}`" />
                    <Tag v-for="c in apiStore.filters.category" :key="`cat-${c}`" severity="warn" :value="`Категория: ${c}`" />
                    <Tag v-if="apiStore.filters.search" severity="secondary" :value="`Поиск: ${apiStore.filters.search}`" />
                </div>
            </div>
        </Transition>
    </section>
</template>

<style scoped lang="scss">
.filters-panel {
    &__search {
        display: flex;
        align-items: stretch;
        gap: .25rem;
    }

    &__mode {
        flex: 0 0 110px;
        min-width: 110px;
    }

    &__mode-select {
        width: 100%;
    }

    &__input {
        flex: 1 1 auto !important;
        min-width: 0;
    }

    &__dates {
        display: flex;
        align-items: center;
        gap: .5rem;
    }
}
</style>

<script setup lang="ts">
/*
* Компонент: SupportServiceFilters — панель фильтрации для заявок Службы Поддержки (СП).
*
* Назначение:
* - Компактный блок фильтров и поиска с мультиселектами (инициатор, отдел, службы, категории).
* - Быстрые пресеты периода и статуса («мои активные», текущий/прошлый месяц).
* - Автоматический запуск серверной фильтрации при изменении значений.
* - Подсветка совпадений и автофокус поля фильтра внутри каждого MultiSelect.
* - Закрытие всплывающей панели MultiSelect после выбора.
*
* Поток данных:
* - UI → v-model (computed getter/setter) → supportServiceStore.filters.* → watcher → triggerServerFilter()
*
* Хранилища:
* - supportServiceStore — источник/приёмник фильтров (filters.*), вызов fetchFilteredSupportServices().
* - apiStore — справочники (employees, departments).
* - feedbackStore — индикатор загрузки (isDataLoading) для UI.
*
* Особенности реализации:
* - Поддержка панелей PrimeVue при append-to="self" и append-to="body".
* - Жёсткая привязка DOM-инпутов фильтра к «своей» панели (не путаем с другими инстансами).
* - Безопасная подсветка (экранирование запроса) и автофокус без затирания введённого текста.
* - Fallback закрытия панели (Esc/клик по триггеру), если у инстанса нет hide().
*/

// ============================== ИМПОРТЫ (назначение) ==============================
import { useSupportService } from '@/refactoring/modules/supportService/stores/supportService' // стор СП: filters.*, группы/категории, fetchFilteredSupportServices()
import { useApiStore } from '@/refactoring/modules/apiStore/stores/apiStore'                    // стор справочников: сотрудники, отделы
import { useFeedbackStore } from '@/refactoring/modules/feedback/stores/feedbackStore'          // стор UI: глобовые индикаторы (isDataLoading)
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'                               // реактивность и хуки жизненного цикла
import SearchInputGroup from '@/components/tableFilters/SearchInputGroup.vue'                    // поиск по строке/номеру, эмитит @search
import DateRangePicker from '@/components/tableFilters/DateRangePicker.vue'                      // выбор периода, эмитит @change
import type { Ref } from 'vue'                                                                   // типы для ссылок


// ============================== ИНИЦИАЛИЗАЦИЯ СТОРОВ ==============================
const supportServiceStore = useSupportService()
const apiStore = useApiStore()
const feedbackStore = useFeedbackStore()


// ============================== STATE (ref) ==============================

/** Свёрнуто/развёрнуто тело панели фильтров (true — свёрнута по умолчанию). */
const isFiltersCollapsed = ref(true)

/**
 * Подавление реакций watcher при пакетных изменениях (пресеты).
 * Пока true — серверная фильтрация не запускается автоматически.
 */
const suppressFilterWatch = ref(false)

/** Ссылки на инстансы MultiSelect (нужны для поиска панели/инпута, автозакрытия и автофокуса). */
const initiatorDropdown = ref()
const departmentDropdown = ref()
const groupDropdown = ref()
const categoryDropdown = ref()

/** Локальные строки фильтра внутри открытых панелей MultiSelect (для подсветки <mark>). */
const initiatorFilter = ref('')
const departmentFilter = ref('')
const groupFilter = ref('')
const categoryFilter = ref('')

/**
 * Коллекция уже привязанных DOM-инпутов фильтра (чтобы не навешивать обработчики повторно)
 * и MutationObserver для отслеживания появления/скрытия панелей.
 */
const boundInputs = new WeakSet<HTMLInputElement>()
let mo: MutationObserver | null = null


/**
 * Опции для MultiSelect «Инициатор» в формате { id, name }.
 * name = «Фамилия Имя Отчество» (пустые части отбрасываются).
 */
const employeesForFilter = computed(() =>
    apiStore.employees.map(e => ({
        id: e.id,
        name: [e.last_name, e.first_name, e.middle_name].filter(Boolean).join(' ')
    }))
)

/** Двусторонняя модель MultiSelect «Отдел инициатора» → supportServiceStore.filters.department */
const departmentsModel = computed({
    get: () => supportServiceStore.filters.department,
    set: (val) => {
        supportServiceStore.filters.department = Array.isArray(val) ? val : []
    }
})

/** Двусторонняя модель MultiSelect «Инициатор» → supportServiceStore.filters.manager */
const managersModel = computed({
    get: () => supportServiceStore.filters.manager,
    set: (val) => {
        supportServiceStore.filters.manager = Array.isArray(val) ? val : []
    }
})

/** Двусторонняя модель MultiSelect «Службы» → supportServiceStore.filters.group */
const groupsModel = computed({
    get: () => supportServiceStore.filters.group,
    set: (val) => {
        supportServiceStore.filters.group = Array.isArray(val) ? val : []
    }
})

/** Двусторонняя модель MultiSelect «Категории» → supportServiceStore.filters.category */
const categoriesModel = computed({
    get: () => supportServiceStore.filters.category,
    set: (val) => {
        supportServiceStore.filters.category = Array.isArray(val) ? val : []
    }
})


/**
 * Реакция на изменения ключевых фильтров.
 * Если suppressFilterWatch=false → запускаем серверную фильтрацию.
 */
watch([
    () => supportServiceStore.filters.department,
    () => supportServiceStore.filters.manager,
    () => supportServiceStore.filters.group,
    () => supportServiceStore.filters.category
], () => {
    if (suppressFilterWatch.value) return
    triggerServerFilter()
}, { deep: true })

// ===  подсветка, автофокус без стирания, очистка при закрытии ===

/**
 * Подсветка совпадений в тексте опции через <mark>, с безопасным экранированием поисковой строки.
 * @param label Исходный текст.
 * @param q Поисковая строка.
 * @returns HTML-строка с подсветкой.
 */
const highlightMatch = (label: string, q: string): string => {
    if (!q) return label
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`(${safe})`, 'ig')
    return label.replace(re, '<mark>$1</mark>')
}

/** CSS-селектор панелей MultiSelect (локальная/оверлейная). */
const PANEL_SELECTOR = '.p-multiselect-panel, .p-multiselect-overlay' as const

/**
 * Корневой DOM-элемент инстанса MultiSelect.
 * @param dropdownRef Ref на инстанс.
 */
const getRootEl = (dropdownRef: Ref<any>): HTMLElement | null =>
    (dropdownRef?.value?.$el ?? null) as HTMLElement | null

/**
 * Поиск панелей, принадлежащих конкретному MultiSelect.
 * Сначала ищем локально (append-to="self"), затем фильтруем глобальные (append-to="body").
 */
const findPanelsFor = (dropdownRef: Ref<any>): HTMLElement[] => {
    const root = getRootEl(dropdownRef)
    if (!root) return []
    // append-to="self"
    const local = Array.from(root.querySelectorAll<HTMLElement>(PANEL_SELECTOR))
    if (local.length) return local
    // fallback: append-to="body"
    return Array.from(document.querySelectorAll<HTMLElement>(PANEL_SELECTOR))
        .filter(p => p.closest('.p-multiselect') === root)
}

/**
 * Аккуратный автофокус на input фильтра панели:
 * — только focus(), без select(), каретка ставится в конец без затирания введённого.
 */
const focusFilterInput = (input: HTMLInputElement): void => {
    // Только фокус, без select() — чтобы не затирался ввод
    if (document.activeElement !== input) {
        const pos = input.value.length
        input.focus()
        // Ставим каретку в конец, не выделяя текст
        try { input.setSelectionRange(pos, pos) } catch { /* mobile may not support */ }
    }
}

/**
 * Привязка DOM-инпута фильтра к реактивной строке и автофокус.
 * Гарантирует, что бинд выполняется только для «своей» панели текущего инстанса.
 */
const tryBindFilterInput = (dropdownRef: Ref<any>, filterRef: Ref<string>): void => {
    const panels: HTMLElement[] = findPanelsFor(dropdownRef)
    if (!panels.length) return

    const root = getRootEl(dropdownRef)
    if (!root) return

    panels.forEach((panel: HTMLElement) => {
        const ownerRoot = panel.closest('.p-multiselect') as HTMLElement | null
        if (ownerRoot !== root) return

        const input = panel.querySelector<HTMLInputElement>('input.p-multiselect-filter')
        if (!input) return

        if (!boundInputs.has(input)) {
            boundInputs.add(input)
            input.addEventListener('input', (e: Event) => {
                const target = e.target as HTMLInputElement
                filterRef.value = target.value || ''
            })
        }

        // Автофокус однократно (без select), чтобы ввод не затирался
        focusFilterInput(input)
    })
}

/**
 * При монтировании:
 * - Создаём MutationObserver для отслеживания появления панелей и биндим инпуты.
 * - Навешиваем на корневые элементы MultiSelect обработчик клика, чтобы после открытия панели
 *   выполнить tryBindFilterInput и автофокус (setTimeout 0).
 */
onMounted(() => {
    mo = new MutationObserver(() => {
        tryBindFilterInput(initiatorDropdown, initiatorFilter)
        tryBindFilterInput(departmentDropdown, departmentFilter)
        tryBindFilterInput(groupDropdown, groupFilter)
        tryBindFilterInput(categoryDropdown, categoryFilter)
    })
    mo.observe(document.body, { childList: true, subtree: true })

    // Клик по корню → после открытия бинд + автофокус
    const dropdownRoots: HTMLElement[] = [
        initiatorDropdown.value?.$el,
        departmentDropdown.value?.$el,
        groupDropdown.value?.$el,
        categoryDropdown.value?.$el
    ].filter(Boolean) as HTMLElement[]

    dropdownRoots.forEach((rootEl) => {
        rootEl.addEventListener('click', () => {
            setTimeout(() => {
                if (rootEl === initiatorDropdown.value?.$el)   tryBindFilterInput(initiatorDropdown, initiatorFilter)
                if (rootEl === departmentDropdown.value?.$el)  tryBindFilterInput(departmentDropdown, departmentFilter)
                if (rootEl === groupDropdown.value?.$el)       tryBindFilterInput(groupDropdown, groupFilter)
                if (rootEl === categoryDropdown.value?.$el)    tryBindFilterInput(categoryDropdown, categoryFilter)
            }, 0)
        })
    })
})

/** Отписка MutationObserver при размонтировании. */
onUnmounted(() => {
    mo?.disconnect()
    mo = null
})

/**
 * Наблюдение за локальными строками фильтра панелей (опциональная точка расширения).
 * flush: 'post' — срабатывание после обновления DOM (PrimeVue сам очищает инпут по reset-filter-on-hide).
 */
watch([initiatorFilter, departmentFilter, groupFilter, categoryFilter], () => {
    // если какой-то из фильтров стал пустым и оверлей закрыт — ничего не делаем (PrimeVue сам чистит по reset-filter-on-hide)
}, { flush: 'post' })

/** Привязка/фокус инпута при открытии панели «Инициатор». */
const onShowInitiator = () => tryBindFilterInput(initiatorDropdown, initiatorFilter)

/** Привязка/фокус инпута при открытии панели «Отдел». */
const onShowDepartment = () => tryBindFilterInput(departmentDropdown, departmentFilter)

/** Привязка/фокус инпута при открытии панели «Службы». */
const onShowGroup = () => tryBindFilterInput(groupDropdown, groupFilter)

/** Привязка/фокус инпута при открытии панели «Категории». */
const onShowCategory = () => tryBindFilterInput(categoryDropdown, categoryFilter)

// ============================== ФИЛЬТРАЦИЯ/ПРЕСЕТЫ ==============================

/**
 * Запуск серверной фильтрации.
 * Делегирует в supportServiceStore.fetchFilteredSupportServices().
 */
const triggerServerFilter = () => {
    supportServiceStore.fetchFilteredSupportServices()
}

/**
 * Быстрые пресеты фильтров:
 * - 'my_active'     — переключает флаг is_active на инверсию (с предварительным resetFilters()).
 * - 'current_month' — выставляет created_after/created_before на границы текущего месяца.
 * - 'prev_month'    — выставляет границы прошлого месяца.
 * На время применения подавляет watcher (suppressFilterWatch).
 */
const applyQuickPreset = (preset: 'my_active' | 'current_month' | 'prev_month') => {
    suppressFilterWatch.value = true

    if (preset === 'my_active') {
        supportServiceStore.filters.is_active = !supportServiceStore.filters.is_active
        triggerServerFilter()
        return
    } else if (preset === 'current_month' || preset === 'prev_month') {
        supportServiceStore.resetFilters()
        const now = new Date()
        const y = now.getFullYear()
        const m = now.getMonth()
        const start = new Date(y, preset === 'current_month' ? m : m - 1, 1)
        const end = new Date(y, preset === 'current_month' ? m + 1 : m, 0)

        supportServiceStore.filters.created_after = start
        supportServiceStore.filters.created_before = end
    }

    suppressFilterWatch.value = false
    triggerServerFilter()
}

/** Переключение свёрнутости панели фильтров. */
const toggleFilters = () => {
    isFiltersCollapsed.value = !isFiltersCollapsed.value
}

/** Обёртки @change для каждого MultiSelect: закрывают панель и сбрасывают строку фильтра. */
const onChangeInitiator = (_e: unknown) => closeOnSelect(initiatorDropdown, initiatorFilter)
const onChangeDepartment = (_e: unknown) => closeOnSelect(departmentDropdown, departmentFilter)
const onChangeGroup = (_e: unknown) => closeOnSelect(groupDropdown, groupFilter)
const onChangeCategory = (_e: unknown) => closeOnSelect(categoryDropdown, categoryFilter)

/**
 * Закрывает конкретный MultiSelect после выбора:
 * 1) Пытается вызвать inst.hide() (если доступен).
 * 2) Иначе шлёт клавишу Escape в инпут панели или кликает по триггеру раскрытия.
 * Всегда очищает реактивную строку фильтра (DOM-инпут очистится за счёт :reset-filter-on-hide="true").
 */
const closeOnSelect = (dropdownRef: Ref<any>, filterRef: Ref<string>): void => {
    // немножко позже, чтобы не мешать внутреннему обновлению modelValue
    setTimeout(() => {
        const inst = dropdownRef.value
        // 1) Нормальный путь: у MultiSelect есть hide() в свежих версиях
        if (inst && typeof inst.hide === 'function') {
            inst.hide()
        } else {
            // 2) Фолбэк: пытаемся закрыть клавишей Escape или кликом по триггеру
            const panel = findPanelsFor(dropdownRef)[0]
            const input = panel?.querySelector<HTMLInputElement>('input.p-multiselect-filter')
            if (input) {
                input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
            } else {
                // клик по треугольнику-триггеру
                const trigger = getRootEl(dropdownRef)?.querySelector('.p-multiselect-dropdown') as HTMLElement | null
                trigger?.click()
            }
        }
        // реактивное поле фильтра чистим; сам DOM-инпут очистится из-за :reset-filter-on-hide="true"
        filterRef.value = ''
    }, 0)
}
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
                    :label="supportServiceStore.filters.is_active ? 'Мои активные заявки (фильтрация активна)' : 'Мои активные заявки'"
                    icon="pi pi-bolt"
                    @click.stop="applyQuickPreset('my_active')"
                />
            </div>
        </header>

        <Transition name="fade">
            <div v-show="!isFiltersCollapsed" class="filters-panel__content grid grid-cols-12 gap-4">
                <!-- Пресеты -->
                <div class="col-span-12 flex flex-col lg:flex-row gap-4">
                    <div class="filters-panel__presets flex-1 flex flex-wrap gap-2 mt-2">
                        <Button size="small" label="Текущий месяц" icon="pi pi-calendar" @click="applyQuickPreset('current_month')" />
                        <Button size="small" label="Прошлый месяц" icon="pi pi-calendar-times" @click="applyQuickPreset('prev_month')" />
                    </div>
                </div>

                <!-- Инициатор и отдел -->
                <div class="col-span-12 flex flex-col lg:flex-row gap-4">
                    <!-- Инициатор -->
                    <MultiSelect
                        ref="initiatorDropdown"
                        class="flex-1 min-w-[250px]"
                        append-to="self"
                        :filter="true"
                        showClear
                        :reset-filter-on-hide="true"
                        display="chip"
                        :loading="feedbackStore.isGlobalLoading"
                        :options="employeesForFilter"
                        v-model="managersModel"
                        option-label="name"
                        option-value="id"
                        placeholder="Постановщик заявки"
                        @hide="initiatorFilter = ''"
                        @show="onShowInitiator"
                        @change="onChangeInitiator"
                    >
                        <template #option="slotProps">
                            <span v-html="highlightMatch(slotProps.option?.name ?? '', initiatorFilter)"></span>
                        </template>
                    </MultiSelect>

                    <!-- Отдел -->
                    <MultiSelect
                        ref="departmentDropdown"
                        class="flex-1 min-w-[250px]"
                        append-to="self"
                        :filter="true"
                        showClear
                        :reset-filter-on-hide="true"
                        display="chip"
                        :loading="feedbackStore.isGlobalLoading"
                        :options="apiStore.departments"
                        v-model="departmentsModel"
                        option-label="name"
                        option-value="id"
                        placeholder="Отдел постановщика заявки"
                        @hide="departmentFilter = ''"
                        @show="onShowDepartment"
                        @change="onChangeDepartment"
                    >
                        <template #option="slotProps">
                            <span v-html="highlightMatch(slotProps.option?.name ?? '', departmentFilter)"></span>
                        </template>
                    </MultiSelect>
                </div>

                <!-- Службы и категории -->
                <div class="col-span-12 flex flex-col lg:flex-row gap-4">
                    <!-- Службы -->
                    <MultiSelect
                        ref="groupDropdown"
                        class="flex-1 min-w-[250px]"
                        append-to="self"
                        :filter="true"
                        showClear
                        :reset-filter-on-hide="true"
                        display="chip"
                        :loading="feedbackStore.isGlobalLoading"
                        :options="supportServiceStore.supportServiceGroups"
                        v-model="groupsModel"
                        option-label="name"
                        option-value="id"
                        placeholder="Службы"
                        @hide="groupFilter = ''"
                        @show="onShowGroup"
                        @change="onChangeGroup"
                    >
                        <template #option="slotProps">
                            <span v-html="highlightMatch(slotProps.option?.name ?? '', groupFilter)"></span>
                        </template>
                    </MultiSelect>

                    <!-- Категории -->
                    <MultiSelect
                        ref="categoryDropdown"
                        class="flex-1 min-w-[250px]"
                        append-to="self"
                        :filter="true"
                        showClear
                        :reset-filter-on-hide="true"
                        display="chip"
                        :loading="feedbackStore.isGlobalLoading"
                        :options="supportServiceStore.supportServiceCategories"
                        v-model="categoriesModel"
                        option-label="name"
                        option-value="id"
                        placeholder="Категории"
                        @hide="categoryFilter = ''"
                        @show="onShowCategory"
                        @change="onChangeCategory"
                    >
                        <template #option="slotProps">
                            <span v-html="highlightMatch(slotProps.option?.name ?? '', categoryFilter)"></span>
                        </template>
                    </MultiSelect>
                </div>

                <!-- Поиск и даты -->
                <div class="col-span-12 flex flex-col lg:flex-row gap-4">
                    <search-input-group
                        :store="supportServiceStore"
                        :loading="feedbackStore.isGlobalLoading"
                        searchKey="search"
                        numberKey="number"
                        @search="triggerServerFilter"
                    />
                </div>

                <date-range-picker
                    :store="supportServiceStore"
                    :loading="feedbackStore.isGlobalLoading"
                    afterKey="created_after"
                    beforeKey="created_before"
                    :dateOnly="true"
                    @change="triggerServerFilter"
                    class="col-span-12"
                />
            </div>
        </Transition>
    </section>
</template>

<style scoped lang="scss">
.filters-panel {
    &__header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid var(--surface-200);

        &-toggle {
            margin-left: 0.5rem;
        }
    }

    &__presets {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
    }
}

.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>

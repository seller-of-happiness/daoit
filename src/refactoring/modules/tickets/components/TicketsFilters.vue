<script setup lang="ts">
/*
 * Компонент: TicketsFilters — панель фильтров и поиска для списка тикетов
 *
 * Назначение:
 * - Управление серверной фильтрацией: поиск, категория/подкатегория, приоритет(ы), статус(ы).
 * - Инкапсуляция локального UI-состояния (раскрытие панели, модели MultiSelect).
 * - Единая точка вызова загрузки списка по текущим фильтрам.
 *
 * Используемые хранилища:
 * - ticketsStore: filters { search, categories, priorities[], statuses[] }, categories, priorityOptions, fetchTickets(), resetFilters().
 * - apiStore: responsibilityEntriesStatuses (мап «код статуса → лейбл»).
 *
 * Подключенные компоненты:
 * - SearchInputGroup — строка поиска (двусторонняя привязка).
 * - DateRangePicker — выбор диапазона дат.
 * - MultiSelect (PrimeVue) — приоритеты, статусы и категории.
 */

import { computed, onMounted, ref, toRef } from 'vue'
import { useTicketsStore } from '@/refactoring/modules/tickets/stores/ticketsStore'
import { useApiStore } from '@/refactoring/modules/apiStore/stores/apiStore'

import SearchInputGroup from '@/components/tableFilters/SearchInputGroup.vue'
import DateRangePicker from '@/components/tableFilters/DateRangePicker.vue'

import type { ITreeNode } from '@/refactoring/modules/apiStore/types/ITreeNode'
import type { ITicketCategory } from '@/refactoring/modules/tickets/types/ITicketCategory'
import type { TicketPriority } from '@/refactoring/modules/tickets/types/TicketPriority'
import type { TicketStatus } from '@/refactoring/modules/tickets/types/TicketStatus'

const tickets = useTicketsStore()
const apiStore = useApiStore()

/**
 * Тип: Ref<boolean>
 * Назначение: состояние панели фильтров (свернута/развернута).
 * Значение по умолчанию: true (панель скрыта).
 * Где используется: шапка секции (текст/иконки), v-show контента.
 * Побочные эффекты: отсутствуют.
 */
const isCollapsed = ref(true)

/**
 * Тип: Computed<number[]>
 * Назначение: двусторонняя модель выбранных категорий → tickets.filters.categories.
 * get: возвращает массив ID категорий или [].
 * set: валидирует вход и пишет массив ID либо [].
 * Триггеры: @change MultiSelect → triggerServerFilter().
 * Где используется: v-model у MultiSelect «Категория / подкатегория».
 */
const categoriesModel = computed<number[]>({
    get: () => tickets.filters.categories ?? [],
    set: (val: number[] | unknown) => {
        tickets.filters.categories = Array.isArray(val) ? val : []
    }
})

/**
 * Тип: Computed<Array<{ label: string; value: number }>>
 * Назначение: опции категорий для MultiSelect в плоском формате с иерархическими отступами.
 * Источник: tickets.categories, преобразованные через flattenCategories().
 * Формат: массив объектов { label: string, value: number } с префиксами '—' для подкатегорий.
 * Где используется: :options у MultiSelect «Категория / подкатегория».
 */
const categoryOptions = computed(() => {
    const flattenCategories = (cats: ITicketCategory[] = [], level = 0): Array<{ label: string; value: number }> => {
        let result: Array<{ label: string; value: number }> = []

        cats.forEach(cat => {
            const prefix = '—'.repeat(level)
            result.push({
                label: level > 0 ? `${prefix} ${cat.name}` : cat.name,
                value: cat.id
            })

            if (cat.childrens && cat.childrens.length > 0) {
                result = result.concat(flattenCategories(cat.childrens, level + 1))
            }
        })

        return result
    }

    return flattenCategories(tickets.categories ?? [])
})

/**
 * Тип: Computed<string>
 * Назначение: двусторонняя модель поисковой строки → tickets.filters.search.
 * get: возвращает tickets.filters.search или ''.
 * set: пишет значение в tickets.filters.search.
 * Триггеры: @search у SearchInputGroup → triggerServerFilter().
 * Где используется: v-model у <SearchInputGroup />.
 */
const searchModel = computed<string>({
    get: () => tickets.filters.search ?? '',
    set: (val) => { tickets.filters.search = val }
})

/**
 * Тип: Computed<TicketPriority[]>
 * Назначение: двусторонняя модель выбранных приоритетов → tickets.filters.priorities.
 * get: возвращает массив или [].
 * set: валидирует вход и пишет массив либо [].
 * Триггеры: @change у MultiSelect → triggerServerFilter().
 * Где используется: v-model у MultiSelect «Приоритет».
 */
const prioritiesModel = computed<TicketPriority[]>({
    get: () => (tickets.filters.priorities ?? []) as TicketPriority[],
    set: (val: TicketPriority[] | unknown) => {
        tickets.filters.priorities = Array.isArray(val) ? (val as TicketPriority[]) : []
    }
})

/**
 * Тип: Computed<TicketStatus[]>
 * Назначение: двусторонняя модель выбранных статусов → tickets.filters.statuses.
 * get: возвращает массив или [].
 * set: валидирует вход и пишет массив либо [].
 * Триггеры: @change у MultiSelect → triggerServerFilter().
 * Где используется: v-model у MultiSelect «Статус».
 */
const statusesModel = computed<TicketStatus[]>({
    get: () => (tickets.filters.statuses ?? []) as TicketStatus[],
    set: (val: TicketStatus[] | unknown) => {
        tickets.filters.statuses = Array.isArray(val) ? (val as TicketStatus[]) : []
    }
})

/**
 * Тип: Ref<Date | null>
 * Назначение: двусторонние модели для дат created_after / created_before.
 * Связь: toRef для прямой синхронизации с tickets.filters.
 * Где используется: v-model:from / v-model:to у DateRangePicker.
 */
const createdAfterModel = toRef(tickets.filters, 'created_after')
const createdBeforeModel = toRef(tickets.filters, 'created_before')

/**
 * Тип: Computed<Array<{ label: string; value: TicketStatus }>>
 * Назначение: опции статусов для MultiSelect.
 * Источник: apiStore.responsibilityEntriesStatuses (мап «код → лейбл»).
 * Построение: Object.entries(map).map(([value, label]) => ({ label, value })).
 * Где используется: :options у MultiSelect «Статус».
 */
const statusOptions = computed<Array<{ label: string; value: TicketStatus }>>(() => {
    const map = apiStore.responsibilityEntriesStatuses
    return Object.entries(map).map(([value, label]) => ({ label, value: value as TicketStatus }))
})

/**
 * Тип: Computed<Array<{ label: string; value: TicketPriority }>>
 * Назначение: опции приоритетов для MultiSelect.
 * Источник: tickets.priorityOptions (готовые label/value).
 * Где используется: :options у MultiSelect «Приоритет».
 */
const priorityOptions = computed(() => tickets.priorityOptions)

/**
 * Тип: () => void
 * Назначение: единая точка старта серверной фильтрации.
 * Действие: вызывает tickets.fetchTickets() (fire-and-forget).
 * Где используется: @search SearchInputGroup, @change MultiSelect, @change DateRangePicker, сброс фильтров.
 * Примечание: сюда удобно навесить debounce/throttle при необходимости.
 */
const triggerServerFilter = (): void => { void tickets.fetchTickets() }

/**
 * Назначение: переключение фильтра «Мои активные заявки».
 * Алгоритм:
 *  1) Инвертирует значение tickets.filters.is_active (false → true, true → false).
 *  2) Вызывает triggerServerFilter() для перезагрузки списка тикетов.
 * Где используется: кнопка в шапке компонента.
 */
const toggleMyActive = () => {
    tickets.filters.is_active = !tickets.filters.is_active
    triggerServerFilter()
}

/**
 * Тип: (cats?: ITicketCategory[], level?: number) => ITreeNode[]
 * Назначение: рекурсивное преобразование категорий (childrens) в древовидную структуру.
 * Вход:
 *  - cats: список категорий уровня.
 *  - level: глубина (для data.position), по умолчанию 1.
 * Выход: массив ITreeNode с ключами 'c-<id>' и для детей 'c-<parentId>-<childId>-...'.
 * Особенности:
 *  - node.data.selfId содержит строковый id категории.
 *  - Иконки: папка для узлов с children, тег для листьев.
 * Где используется: зарезервирована для возможного будущего использования.
 */
const toTreeNodes = (cats: ITicketCategory[] = [], level = 1): ITreeNode[] => {
    return cats.map((cat) => {
        const kids = (cat as any).childrens as ITicketCategory[] | undefined
        const hasChildren = Array.isArray(kids) && kids.length > 0

        const node: ITreeNode = {
            key: `c-${cat.id}`,
            label: cat.name,
            icon: hasChildren ? 'pi pi-folder' : 'pi pi-tag',
            data: { name: cat.name, position: level, selfId: String(cat.id) },
            children: []
        }

        if (hasChildren) {
            node.children = toTreeNodes(kids!, level + 1).map((child) => ({
                ...child,
                key: `${node.key}-${child.data.selfId}`
            }))
        }

        return node
    })
}

/**
 * Тип: Lifecycle hook
 * Назначение: первичная подгрузка категорий для фильтра.
 * Алгоритм:
 *  - Если tickets.categories пуст — await tickets.fetchCategories().
 * Побочные эффекты: обращение к серверу за категориями.
 */
onMounted(async () => {
    if (!tickets.categories.length) await tickets.fetchCategories()
})
</script>

<template>
    <section class="tickets-filters card" aria-label="Фильтры и поиск заявок">
        <header class="tickets-filters__header">
            <div class="tickets-filters__header-left">
                <Button
                    size="small"
                    class="tickets-filters__header-btn"
                    :label="isCollapsed ? 'Фильтр и поиск' : 'Скрыть фильтры'"
                    :icon="isCollapsed ? 'pi pi-filter' : 'pi pi-filter-slash'"
                    @click="isCollapsed = !isCollapsed"
                />
            </div>

            <div class="tickets-filters__header-middle">
                <Button
                    size="small"
                    class="tickets-filters__toggle"
                    :icon="isCollapsed ? 'pi pi-chevron-down' : 'pi pi-chevron-up'"
                    severity="secondary"
                    text
                    rounded
                    aria-label="Toggle filters"
                    @click.stop="isCollapsed = !isCollapsed"
                />
            </div>
            <div class="tickets-filters__header-right">
                <Button
                    size="small"
                    :label="tickets.filters.is_active ? 'Мои активные заявки (фильтрация активна)' : 'Мои активные заявки'"
                    icon="pi pi-bolt"
                    class="tickets-filters__my-active-btn"
                    @click.stop="toggleMyActive"
                />
            </div>
        </header>

        <Transition name="fade">
            <div v-show="!isCollapsed" class="tickets-filters__content">
                <!-- Ряд 1: Поиск + Категория -->
                <div class="tickets-filters__row tickets-filters__row--inline">
                    <div class="tickets-filters__col tickets-filters__col--search">
                        <div class="tickets-filters__search-input">
                            <SearchInputGroup
                                :store="tickets"
                                searchKey="search"
                                v-model="searchModel"
                                @search="triggerServerFilter"
                            />
                        </div>
                    </div>

                    <div class="tickets-filters__col tickets-filters__col--tree">
                        <label class="tickets-filters__label">Категория / подкатегория</label>
                        <MultiSelect
                            class="w-full"
                            append-to="self"
                            :filter="true"
                            display="chip"
                            showClear
                            :options="categoryOptions"
                            v-model="categoriesModel"
                            option-label="label"
                            option-value="value"
                            placeholder="Выберите категории"
                            @change="triggerServerFilter"
                        />
                    </div>
                </div>

                <!-- Ряд 2: Приоритет + Статус -->
                <div class="tickets-filters__row">
                    <div class="tickets-filters__col tickets-filters__col--priority">
                        <label class="tickets-filters__label">Приоритет</label>
                        <MultiSelect
                            class="w-full"
                            append-to="self"
                            :filter="true"
                            display="chip"
                            showClear
                            :options="priorityOptions"
                            v-model="prioritiesModel"
                            option-label="label"
                            option-value="value"
                            placeholder="Выберите приоритеты"
                            @change="triggerServerFilter"
                        />
                    </div>

                    <div class="tickets-filters__col tickets-filters__col--status">
                        <label class="tickets-filters__label">Статус</label>
                        <MultiSelect
                            class="w-full"
                            append-to="self"
                            :filter="true"
                            display="chip"
                            showClear
                            :options="statusOptions"
                            v-model="statusesModel"
                            option-label="label"
                            option-value="value"
                            placeholder="Выберите статусы"
                            @change="triggerServerFilter"
                        />
                    </div>
                </div>

                <!-- Ряд 3: Дата -->
                <div class="tickets-filters__row">
                    <div class="tickets-filters__col col-span-12">
                        <DateRangePicker
                            :store="tickets"
                            v-model:from="createdAfterModel"
                            v-model:to="createdBeforeModel"
                            @change="triggerServerFilter"
                            class="col-span-12"
                            :dateOnly="true"
                        />
                    </div>
                </div>

                <!-- Ряд 4: Кнопка сброса -->
                <div class="tickets-filters__row w-full flex justify-end">
                    <Button
                        size="small"
                        icon="pi pi-refresh"
                        label="Сбросить"
                        severity="secondary"
                        class="tickets-filters__reset-btn"
                        @click="tickets.resetFilters(); triggerServerFilter()"
                    />
                </div>
            </div>
        </Transition>
    </section>
</template>

<style scoped lang="scss">
.tickets-filters {
    &__header {
        display: flex;
        align-items: center;
        gap: .75rem;
        justify-content: flex-start;
        border-bottom: 1px solid var(--surface-200);

        &-left   { display: flex; align-items: center; gap: .5rem;  flex: 0 0 auto; }
        &-middle { display: flex; align-items: center; gap: .75rem; flex: 1 1 auto; min-width: 0; }
        &-right  { display: flex; align-items: center; gap: .75rem; flex: 0 0 auto; }
    }

    &__content { padding: 1rem; display: grid; grid-template-columns: repeat(12, 1fr); gap: 1rem; }

    &__row {
        grid-column: 1 / -1;
        display: flex; flex-wrap: wrap; gap: 1rem;

        &--inline {
            align-items: flex-end;
            gap: .5rem;
        }
    }

    &__col {
        flex: 1 1 320px;

        &--search { min-width: 280px; }
        &--tree { min-width: 280px; }
        &--priority { min-width: 240px; }
        &--status { min-width: 240px; }
    }

    &__label { display: block; font-weight: 600; margin-bottom: .5rem; }
    &__tree { width: 100%; }
    &__search-input { width: 100%; }
}

.tickets-filters__header-middle .tickets-filters__toggle {
    width: 100%;
}

.tickets-filters__toggle {
    border-radius: 6px !important;
    margin-left: 5px;
}

/* Анимация */
.fade-enter-active, .fade-leave-active { transition: opacity .3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>

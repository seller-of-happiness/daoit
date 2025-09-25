<script setup lang="ts">
/*
* Компонент табличного отображения списка нежелательных событий.
*
* Основные функции:
* - Отображает список событий с пагинацией
* - Поддерживает множественный выбор и массовое удаление
* - Предоставляет кнопки действий для каждого события (просмотр, редактирование, удаление)
* - Позволяет сбрасывать фильтры и обновлять данные
* - Поддерживает экспорт данных в CSV
* - Реализует бесконечную подгрузку при скролле
*/
// Импорт необходимых модулей Vue и сторонних библиотек
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useApiStore } from '@/refactoring/modules/apiStore/stores/apiStore'
import { useFeedbackStore } from '@/refactoring/modules/feedback/stores/feedbackStore'
import { useResponsibilityEntries } from '@/refactoring/modules/responsibilityEntries/stores/responsibilityEntriesStore'
import { formatResponsibilityDate } from '@/refactoring/utils/formatters'
/*import { useGlobalConfirm } from '@/refactoring/modules/feedback/utils/useGlobalConfirm'*/
import type { IAdverseEvent } from '@/refactoring/modules/apiStore/types/adverse-events/IAdverseEvent'
import type { ICreateAdversePayload } from '@/refactoring/modules/apiStore/types/adverse-events/ICreateAdversePayload'
import { ERouteNames } from '@/router/ERouteNames'

// Инициализация хранилищ и утилит
const router = useRouter() // Для навигации
const apiStore = useApiStore() // Хранилище данных API
const feedbackStore = useFeedbackStore() // Хранилище состояния UI
const responsibilityEntries = useResponsibilityEntries() // Хранилище записей ответственности
const dt = ref() // Ссылка на компонент DataTable
const selectedElements = ref<IAdverseEvent[]>([]) // Выбранные элементы в таблице
/*const confirmAction = useGlobalConfirm() // Утилита подтверждения действий*/


/**
 * Определяет тип помещения для отображения
 * @param data - данные о местоположении
 * @returns Название блока или "Не указано"
 */
const getLocationType = (data: any) => {
    return data.block ? data.block.name : 'Не указано'
}

/**
 * Нормализует значение риска, приходящее с бэкенда.
 *
 * Назначение:
 * - Привести различные варианты строки риска к единому набору: 'low' | 'medium' | 'high' | null.
 *
 * Входные данные:
 * - r: неизвестное значение из поля data.risk (например: 'low', 'middle', 'medium', 'high', null, '').
 *
 * Правила нормализации:
 * - 'high'  → 'high'
 * - 'low'   → 'low'
 * - Любые «средние» варианты ('middle', 'medium', 'moderate', 'mid') → 'medium'
 * - Пустая строка или null/undefined → null
 *
 * Возвращает:
 * - 'low' | 'medium' | 'high' | null — нормализованное значение риска.
 *
 * Использование:
 * - Является единственным источником истины для визуализации риска в таблице.
 * - Не использует probability/consequence — риск берется только из бэкенда.
 */
const normalizeRisk = (r: unknown): 'low' | 'medium' | 'high' | null => {
    const s = String(r ?? '').trim().toLowerCase()
    if (!s) return null
    if (s === 'high') return 'high'
    if (s === 'low') return 'low'
    // мэппим всё «среднее» в medium
    if (['middle', 'medium', 'moderate', 'mid'].includes(s)) return 'medium'
    return null
}

/**
 * Возвращает CSS-класс для цветного индикатора риска.
 *
 * Назначение:
 * - Определить модификатор класса для кружка-индикатора ('.risk-dot.low|.medium|.high').
 *
 * Входные данные:
 * - r: исходное значение из data.risk.
 *
 * Возвращает:
 * - '', 'low', 'medium', 'high' — строка-модификатор (пусто, если риск не задан/не распознан).
 *
 * Применение:
 * - В шаблоне: <span v-if="normalizeRisk(data.risk)" class="risk-dot" :class="riskClass(data.risk)"></span>
 */
const riskClass = (r: unknown) => normalizeRisk(r) ?? ''

/**
 * Возвращает текстовую метку риска для отображения в UI.
 *
 * Назначение:
 * - Показать человекочитаемое значение риска рядом с индикатором.
 *
 * Входные данные:
 * - r: исходное значение из data.risk.
 *
 * Возвращает:
 * - 'Низкий' | 'Средний' | 'Высокий' | '—' (когда риск отсутствует или не распознан).
 *
 * Применение:
 * - В шаблоне: <span>{{ riskText(data.risk) }}</span>
 */
const riskText  = (r: unknown) => {
    const v = normalizeRisk(r)
    if (v === 'high')   return 'Высокий'
    if (v === 'medium') return 'Средний'
    if (v === 'low')    return 'Низкий'
    return '—'
}

/**
 * Проверяет наличие информации о месте события
 * @param data - данные о месте события
 * @returns true, если есть данные о блоке, этаже или комнате
 */
const hasLocationInfo = (data: any) => {
    return data.block || data.floor || data.room
}

/**
 * Возвращает полный адрес места события для показа во всплывающей подсказке.
 *
 * Назначение:
 * - Сформировать человекочитаемую строку из полей block, floor и room.
 *
 * Входные данные:
 * - data: объект с возможными полями:
 *   - block?: { name?: string }
 *   - floor?: { name?: string; number?: number | string }
 *   - room?:  { name?: string; number?: number | string }
 *
 * Правила формирования:
 * - Если есть block.name — добавить его.
 * - Для floor: если есть name — использовать его; иначе, если задан number — "Этаж {number}".
 * - Для room:  если есть name — использовать его; иначе, если задан number — "Помещение {number}".
 * - Элементы соединяются через разделитель " • ".
 * - Если нет ни одного элемента — вернуть "Место не указано".
 *
 * Возвращает:
 * - string — полный адрес места события или "Место не указано".
 *
 * Применение:
 * - В шаблоне: :title="getFullLocation(data)"
 *
 * Пример:
 * - { block:{name:"Поликлиника"}, floor:{number:4}, room:{number:"402"} }
 *   → "Поликлиника • Этаж 4 • Помещение 402"
 */
const getFullLocation = (data: any) => {
    const parts: string[] = []
    if (data.block?.name) parts.push(data.block.name)
    if (data.floor?.name || data.floor?.number != null) parts.push(data.floor?.name ?? `Этаж ${data.floor.number}`)
    if (data.room?.name || data.room?.number != null) parts.push(data.room?.name ?? `Помещение ${data.room.number}`)
    return parts.length ? parts.join(' • ') : 'Место не указано'
}

/**
 * Сбрасывает фильтры и обновляет данные
 */
const renewData = () => {
    apiStore.resetFilters()
    apiStore.loadAdverseEvents() // Учитывает FILTRATION_TYPE внутри стора
}

/*
/**
 * Возвращает набор кнопок действий для элемента
 * @param item - элемент события
 * @returns Массив объектов с настройками кнопок
const getActionButtons = (item: IAdverseEvent) => [
    {
        label: 'Просмотреть',
        icon: 'pi pi-map',
        command: () => {
            router.push({ name: 'view-adverse-event', params: { id: item.id } })
        },
    },
    {
        label: 'Редактировать',
        icon: 'pi pi-pen-to-square',
        command: () => {
            router.push({ name: 'edit-adverse-event', params: { id: item.id } })
        },
    },
    {
        label: 'Удалить',
        icon: 'pi pi-trash',
        command: () => {
            confirmDeleteAdverseEvent(item)
        },
    },
]
*/

/*
/**
 * Подтверждает и выполняет удаление одного или нескольких событий
 * @param eventItem - опциональный элемент для удаления
const confirmDeleteAdverseEvent = async (eventItem?: IAdverseEvent) => {
    let toDelete: IAdverseEvent[] = []

    // Определение элементов для удаления
    if (eventItem) {
        toDelete = [eventItem] // Удаляем только переданный элемент
    } else {
        // Проверка выбранных элементов
        if (selectedElements.value.length === 0) return
        toDelete = selectedElements.value
    }

    // Формирование текста подтверждения
    const numbers = toDelete.map(e => e.number)
    const plural = numbers.length > 1
    const eventText = plural
        ? `Удаление нежелательных событий № ${numbers.join(', ')}`
        : `Удаление нежелательного события № ${numbers[0]}`

    // Запрос подтверждения
    await confirmAction({ message: eventText, header: 'Подтверждение удаления'})

    // Массовое удаление
    const deletePromises = toDelete.map(e =>
        apiStore.deleteAdverseEvent({ id: e.id })
    )

    try {
        await Promise.all(deletePromises)
        await apiStore.loadAdverseEvents()
        // Очистка выбранных элементов при массовом удалении
        if (!eventItem) selectedElements.value = []
    } catch {
        // Ошибки обрабатываются внутри deleteAdverseEvent
    }
}*/

/**
 * Создает новое событие и переходит на страницу создания
 */
const createNewAdverseEvent = () => {
    apiStore.currentAdverseEvent =  {
        event_type: { id: 0 }, // Пустая строка вместо 0 (или валидный UUID если требуется)
        location: '',
        block: null,
        floor: null,
        room: null,
        department: null,
        description: '',
        cause: '',
        status: 'new', // Статус по умолчанию
        probability: null,
        consequence: null,
        date_time: '', // Дата по умолчанию (пусто)
        participants: [],
        responsibility_entries: [],
    } as ICreateAdversePayload
    apiStore.editableAdverseEvent = null
    responsibilityEntries.currentResponsibilityEntries = []
    router.push({ name: ERouteNames.CREATE_ADVERSE_EVENT })
}

/**
 * Возвращает читаемое название статуса
 * @param status - ключ статуса
 * @returns Название статуса или "—", если не указан
 */
function getStatusLabel(status: string) {
    if (!status) return '----'
    const statuses = apiStore.responsibilityEntriesStatuses
    return (statuses as Record<string, string>)[status] || status
}

/**
 * Обрабатывает изменение страницы в таблице
 * @param event - объект с параметрами пагинации
 */
function handlePageChange(event: { first: number; rows: number }) {
    // Если дошли до конца и есть next
    const lastIndex = event.first + event.rows
    if (
        lastIndex >= apiStore.adverseEvents.length &&
        apiStore.nextAdverseEventsCursor
    ) {
        // Получение cursor параметра
        const cursorParam = new URL(apiStore.nextAdverseEventsCursor).searchParams.get('cursor')
        apiStore.fetchFilteredAdverseEvents(cursorParam || undefined)
    }
}

// Добавляем обработчик клика по строке
const handleRowClick = async (event: any) => {
    const item = event.data as IAdverseEvent;
    // Просто переход к детализации без указания режима
    await router.push({
        name: ERouteNames.ADVERSE_EVENT_DETAIL,
        params: { id: item.id }
    });
};
</script>

<template>
    <!-- Основной контейнер -->
    <div class="card col-span-12">
        <!-- Панель инструментов -->
        <Toolbar class="mb-6">
            <!-- Левая часть панели -->
            <template #start>
                <!-- Кнопка добавления нового события -->
                <Button
                    :disabled="feedbackStore.isGlobalLoading || feedbackStore.isGlobalLoading"
                    label="Добавить"
                    severity="info"
                    icon="pi pi-plus"
                    class="mr-2"
                    @click="createNewAdverseEvent"
                />
            </template>

            <!-- Правая часть панели -->
            <template #end>
                <div class="flex flex-wrap gap-2">
                <!-- Кнопка сброса фильтров -->
                <Button
                    icon="pi pi-refresh"
                    severity="secondary"
                    label="Сбросить фильтры и обновить данные"
                    :loading="feedbackStore.isGlobalLoading"
                    :disabled="feedbackStore.isGlobalLoading"
                    class="mr-2"
                    @click="renewData"
                />
                <!-- Кнопка отчета (заглушка) -->
                <Button
                    :disabled="feedbackStore.isGlobalLoading"
                    label="Отчет по НС"
                    icon="pi pi-upload"
                    severity="info"
                    @click="() => {}"
                    class="mr-2"
                />
                <!-- Кнопка экспорта -->
                <Button
                    :disabled="feedbackStore.isGlobalLoading"
                    label="Экспорт"
                    icon="pi pi-upload"
                    severity="secondary"
                    @click="() => dt.exportCSV()"
                />
                </div>
            </template>
        </Toolbar>

        <!-- Таблица данных -->
        <DataTable
            @page="handlePageChange"
            @row-click="handleRowClick"
            :paginator="true"
            :rowsPerPageOptions="[10, 25, 50]"
            :rows="10"
            ref="dt"
            v-model:selection="selectedElements"
            :value="apiStore.filteredAdverseEvents"
            dataKey="id"
            tableStyle="min-width: 50rem"
            class="no-row-gaps"
        >
            <!-- Состояние пустой таблицы -->
            <template #empty>
                <div class="flex justify-center italic">Данные отсутствуют</div>
            </template>

            <!-- Колонка с номером события -->
            <Column field="number">
                <template #header>
                    <p class="font-bold mb-0">№</p>
                </template>
                <template #body="{ data }">
                    <Skeleton v-if="feedbackStore.isGlobalLoading"></Skeleton>
                    <div v-else>{{ data.number }}</div>
                </template>
            </Column>

            <!-- Колонка с отделением -->
            <Column field="department">
                <template #header>
                    <p class="font-bold">Отделение</p>
                </template>
                <template #body="{ data }">
                    <Skeleton v-if="feedbackStore.isGlobalLoading"></Skeleton>
                    <div v-else>
                        {{ apiStore.getDepartmentName(data.department?.id) }}
                    </div>
                </template>
            </Column>

            <!-- Колонка с типом события -->
            <Column field="type">
                <template #header>
                    <p class="font-bold">Вид НС</p>
                </template>
                <template #body="{ data }">
                    <Skeleton v-if="feedbackStore.isGlobalLoading"></Skeleton>
                    <div v-else>{{ apiStore.getEventTypeName(data.event_type) }}</div>
                </template>
            </Column>

            <!-- Колонка с местоположением -->
            <Column field="place">
                <template #header>
                    <p class="font-bold">Место события</p>
                </template>
                <template #body="{ data }">
                    <Skeleton v-if="feedbackStore.isGlobalLoading"></Skeleton>
                    <div v-else class="flex items-center justify-between gap-2 w-full">
                        <span class="min-w-0 truncate block">{{ getLocationType(data) }}</span>
                        <i
                            v-if="hasLocationInfo(data)"
                            class="pi pi-info-circle shrink-0 cursor-help"
                            style="font-size: 12px"
                            :title="getFullLocation(data)"
                        />
                    </div>
                </template>
            </Column>

            <!-- Колонка с описанием -->
            <Column field="description">
                <template #header>
                    <p class="font-bold">Краткое описание</p>
                </template>
                <template #body="{ data }">
                    <Skeleton v-if="feedbackStore.isGlobalLoading"></Skeleton>
                    <p v-else>{{ data.description }}</p>
                </template>
            </Column>

            <!-- Риск -->
            <Column field="risk" :style="{ 'min-width': '110px' }">
                <template #header>
                    <p class="font-bold">Риск</p>
                </template>
                <template #body="{ data }">
                    <Skeleton v-if="feedbackStore.isGlobalLoading"></Skeleton>
                    <div v-else class="flex items-center gap-2">
                        <span v-if="normalizeRisk(data.risk)" class="risk-dot" :class="riskClass(data.risk)"></span>
                        <span>{{ riskText(data.risk) }}</span>
                    </div>
                </template>
            </Column>

            <!-- Колонка со статусом -->
            <Column field="status">
                <template #header>
                    <p class="font-bold">Статус</p>
                </template>
                <template #body="{ data }">
                    <Skeleton v-if="feedbackStore.isGlobalLoading"></Skeleton>
                    <div v-else class="status-badge" :class="data.status">
                        {{ getStatusLabel(data.status) }}
                    </div>
                </template>
            </Column>

            <!-- Колонка с датой и временем -->
            <Column field="time" :style="{ 'min-width': '145px' }">
                <template #header>
                    <p class="font-bold">Дата и время события</p>
                </template>
                <template #body="{ data }">
                    <Skeleton v-if="feedbackStore.isGlobalLoading"></Skeleton>
                    <div v-else>{{ formatResponsibilityDate(data.date_time) }}</div>
                </template>
            </Column>

            <!-- Колонка с действиями -->
<!--            <Column field="action">
                <template #header>
                    <p class="font-bold">Действие</p>
                </template>
                <template #body="{ data }">
                    <SplitButton
                        label="Действия"
                        @click="() => {}"
                        :model="getActionButtons(data)"
                        severity="secondary"
                    />
                </template>
            </Column>-->
        </DataTable>
    </div>
</template>

<style scoped>
:root .risk-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    display: inline-block;
}
.risk-dot.low { background: var(--p-green-400); }
.risk-dot.medium { background: var(--p-orange-400); }
.risk-dot.high { background: var(--p-red-400); }

:deep(.p-datatable .p-datatable-tbody > tr) {
    cursor: pointer;
    transition: background-color 0.2s;
}

:deep(.p-datatable .p-datatable-tbody > tr:hover) {
    background-color: var(--table-row-hover) !important;
}

/* Отключаем выделение выбранной строки */
:deep(.p-datatable .p-datatable-tbody > tr.p-datatable-row-selected),
:deep(.p-datatable .p-datatable-tbody > tr.p-highlight) {
    background-color: inherit !important;
    color: inherit !important;
}
</style>

<script setup lang="ts">
/*
 * Компонент TicketModal — модальное окно просмотра/редактирования тикета
 *
 * Функционал:
 * - Просмотр и редактирование полей тикета (описание, категория/подкатегория, приоритет, срок).
 * - Управление вложениями: отображение существующих файлов и добавление новых.
 * - Назначение/смена координатора тикета.
 * - Работа с мероприятиями (записями ответственности) по тикету:
 *   • вкладка «Координатор тикета» — управление записями (через ResponsibilityEntries)
 *   • вкладка «Исполнитель» — карточки задач исполнителя (PerformerTask)
 * - Контроль прав доступа и режимов (создатель / инспектор / координатор / исполнитель).
 * - Безопасное закрытие диалога с подтверждением при наличии несохранённых изменений.
 *
 * Структура:
 * - Dialog с Tabs:
 *   1) «Тикет» — основная форма и вложения
 *   2) «Координатор тикета» — назначение координатора и мероприятия
 *   3) «Исполнитель» — задачи исполнителя по тикету
 *
 * Источники данных и утилиты:
 * - useTicketsStore(): текущее состояние тикета, категории, файлы, синхронизация вложений.
 * - useTicketFiles(): локальные обработчики для списка файлов (удаление/добавление).
 * - useFeedbackStore(): тосты и навигация назад.
 * - useGlobalConfirm(): подтверждение закрытия при несохранённых изменениях.
 * - useUserStore(): данные о текущем пользователе (для отображения автора).
 *
 * Особенности:
 * - Снимок исходного тикета (snapshot) хранится для сравнения изменений.
 * - Сравнение тела тикета исключает поля files и responsibility_entries.
 * - Автосинхронизация файлов при сохранении (без отдельной кнопки у FileAttach).
 */

import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

// stores & utils
import { useTicketsStore } from '@/refactoring/modules/tickets/stores/ticketsStore'
import { useTicketFiles } from '@/refactoring/utils/useTicketFiles'
import { useFeedbackStore } from '@/refactoring/modules/feedback/stores/feedbackStore'
import { useGlobalConfirm } from '@/refactoring/modules/feedback/utils/useGlobalConfirm'
import { useUserStore } from '@/refactoring/modules/user/stores/userStore'
import { openChat } from '@/refactoring/utils/openChat'
import { formatResponsibilityDate, getFullName } from '@/refactoring/utils/formatters'

// files
import FileList from '@/refactoring/modules/files/components/FileList.vue'
import FileAttach from '@/refactoring/modules/files/components/FileAttach.vue'
import StatusChip from '@/components/StatusChip.vue'

// Категории (как в ticketForm)
import FilterTreeSelect from '@/components/tableFilters/FilterTreeSelect.vue'

// Выбор координатора
import EmployeeSelectionModal from '@/components/adverseEvents/EmployeeSelectionModal.vue'
import PerformerTask from '@/components/adverseEvents/PerformerTask.vue'
import ResponsibilityEntries from '@/components/ResponsibilityEntries.vue'

// types
import type { IExistingFile } from '@/refactoring/modules/files/types/IExistingFile'
import type { ITicketDetail } from '@/refactoring/modules/tickets/types/ITicketDetail'
import type { IUpdateTicketPayload } from '@/refactoring/modules/tickets/types/IUpdateTicketPayload'
import type { TicketPriority } from '@/refactoring/modules/tickets/types/TicketPriority'
import type { ITicketCategory } from '@/refactoring/modules/tickets/types/ITicketCategory'
import type { ITreeNode } from '@/refactoring/modules/apiStore/types/ITreeNode'
import type { IVModelTreeSelect } from '@/refactoring/types/IVModelTreeSelect'
import type { IEmployee } from '@/refactoring/modules/apiStore/types/employees/IEmployee'
import type { ICreatedBy } from '@/refactoring/modules/apiStore/types/adverse-events/ICreatedBy'
import type { TreeNodeWithData } from '@/refactoring/modules/tickets/types/TreeNodeWithData'
import type { ITicketResponsibilityEntry } from '@/refactoring/modules/tickets/types/ITicketResponsibilityEntry'

const route = useRoute()
const tickets = useTicketsStore()
const ticketFiles = useTicketFiles()
const feedback = useFeedbackStore()
const confirmAction = useGlobalConfirm()
const userStore = useUserStore()

/** Видимость диалога. Управляется снаружи через @update:visible и локальный guard. */
const visible = ref(true)

/** Текущая активная вкладка диалога (0 — «Тикет», 1 — «Координатор тикета», 2 — «Исполнитель»). */
const formTab = ref<number>(0)

/** Идентификатор тикета из маршрута. При отсутствии — режим создания. */
const id = Number(route.params.id)

/**
 * Снимок исходного состояния тикета для определения факта изменений.
 * Заполняется после fetchTicket(id) и обновляется после успешного сохранения.
 */
const snapshot = ref<ITicketDetail | null>(null)

/** Существующие файлы для шаблона FileList (берутся из composable useTicketFiles). */
const existingFilesForTemplate = computed<IExistingFile[]>(() => ticketFiles.existingFiles.value)

/** Признак, что есть изменения по файлам (новые или помеченные к удалению). */
const hasFileChanges = computed(() => tickets.uploadNewFiles.length > 0 || tickets.uploadRemovedFileIds.length > 0)

/** Роли и права из текущего тикета: координатор/инспектор/создатель/исполнитель/завершён. */
const isCoordinator = computed(() => Boolean(tickets.currentTicket?.can_edit_by_coordinator))
const isInspector  = computed(() => Boolean(tickets.currentTicket?.can_edit_by_inspector))
const isCreator    = computed(() => Boolean(tickets.currentTicket?.can_edit_by_creator))
const isExecutor   = computed(() => Boolean(tickets.currentTicket?.is_executor))
const isCompleted  = computed(() => tickets.currentTicket?.status === 'completed')

/** Разрешение на редактирование вложений (создание всегда можно, существующий — если не completed и есть права) */
const canEditFiles = computed(() => {
    if (!id) return true
    return !isCompleted.value && (isCreator.value || isInspector.value || isCoordinator.value)
})

/** Можно вернуть из завершённого состояния (только инспектор). */
const canReturn = computed(() => isCompleted.value && isInspector.value)

/** Массив записей ответственности по тикету для вкладки «Исполнитель». */
const responsibilityEntries = computed<ITicketResponsibilityEntry[]>(() => {
    return tickets.currentTicket?.responsibility_entries as ITicketResponsibilityEntry[] || [];
});

/**
 * Кнопка «Сохранить»:
 * - Создание: всегда доступна.
 * - Редактирование: скрыта при completed и видна, если есть право (создатель/инспектор/координатор).
 */
const canSave = computed(() => {
    if (!id) return true
    return !isCompleted.value && (isCreator.value || isInspector.value || isCoordinator.value)
})

/**
 * Доступность вкладки «Координатор тикета»:
 * - Для существующего тикета: если есть координатор — видят инспектор/координатор; если нет — только инспектор.
 */
const canSeeCoordinatorTab = computed(() => {
    if (!id) return false
    const hasCoord = Boolean(tickets.currentTicket?.coordinator)
    return hasCoord ? (isInspector.value || isCoordinator.value) : isInspector.value
})

/** Доступность вкладки «Исполнитель»: только для существующего тикета и роли исполнителя. */
const canSeeExecutorTab = computed(() => !!id && isExecutor.value)

/** Право редактировать общую форму: только создатель и только если тикет не завершён. */
const canEditGeneral = computed(() => {
    if (!id) return true
    return !isCompleted.value && isCreator.value
})

/** Guard для предотвращения зацикливания @update:visible при перехвате закрытия. */
let guard = false


/**
 * Модель выбора в FilterTreeSelect с режимом single.
 * Хранит ключ выбранного узла в формате `c-<id>-<id>-...`.
 */
const primeTreeModal = ref<IVModelTreeSelect | null>(null)

/** Дерево категорий тикета, подготовленное для FilterTreeSelect. */
const categoryTree = computed<ITreeNode[]>(() => toTreeNodes(tickets.categories ?? []))

/**
 * Обработчик изменения выбора категории/подкатегории в древе.
 *
 * Назначение:
 * - Разбирает выбранный ключ и проставляет tickets.currentTicket.category.id.
 * - Поддерживает произвольную глубину (берётся последний id в цепочке).
 *
 * Параметры:
 * - selected: IVModelTreeSelect | null — новое значение модели FilterTreeSelect.
 *
 * Побочные эффекты:
 * - Обновляет primeTreeModal (подсветка выбранного ключа).
 * - Обновляет tickets.currentTicket.category.
 */
function onChangeTreeSelectModal(selected: IVModelTreeSelect | null): void {
    const keys = selected ? Object.keys(selected as Record<string, boolean>) : []
    if (!keys.length) {
        primeTreeModal.value = null
        if (tickets.currentTicket) tickets.currentTicket.category = { id: 0, name: '' }
        return
    }
    const key = keys[0]
    const raw = key.replace(/^c-/, '')
    const ids = raw.split('-').map(Number).filter(Number.isFinite)
    const chosen = ids.length ? ids[ids.length - 1] : 0
    if (tickets.currentTicket) tickets.currentTicket.category = { id: chosen, name: '' }
    primeTreeModal.value = { [key]: true } as IVModelTreeSelect
}

/**
 * Преобразует массив категорий (с потомками) в ITreeNode[] для FilterTreeSelect.
 *
 * Параметры:
 * - cats: ITicketCategory[] — список категорий.
 * - level: number — текущий уровень вложенности (служебный).
 *
 * Возвращает:
 * - ITreeNode[] — массив узлов дерева, где key формируется как `c-<id>-...` по пути.
 */
const toTreeNodes = (cats: ITicketCategory[] = [], level = 1): ITreeNode[] => {
    return cats.map((cat) => {
        const kids = (cat.childrens ?? []) as ITicketCategory[]
        const hasChildren = Array.isArray(kids) && kids.length > 0

        const node: ITreeNode = {
            key: `c-${cat.id}`,
            label: cat.name,
            icon: hasChildren ? 'pi pi-folder' : 'pi pi-tag',
            data: { name: cat.name, position: level, selfId: String(cat.id) },
            children: [],
        }

        if (hasChildren) {
            node.children = toTreeNodes(kids, level + 1).map((child) => ({
                ...child,
                key: `${node.key}-${child.data.selfId}`,
            }))
        }
        return node
    })
}

/**
 * Находит ключ узла в дереве категорий по числовому id.
 *
 * Параметры:
 * - nodes: TreeNodeWithData[] — корневые узлы дерева.
 * - idNum: number — искомый id категории.
 *
 * Возвращает:
 * - string | null — ключ в формате `c-<...>` или null.
 */
const findKeyById = (nodes: TreeNodeWithData[], idNum: number): string | null => {
    const target = String(idNum)
    for (const n of nodes) {
        if (n.data?.selfId === target) return n.key
        if (n.children?.length) {
            const hit = findKeyById(n.children, idNum)
            if (hit) return `${n.key}-${hit.split('-').slice(-1)[0]}`
        }
    }
    return null
}

/**
 * deadline_time ⇄ Date
 *
 * Назначение:
 * - Двусторонняя модель для DatePicker. В геттере парсит ISO-строку в Date,
 *   в сеттере сохраняет ISO-строку в tickets.currentTicket.deadline_time.
 *
 * Возвращает:
 * - Date | null
 * Побочный эффект:
 * - Изменяет tickets.currentTicket.deadline_time при записи.
 */
const deadlineDateModel = computed<Date | null>({
    get() {
        const v = tickets.currentTicket?.deadline_time
        if (!v) return null
        const dt = new Date(v)
        return isNaN(dt.getTime()) ? null : dt
    },
    set(val) {
        if (!tickets.currentTicket) return
        tickets.currentTicket.deadline_time = val ? new Date(val).toISOString() : null
    },
})

/**
 * Изменение приоритета.
 *
 * Параметры:
 * - val: number | null — новое значение опции Select.
 *
 * Побочный эффект:
 * - Обновляет tickets.currentTicket.priority.
 */
function onPriorityChange(val: number | null) {
    if (!tickets.currentTicket) return
    tickets.currentTicket.priority = Number(val ?? 0) as TicketPriority
}

/**
 * Сохранение тикета.
 *
 * Алгоритм:
 * 1. Проверяет, есть ли изменения в теле тикета (без files и responsibility_entries).
 * 2. Если изменилось — собирает payload через tickets.buildFormStateFromTicket и отправляет updateTicket(id, payload).
 * 3. Всегда вызывает tickets.syncTicketFiles(id, 'update') для синхронизации вложений.
 * 4. Обновляет snapshot текущим состоянием.
 * 5. Показывает тост об успехе и закрывает диалог.
 *
 * Ошибки:
 * - Показывает тост об ошибке и оставляет диалог открытым.
 */
async function onSave() {
    if (!id || !tickets.currentTicket) return
    const bodyChanged = JSON.stringify(comparableTicket(tickets.currentTicket)) !== JSON.stringify(comparableTicket(snapshot.value))
    try {
        if (bodyChanged) {
            const payload: IUpdateTicketPayload = tickets.buildFormStateFromTicket(
                tickets.currentTicket,
            ) as unknown as IUpdateTicketPayload
            await tickets.updateTicket(id, payload)
        }

        await tickets.syncTicketFiles(id, 'update')
        snapshot.value = deepClone(tickets.currentTicket)
        feedback.showToast({ type: 'success', title: 'Успех', message: 'Тикет обновлён' })
        visible.value = false
        history.back()
    } catch {
        feedback.showToast({ type: 'error', title: 'Ошибка', message: 'Не удалось сохранить тикет' })
    }
}

/**
 * Глубокое клонирование объекта тикета для хранения snapshot (без реактивности).
 *
 * Параметры:
 * - obj: T — исходный объект.
 *
 * Возвращает:
 * - T — JSON-копия объекта.
 */
function deepClone<T>(obj: T): T { return obj ? (JSON.parse(JSON.stringify(obj)) as T) : obj }

/**
 * Подготовка объекта к сравнению («тело тикета»):
 * - Исключает поля files и responsibility_entries.
 * - Приводит category к виду { id: number }.
 *
 * Параметры:
 * - src: ITicketDetail | null
 *
 * Возвращает:
 * - Record<string, any> — нормализованное тело тикета для сравнения/диффа.
 */
function comparableTicket(src: ITicketDetail | null): Record<string, any> {
    if (!src) return {}
    const { files, responsibility_entries, ...rest } = src
    const categoryId = src.category?.id ?? 0
    return { ...rest, category: { id: Number(categoryId) } }
}

/**
 * Перехват @update:visible у Dialog.
 *
 * Назначение:
 * - Предотвращает закрытие при наличии несохранённых изменений.
 * - Сравнивает текущее состояние (comparableTicket + файлы) со snapshot.
 * - При изменениях показывает confirm; по accept — закрывает, по cancel — оставляет открытым.
 *
 * Параметры:
 * - next: boolean — целевое состояние видимости (false — попытка закрыть).
 */
async function onUpdateVisible(next: boolean) {
    if (next) { visible.value = true; return }
    visible.value = true
    if (guard) return
    guard = true
    await nextTick()

    const cur = comparableTicket(tickets.currentTicket || null)
    const base = comparableTicket(snapshot.value)
    const bodyChanged = JSON.stringify(cur) !== JSON.stringify(base)
    const changed = bodyChanged || hasFileChanges.value

    if (!changed) {
        guard = false
        visible.value = false
        history.back()
        return
    }

    try {
        await confirmAction({
            message: id ? 'Отменить изменения в заявке?' : 'Отменить создание заявки?',
            header: 'Подтвердите действие',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Да, отменить',
            rejectLabel: 'Нет, продолжить',
            acceptClass: 'p-button-secondary',
        })
        guard = false
        visible.value = false
        history.back()
    } catch {
        guard = false
        visible.value = true
    }
}

/** Видимость модалки выбора сотрудника для назначения координатора. */
const showEmployeeModal = ref(false)

/** Текст кнопки для координатора (сменить/назначить). */
const coordinatorLabel = computed(() => (tickets.currentTicket?.coordinator ? 'Сменить координатора' : 'Назначить координатора'))

/** Назначать/переназначать координатора: инспектор ИЛИ координатор, не завершённый тикет */
const canEditCoordinatorAssign = computed(() => !isCompleted.value && (isInspector.value || isCoordinator.value))

/** Работать с журналом мероприятий (ResponsibilityEntries): инспектор ИЛИ координатор, не завершённый тикет */
const canEditEntries = computed(() => !isCompleted.value && (isInspector.value || isCoordinator.value))

/**
 * Преобразование IEmployee → ICreatedBy для совместимости структуры координатора.
 *
 * Параметры:
 * - emp: IEmployee — выбранный сотрудник.
 *
 * Возвращает:
 * - ICreatedBy — объект для записи в tickets.currentTicket.coordinator.
 */
function mapEmployeeToCreatedBy(emp: IEmployee): ICreatedBy { // [REPLACE]
    return {
        id: emp.id,
        snils: emp.snils ?? '', // ICreatedBy требует string; пустую заменяем на ''
        phone_number: emp.phone_number ?? '', // [FIX]
        email: emp.email ?? '', // [FIX]
        last_name: emp.last_name,
        first_name: emp.first_name,
        middle_name: emp.middle_name ?? '',
        gender: (emp as any).gender ?? 'М', // если в IEmployee нет — дефолт 'М'
        birth_date: emp.birth_date ?? '', // строка YYYY-MM-DD или ''
        position: emp.position as any, // позиция из IEmployee совместима с IPosition
        department: emp.department as any, // департамент из IEmployee совместим с IDepartment
        description: (emp as any).description ?? '',
        hire_date: (emp as any).hire_date ?? '',
        groups: (emp as any).groups ?? [],
        is_manager: Boolean((emp as any).is_manager),
    }
}


/**
 * Обработчик выбора сотрудника из модалки:
 * - Присваивает или очищает координатора тикета.
 *
 * Параметры:
 * - employee: IEmployee | null — выбранный сотрудник или null (очистить).
 *
 * Побочный эффект:
 * - Обновляет tickets.currentTicket.coordinator.
 */
function onEmployeeSelected(employee: IEmployee | null) { // [REPLACE]
    if (!tickets.currentTicket) return
    tickets.currentTicket.coordinator = employee ? mapEmployeeToCreatedBy(employee) : null
}

/**
 * [DOC] serverSignature — стабильная сигнатура *только серверных полей* тикета.
 * Назначение:
 *   - Компактно отражать изменения, которые приходят с бэка (status и права),
 *     чтобы триггерить вотчер ниже *без ложных срабатываний* от локальных правок.
 * Состав полей:
 *   - status, can_take_in_progress, can_complete,
 *     can_edit_by_creator, can_edit_by_inspector, can_edit_by_coordinator, is_executor
 * Возврат:
 *   - string JSON; пустая строка, если currentTicket отсутствует.
 * Используется:
 *   - watch(serverSignature) — реагирует на смену статуса/прав с сервера.
 */
const serverSignature = computed(() => {
    const t = tickets.currentTicket
    if (!t) return ''
    return JSON.stringify({
        status: t.status,
        can_take_in_progress: t.can_take_in_progress,
        can_complete: t.can_complete,
        can_edit_by_creator: t.can_edit_by_creator,
        can_edit_by_inspector: t.can_edit_by_inspector,
        can_edit_by_coordinator: t.can_edit_by_coordinator,
        is_executor: t.is_executor,
    })
})


/**
 * [DOC] comparableTicketWithoutServerFields — тело тикета *без серверных полей*.
 * Назначение:
 *   - Сравнивать локальные правки пользователя с snapshot, игнорируя поля,
 *     которые меняет только сервер (status/права), и игнорируя файлы.
 * Параметры:
 *   - src: ITicketDetail | null — источник (текущий тикет или snapshot).
 * Возврат:
 *   - object — «очищенное» тело тикета:
 *       • исключены: files, responsibility_entries, status и все can_* / is_executor
 *       • category нормализована до { id }
 * Детали реализации:
 *   - Исключение полей делается деструктуризацией (без delete), чтобы избежать TS-ошибок.
 */
function comparableTicketWithoutServerFields(src: ITicketDetail | null): object {
    if (!src) return {}
    const {
        files: _files,
        responsibility_entries: _entries,
        status: _status,
        can_take_in_progress: _tip,
        can_complete: _cc,
        can_edit_by_creator: _cec,
        can_edit_by_inspector: _cei,
        can_edit_by_coordinator: _ceo,
        is_executor: _ie,
        ...rest
    } = src
    const categoryId = src.category?.id ?? 0
    return { ...rest, category: { id: Number(categoryId) } }
}

/**
 * [DOC] watch(serverSignature) — фиксация серверных изменений в snapshot.
 * Когда срабатывает:
 *   - При любом изменении «серверной сигнатуры» (status/права) текущего тикета.
 * Алгоритм:
 *   1) Формируем «очищенные» версии текущего тикета и snapshot без серверных полей.
 *   2) Проверяем отсутствие локальных правок:
 *        hasLocalEdits = (curNoSrv !== baseNoSrv) || hasFileChanges
 *   3) Если локальных правок нет — обновляем snapshot до актуального currentTicket.
 * Побочные эффекты:
 *   - Обновляет только snapshot (deepClone), *не* вызывает API и *не* сохраняет тикет.
 * Зависимости:
 *   - tickets.currentTicket, snapshot, hasFileChanges, deepClone
 */
watch(serverSignature, () => {
    if (!tickets.currentTicket) return
    const curNoSrv = comparableTicketWithoutServerFields(tickets.currentTicket)
    const baseNoSrv = comparableTicketWithoutServerFields(snapshot.value)

    const hasLocalEdits =
        JSON.stringify(curNoSrv) !== JSON.stringify(baseNoSrv) || hasFileChanges.value

    if (!hasLocalEdits) {
        snapshot.value = deepClone(tickets.currentTicket)
    }
})



/**
 * Инициализация компонента:
 * 1) Загружает категории (если не загружены).
 * 2) Если есть id — получает тикет, делает snapshot, восстанавливает выделение категории в TreeSelect.
 */
onMounted(async () => {
    if (!tickets.categories?.length) {
        try { await tickets.fetchCategories() } catch {}
    }

    if (id) {
        await tickets.fetchTicket(id)
        snapshot.value = deepClone(tickets.currentTicket || null)

        const currentId = Number(tickets.currentTicket?.category?.id || 0)
        const key = currentId ? findKeyById(categoryTree.value, currentId) : null
        primeTreeModal.value = key ? ({ [key]: true } as IVModelTreeSelect) : null
    }
})
</script>

<template>
    <Dialog
        :visible="visible"
        :modal="true"
        @update:visible="onUpdateVisible"
        :auto-focus="false"
        class="w-[900px]"
    >
        <template #header>
            <div class="flex items-center justify-between gap-3 flex-nowrap w-full min-h-[44px]">
                <h2 class="flex-1 min-w-0 m-0 font-semibold text-[18px] truncate">
                    <template v-if="tickets.currentTicket">
                        #{{ tickets.currentTicket.number }} — {{ tickets.currentTicket.title || 'Без названия' }}
                    </template>
                    <template v-else>Заявка</template>
                </h2>

                <StatusChip v-if="tickets.currentTicket" :status="tickets.currentTicket?.status" />
            </div>
        </template>

        <div v-if="tickets.currentTicket" class="ticket-modal">
            <!-- Tabs -->
            <Tabs :value="formTab" @update:value="(v) => (formTab = Number(v))">
                <TabList>
                    <Tab :value="0">Заявка</Tab>
                    <Tab :value="1" v-if="canSeeCoordinatorTab">Координатор заявки</Tab>
                    <Tab :value="2" v-if="canSeeExecutorTab">Исполнитель</Tab>
                </TabList>

                <TabPanels>

                    <TabPanel :value="0" class="ticket-form">
                        <!-- Описание -->
                        <section class="mb-4">
                            <label for="description" class="font-semibold mb-1.5 inline-block">Описание</label>
                            <Textarea
                                id="description"
                                v-model="tickets.currentTicket.description"
                                rows="4"
                                class="w-full"
                                :readonly="!canEditGeneral"
                                :disabled="!canEditGeneral"
                            />
                        </section>

                        <!-- Вложения -->
                        <section class="mt-4" aria-label="Вложения">
                            <h3 class="font-semibold mb-2">Вложения</h3>
                            <FileList
                                v-if="existingFilesForTemplate.length"
                                :items="existingFilesForTemplate"
                                :disabled="!canEditFiles"
                                @remove="ticketFiles.onExistingFileRemove"
                                class="mb-2"
                            />

                            <FileAttach
                                :files="(ticketFiles.files as unknown as File[])"
                                @update:files="ticketFiles.onUpdateFiles"
                                :accept="'*'"
                                :disabled="!canEditFiles"
                            />
                        </section>

                        <!-- Доп. поля под раскрывашкой -->
                        <Panel v-if="canEditGeneral" header="Редактирование заявки" toggleable collapsed class="mt-4">
                            <section class="grid gap-3 bg-[var(--surface-card)] p-3 rounded-xl mt-1" aria-label="Дополнительные поля">
                                <div class="grid grid-cols-12 gap-3">
                                    <div class="col-span-12">
                                        <label class="font-semibold mb-1.5 inline-block" for="ticket_title">Заголовок</label>
                                        <input
                                            id="ticket_title"
                                            type="text"
                                            class="w-full p-inputtext p-component"
                                            v-model="tickets.currentTicket.title"
                                            placeholder="Заголовок"
                                            :readonly="!canEditGeneral"
                                            :disabled="!canEditGeneral"
                                        />
                                    </div>
                                </div>

                                <div class="grid grid-cols-12 gap-3">
                                    <div class="col-span-12">
                                        <label class="font-semibold mb-1.5 inline-block">Категория / подкатегория</label>
                                        <FilterTreeSelect
                                            id="ticket_category"
                                            :labelFor="'ticket_category'"
                                            :className="['w-full']"
                                            :selectionMode="'single'"
                                            :options="categoryTree"
                                            v-model="primeTreeModal"
                                            :changeHandler="onChangeTreeSelectModal"
                                            placeholder="Выберите категорию и подкатегорию"
                                            :disabled="!canEditGeneral"
                                        />
                                    </div>
                                </div>

                                <div class="grid grid-cols-12 gap-3">
                                    <div class="col-span-12 md:col-span-6">
                                        <label class="font-semibold mb-1.5 inline-block">Приоритет</label>
                                        <Select
                                            input-id="priority"
                                            class="w-full"
                                            :options="tickets.priorityOptions"
                                            option-label="label"
                                            option-value="value"
                                            :model-value="tickets.currentTicket?.priority ?? (0 as TicketPriority)"
                                            @update:model-value="onPriorityChange"
                                            :disabled="!canEditGeneral"
                                        />
                                    </div>
                                    <div class="col-span-12 md:col-span-6">

                                        <label for="deadline_time" class="font-semibold mb-1.5 inline-block">Срок выполнения</label>
                                        <DatePicker
                                            id="deadline_time"
                                            v-model="deadlineDateModel"
                                            showTime
                                            showIcon
                                            class="w-full"
                                            :readonly="!canEditGeneral"
                                            :disabled="!canEditGeneral"
                                        />
                                    </div>
                                </div>
                            </section>
                        </Panel>
                    </TabPanel>

                    <!-- Вкладка: Координатор тикета -->
                    <TabPanel :value="1">
                        <div class="coordinator">
                            <div class="flex gap-2 items-center mb-2">
                                <span class="font-semibold">Текущий координатор -</span>
                                <span class="coordinator__value">
                  <template v-if="tickets.currentTicket?.coordinator">
                    {{ tickets.currentTicket.coordinator!.last_name }}
                    {{ tickets.currentTicket.coordinator!.first_name }}
                    {{ tickets.currentTicket.coordinator!.middle_name }}
                  </template>
                  <template v-else>Не назначен</template>
                </span>
                            </div>
                            <div class="mt-1">
                                <Button
                                    :label="coordinatorLabel"
                                    variant="link"
                                    class="!pl-0"
                                    @click="showEmployeeModal = true"
                                    :disabled="!canEditCoordinatorAssign"
                                />
                            </div>

                            <ResponsibilityEntries
                                :disabled="!canEditEntries"
                                :is-active="formTab === 1"
                                :entity-type="'ticket'"
                                :canReturn="canReturn"
                            />

                        </div>
                    </TabPanel>

                    <!-- Вкладка: Исполнитель -->
                    <TabPanel :value="2">
                        <div class="executor">
                            <performer-task
                                v-for="(t, i) in responsibilityEntries"
                                :key="i"
                                :event-id="id"
                                :entry-id="t.id as number"
                                :supervisor="t.supervisor || null"
                                :instructions="t.instructions || ''"
                                :deadline="t.deadline_time"
                                :existing-report="t.completion_report || ''"
                                :can-complete="t.can_complete"
                                :can-take="t.can_take_in_progress"
                                :status="t.status"
                                :responsible-employee="t.responsible_employee"
                                :entity-type="'ticket'"
                                :can-return="canReturn"
                            />
                        </div>
                    </TabPanel>
                </TabPanels>
            </Tabs>

            <!-- Кнопки формы -->
            <div class="flex justify-end gap-3 mt-4">
                <Button text label="Отмена" icon="pi pi-times" @click="onUpdateVisible(false)" />
                <Button v-if="canSave" label="Сохранить" icon="pi pi-check" @click="onSave" />
            </div>

            <!-- Автор -->
            <div
                class="hidden md:flex items-center gap-2 ml-4 text-sm text-surface-600 dark:text-surface-300"
            >
                <template v-if="!route.params.id">
                    <!-- Режим создания - показываем текущего пользователя -->
                    <span>Создатель - </span>
                    <span>{{ getFullName(userStore.user ?? {}) }}</span>
                    <i class="pi pi-building"></i>
                    <span>{{
                            userStore.user?.department?.name || 'Подразделение не указано'
                        }}</span>
                </template>
                <template v-else>
                    <div
                        class="flex-col items-center gap-2 ml-4 text-sm text-surface-600 dark:text-surface-300"
                    >
                        <div
                            class="md:flex items-center gap-2 ml-4 mb-4 text-sm text-surface-600 dark:text-surface-300"

                        >
                            <!-- Режим редактирования/просмотра - показываем автора события -->
                            <div
                                class="md:flex gap-2 text-sm text-surface-600 dark:text-surface-300 cursor-pointer"
                                @click.prevent="openChat(tickets.currentTicket?.created_by?.id)"
                            >
                                <span>Создатель - </span>
                                <span>{{ getFullName(tickets.currentTicket?.created_by ?? {}) }}</span>
                                <i class="pi pi-building"></i>
                                <span>{{
                                        tickets.currentTicket?.created_by?.department?.name ||
                                        'Подразделение не указано'
                                    }}</span>
                            </div>
                            <i class="pi pi-clock text-xs"></i>
                            <span class="cursor-default" title="Дата создания НС">{{  formatResponsibilityDate(tickets.currentTicket?.created_at) || 'Не удалось определить дату создания тикета' }}</span>
                        </div>
                        <div
                            class="md:flex items-center gap-2 ml-4 text-sm text-surface-600 dark:text-surface-300 cursor-pointer 2222"
                            @click.prevent="openChat(tickets.currentTicket?.coordinator?.id)"
                        >
                            <!-- Координатор -->
                            <span>Координатор заявки - </span>
                            <span>{{
                                    tickets.currentTicket?.coordinator
                                        ? getFullName(tickets.currentTicket?.coordinator)
                                        : 'Координатор не назначен'
                                }}</span>
                            <i class="pi pi-building"></i>
                            <span>{{
                                    tickets.currentTicket?.coordinator?.department?.name ||
                                    'Подразделение не указано'
                                }}</span>
                        </div>
                    </div>
                </template>
            </div>
        </div>
    </Dialog>

    <!-- Модалка выбора сотрудника для назначения координатора тикета -->
    <EmployeeSelectionModal
        v-model:visible="showEmployeeModal"
        target="ticket"
        @employee-selected="onEmployeeSelected"
    />
</template>

<style scoped lang="scss">
</style>



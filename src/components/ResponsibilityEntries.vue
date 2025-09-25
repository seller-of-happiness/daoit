<script setup lang="ts">
/*
* Компонент: ResponsibilityEntries — управление записями в журнале ответственности по НС.
*
* Назначение:
* - Добавление новой записи ответственности (исполнитель, задача, срок).
* - Просмотр истории записей с пагинацией и раскрытием длинных описаний.
* - Управление фокусом и UX (автофокус, сохранение контекста фильтра).
* - Валидация обязательных полей с выводом ошибок (toast).
* - Действия по НС: взять в работу / завершить (с подтверждением при незавершённых задачах).
*
* Поток данных:
* - Форма → responsibilityEntriesStore (через responsibilityEntry и методы стора).
* - Кнопки действий → apiStore.takeAdverseEvent / apiStore.completeAdverseEvent → обновление списков событий.
*
* UI:
* - Форма видима при создании записи или по кнопке «Добавить исполнителя».
* - История в DataTable с колонками «От», «Кому», «Описание», «Дата», «Статус».
*/

// Vue core: реактивность/жизненный цикл/роут
import { computed, watch, ref, nextTick, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'

// Stores
import { useApiStore } from '@/refactoring/modules/apiStore/stores/apiStore'
import { useResponsibilityEntries } from '@/refactoring/modules/responsibilityEntries/stores/responsibilityEntriesStore'
import { useFeedbackStore } from '@/refactoring/modules/feedback/stores/feedbackStore'
import { useTicketsStore } from '@/refactoring/modules/tickets/stores/ticketsStore'
import { storeToRefs } from 'pinia'

// Утилиты форматирования и компоненты UI
import { getFullName, formatResponsibilityDate, formatShortName } from '@/refactoring/utils/formatters'
import { useGlobalConfirm } from '@/refactoring/modules/feedback/utils/useGlobalConfirm'
import EmployeeSelectionModal from '@/components/adverseEvents/EmployeeSelectionModal.vue'

// Типы
import type { IEmployee } from '@/refactoring/modules/apiStore/types/employees/IEmployee'
import type { IResponsibilityEmployee } from '@/refactoring/modules/responsibilityEntries/types/IResponsibilityEmployee'
import type { IResponsibilityEntry } from '@/refactoring/modules/responsibilityEntries/types/IResponsibilityEntry'
import type { ICreateResponsibilityEntryPayload } from '@/refactoring/modules/responsibilityEntries/types/payloads/ICreateResponsibilityEntryPayload'


// Инициализация хранилищ
const apiStore = useApiStore()
const responsibilityEntriesStore = useResponsibilityEntries()
const feedbackStore = useFeedbackStore()
const confirmAction = useGlobalConfirm()
const ticketsStore = useTicketsStore()

// Реактивные ссылки на состояния хранилищ
const {
    /*departments,*/
} = storeToRefs(apiStore)

const {
    responsibilityEntry,
    isCreatingEntry,
    fieldValidation,
} = storeToRefs(responsibilityEntriesStore)

/**
 * Props:
 * - isActive: boolean — активна ли вкладка с компонентом (используется для фокус-логики).
 * - disabled: boolean — блокировка внешних действий (например, кнопок).
 * - canReturn: boolean — отображать кнопку «Вернуть».
 * - entityType: string — тип сущности: 'adverse' (НС) или 'ticket'.
 */
const props = defineProps({
    isActive: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    canReturn: { type: Boolean, default: false },
    entityType: { type: String, default: 'adverse' }
})

/** id текущей НС из маршрута. */
const route = useRoute()
const id = Number(route.params.id)


/**
 * События:
 * - 'entry-added' — эмитится после успешного добавления временной записи в стора.
 */
const emit = defineEmits(['entry-added'])

// Состояния компонента
/** Видимость формы (true при создании новой записи, иначе управляется действиями). */
const isFormVisible = ref(!id)

/** Видимость модалки выбора исполнителя. */
const showEmployeeModal = ref(false)

/** Массив id раскрытых описаний в таблице истории. */
const expandedDescriptionIds = ref<number[]>([])

/**
 * Вычисляемая ссылка на текущую сущность
 *
 * - Для `ticket` → возвращает `ticketsStore.currentTicket`
 * - Для `adverse` → возвращает `apiStore.currentAdverseEvent`
 */
const currentEntity = computed(() => {
    return props.entityType === 'ticket'
        ? ticketsStore.currentTicket
        : apiStore.currentAdverseEvent
})

/**
 * Вычисляемый список записей ответственности текущей сущности
 *
 * - Возвращает массив responsibility_entries или пустой список
 * - Приводит тип к `IResponsibilityEntry[]`
 */
const responsibilityEntriesList = computed<IResponsibilityEntry[]>(() => {
    const entries = currentEntity.value?.responsibility_entries
    return Array.isArray(entries) ? entries as IResponsibilityEntry[] : []
})

/**
 * Возвращает локализованный текст статуса записи ответственности
 *
 * Основные действия:
 * - Проверяет наличие статуса
 * - Находит текстовое соответствие в `apiStore.responsibilityEntriesStatuses`
 * - Если соответствия нет — возвращает исходный статус
 */
const getStatusText = (status: string | undefined) => {
    if (!status) return '----'
    const statusMap = apiStore.responsibilityEntriesStatuses
    return statusMap[status as keyof typeof statusMap] || status
}


/**
 * Активация режима создания новой записи
 *
 * Устанавливает флаг isCreatingEntry в true и открывает форму для создания новой записи.
 * Используется при переходе к созданию новой записи в журнале/форме.
 */
function activateValidation() {
    isCreatingEntry.value = true
    showForm()
}

/**
 * Форматирование имени сотрудника для отображения
 *
 * Использует функцию getFullName для преобразования объекта сотрудника
 * в строку формата "Фамилия Имя Отчество"
 */
const employeeToLabel = computed(() =>
    responsibilityEntry.value.responsible_employee
        ? getFullName(
            apiStore.employees.find((e) => e.id === responsibilityEntry.value.responsible_employee?.id) ?? {}
        )
        : ''
)


/**
 * Вычисляемое свойство для DatePicker
 *
 * Преобразует строку deadline_time в объект Date и обратно
 * с обработкой невалидных значений
 */
const deadlineDateModel = computed<Date | null>({
    get() {
        if (!responsibilityEntry.value.deadline_time) return null
        const dt = new Date(responsibilityEntry.value.deadline_time as string)
        return isNaN(dt.getTime()) ? null : dt
    },
    set(val) {
        responsibilityEntry.value.deadline_time = val
            ? val instanceof Date ? val.toISOString() : String(val)
            : null
    }
})

/**
 * Обработчик отправки формы записи ответственности
 *
 * Основные действия:
 * 1. Валидирует данные перед отправкой
 * 2. Для тикетов — формирует payload и создаёт запись на сервере
 * 3. Для НС — добавляет временную запись в стор
 * 4. Сбрасывает форму и генерирует событие `entry-added`
 */
async function onSubmit(): Promise<void> {
    if (!validateResponsibilityEntry()) return;

    if (props.entityType === 'ticket') {
        // Для тикетов - сразу создаем запись на сервере
        try {
            const f = responsibilityEntry.value;

            const payload: ICreateResponsibilityEntryPayload = {
                event_id: Number(id),
                department_from: f.department_from ? {
                    id: String(f.department_from.id),
                    name: f.department_from.name ?? ''
                } : null,
                supervisor: f.supervisor ? {
                    id: String(f.supervisor.id),
                    first_name: f.supervisor.first_name ?? '',
                    last_name: f.supervisor.last_name ?? '',
                    middle_name: f.supervisor.middle_name ?? '',
                    gender: f.supervisor.gender ?? 'М',
                    phone_number: f.supervisor.phone_number ?? null,
                    birth_date: f.supervisor.birth_date ?? null
                } : null,
                department_to: f.department_to ? {
                    id: String(f.department_to.id)
                } : null,
                responsible_employee: f.responsible_employee ? {
                    id: String(f.responsible_employee.id),
                    name: f.responsible_employee.name ?? ''
                } : null,
                instructions: f.instructions ?? '',
                completion_report: f.completion_report ?? '',
                urgency: Number(f.urgency ?? 1),
                deadline_time: f.deadline_time ? new Date(f.deadline_time).toISOString() : null,
                files: []
            };

            await responsibilityEntriesStore.createTicketResponsibilityEntry(payload);
            await ticketsStore.fetchTicket(Number(id));
        } catch (error) {
            console.error('Ошибка при создании записи ответственности для тикета:', error);
            return;
        }
    } else {
        // Для НС - добавляем временную запись
        responsibilityEntriesStore.pushTempResponsibilityEntry();
    }

    isFormVisible.value = false;
    responsibilityEntry.value.responsible_employee = null;
    responsibilityEntry.value.instructions = '';
    responsibilityEntry.value.deadline_time = null;

    emit('entry-added');
}

/**
 * Фильтрация сотрудников по выбранному отделу
 *
 * Возвращает:
 * - Всех сотрудников, если отдел не выбран
 * - Сотрудников выбранного отдела, если отдел указан
 */
const filteredEmployees = computed(() => {
    if (!responsibilityEntry.value.department_to?.id) return apiStore.employees
    return apiStore.employees.filter(
        emp => emp.department?.id === responsibilityEntry.value.department_to?.id
    )
})

/**
 * Показ формы создания мероприятия
 */
function showForm() {
    isFormVisible.value = true
}


/**
 * Обработчик выбора сотрудника в модальном окне
 *
 * 1. Устанавливает выбранного сотрудника
 * 2. Автоматически подставляет отдел сотрудника, если он есть
 */
function onEmployeeSelected(employee: IEmployee | null) {
    if (!employee) {
        // Очистка выбора
        responsibilityEntry.value.responsible_employee = null
        return
    }

    // Установка выбранного сотрудника
    responsibilityEntry.value.responsible_employee = employee
}

/**
 * Обработчик передачи мероприятия
 *
 * 1. Устанавливает режим формы в 'transfer'
 * 2. Показывает форму
 */
/*function onTransferClick() {
    responsibilityEntriesStore.setFormMode('transfer')
    showForm()
}*/

/**
 * Наблюдатель за изменением отдела
 *
 * Сбрасывает выбранного сотрудника, если его отдел не совпадает
 * с выбранным отделом
 */
watch(
    () => responsibilityEntry.value.department_to?.id,
    (newDepId) => {
        if (!newDepId) return
        const emp = responsibilityEntry.value.responsible_employee
        if (!emp) return
        // Находим сотрудника по id и сравниваем department.id
        const employeeFromStore = apiStore.employees.find(e => e.id === emp.id)
        if (!employeeFromStore || employeeFromStore.department?.id !== newDepId) {
            responsibilityEntry.value.responsible_employee = null
        }
    }
)

/** Dropdown «В отдел»: ссылка на компонент и текущая строка фильтра (для UX). */
const departmentToDropdown = ref()
const departmentFilter = ref('')

/**
 * focusDepartmentTrigger()
 * - Ставит фокус на триггер Dropdown «В отдел» (role="combobox" / data-pc-section="trigger").
 * - Вызывать после nextTick.
 */
function focusDepartmentTrigger() {
    nextTick(() => {
        const root = departmentToDropdown.value?.$el
        if (!root) return
        const trigger =
            root.querySelector('[role="combobox"]') ||
            root.querySelector('[data-pc-section="trigger"]') ||
            root.querySelector('.p-dropdown')
        if (trigger && typeof trigger.focus === 'function') trigger.focus()
    })
}

// Фокус при любом входе на вкладку, но только когда форма видима
watch(
    () => props.isActive,
    (active) => { if (active && isFormVisible.value) focusDepartmentTrigger() }
)

// Фокус при первом показе формы, если вкладка уже активна
watch(
    isFormVisible,
    (visible) => { if (visible && props.isActive) focusDepartmentTrigger() }
)

// === Автофокус поиска и синхронизация фильтра для "В отдел" ===
/** MO и кэш input'ов фильтра дропдауна «В отдел» (для автофокуса и бинда). */
let deptToMO: MutationObserver | null = null
const deptToBoundInputs = new WeakSet<HTMLInputElement>()

/**
 * bindDepartmentToFilterInput()
 * - Находит input фильтра внутри overlay Dropdown «В отдел» ('.p-select-filter').
 * - Ставит автофокус+select и синхронизирует текст в departmentFilter.
 * - Биндится один раз на конкретный input (через WeakSet).
 */
function bindDepartmentToFilterInput() {
    const root = departmentToDropdown.value?.$el as HTMLElement | undefined
    if (!root) return

    // инпут фильтра внутри overlay (PrimeVue рендерит .p-select-filter)
    const input = root.querySelector('input.p-select-filter') as HTMLInputElement | null
    if (input && !deptToBoundInputs.has(input)) {
        deptToBoundInputs.add(input)

        // автофокус и выделение текста при каждом появлении overlay
        setTimeout(() => {
            input.focus()
            input.select()
        }, 0)

        // текст фильтра -> реактивная переменная для подсветки
        input.addEventListener(
            'input',
            (e) => { departmentFilter.value = (e.target as HTMLInputElement).value || '' },
            { passive: true },
        )
    }
}

/**
 * Монтирование/размонтирование:
 * - Навешивает MutationObserver на корень Dropdown «В отдел» для отслеживания overlay и бинда инпута.
 * - Выполняет первичную фокусировку при активной вкладке и видимой форме.
 */
onMounted(async () => {
    if (props.isActive && isFormVisible.value) focusDepartmentTrigger()

    await nextTick()
    const root = departmentToDropdown.value?.$el as HTMLElement | undefined
    if (!root) return

    // следим за появлением overlay внутри dropdown (нужен append-to="self")
    deptToMO = new MutationObserver(() => bindDepartmentToFilterInput())
    deptToMO.observe(root, { childList: true, subtree: true })

    // на случай, если overlay уже успел появиться
    bindDepartmentToFilterInput()
})

onUnmounted(() => {
    deptToMO?.disconnect()
    deptToMO = null
})

/**
 * - Сбрасывает флаги валидации и проверяет обязательные поля:
 *   * responsible_employee (исполнитель)
 *   * instructions (описание задачи)
 *   * deadline_time (срок)
 * - При ошибках показывает toast с собранным сообщением.
 * @returns true — валидно; false — есть ошибки.
 */
function validateResponsibilityEntry(): boolean {
    // сброс флагов
    fieldValidation.value.responsibilityValidation = {
        employee_type: false,
        instructions_type: false,
        deadline_type: false,
    }

    let ok = true
    const empOk = !!responsibilityEntry.value.responsible_employee?.id
    const instrOk = !!(responsibilityEntry.value.instructions && responsibilityEntry.value.instructions.trim())
    const deadlineOk = !!responsibilityEntry.value.deadline_time

    if (!empOk)       { fieldValidation.value.responsibilityValidation.employee_type = true; ok = false }
    if (!instrOk)     { fieldValidation.value.responsibilityValidation.instructions_type = true; ok = false }
    if (!deadlineOk)  { fieldValidation.value.responsibilityValidation.deadline_type = true; ok = false }

    if (!ok) {
        const msg = getResponsibilityValidationMessage()
        feedbackStore.showToast({
            type: 'error',
            title: 'Заполните обязательные поля',
            message: msg,
            time: 7000,
        })
    }
    return ok
}

/**
 * getResponsibilityValidationMessage(): string
 * - Формирует человекочитаемое сообщение об ошибках валидации.
 */
function getResponsibilityValidationMessage(): string {
    const errs: string[] = []
    const fv = fieldValidation.value.responsibilityValidation
    if (fv.employee_type)    errs.push('не выбран исполнитель')
    if (fv.instructions_type) errs.push('не описана задача')
    if (fv.deadline_type)     errs.push('не выбран срок выполнения')
    return errs.length ? `Заполните обязательные поля: ${errs.join(', ')}` : ''
}

/**
 * Действие: «Взять в работу»
 *
 * Для тикета:
 * - Вызывает `ticketsStore.coordinatorStart`
 * - Перезагружает данные тикета
 *
 * Для НС:
 * - Делегирует в `apiStore.takeAdverseEvent`
 * - Обновляет список НС
 */
const takeOnWorkEvent = async () => {
    if (props.entityType === 'ticket') {
        await ticketsStore.coordinatorStart(id)
        await ticketsStore.fetchTicket(id)
    } else {
        await apiStore.takeAdverseEvent({id: Number(route.params.id)})
        await apiStore.loadAdverseEvents()
    }
}

/**
 * Действие: «Завершить»
 *
 * Основные шаги:
 * 1. Проверяет наличие незавершённых задач
 * 2. Если есть — запрашивает подтверждение у пользователя
 * 3. Для тикета:
 *    - Вызывает `ticketsStore.coordinatorComplete`
 *    - Перезагружает данные тикета
 * 4. Для НС:
 *    - Делегирует в `apiStore.completeAdverseEvent`
 *    - Перезагружает список НС
 */
const completeEvent = async () => {
    // Проверяем есть ли незавершенные задачи
    const responsibilityEntries = props.entityType === 'ticket'
        ? ticketsStore.currentTicket?.responsibility_entries as IResponsibilityEntry[]
        : apiStore.currentAdverseEvent.responsibility_entries as IResponsibilityEntry[]

    const hasUncompletedTasks = responsibilityEntries?.some(
        (entry: IResponsibilityEntry) => entry.status !== 'completed'
    )

    if (hasUncompletedTasks) {
        try {
            await confirmAction({
                message: 'Не все исполнители отчитались о завершении задач! Завершить?',
                header: 'Подтверждение действия',
                icon: 'pi pi-exclamation-triangle',
                acceptLabel: 'Завершить',
                rejectLabel: 'Отмена',
                acceptClass: 'p-button-danger',
            })
        } catch {
            // Отмена — ничего не делаем
            return
        }
    }

    if (props.entityType === 'ticket') {
        await ticketsStore.coordinatorComplete(id)
        await ticketsStore.fetchTicket(id)
    } else {
        await apiStore.completeAdverseEvent({id: Number(route.params.id)})
        await apiStore.loadAdverseEvents()
    }
}
</script>

<template>
    <!--
      Основной контейнер компонента управления мероприятиями
      Структура:
      1. Панель действий (кнопки управления)
      2. Форма создания/редактирования
      3. История мероприятий с пагинацией
    -->
    <div class="responsibility-entries">
        <!--
          Панель действий:
          - Отображается только при наличии ID
          - Кнопки динамически меняются в зависимости от статуса
          - Расположение: справа с отступами
          - Поддерживаемые действия:
            * Создать
            * Передать
            * Взять в работу
            * Вернуть
            * Отменить
            * Завершить
        -->


        <div
            v-if="id"
            class="responsibility-entries__actions flex justify-end flex-wrap gap-4 items-end ml-auto mb-5"
        >
            <Button
                v-if="!isFormVisible && !props.disabled && currentEntity?.can_edit_by_coordinator && currentEntity?.can_complete"
                label="Добавить исполнителя"
                icon="pi pi-plus"
                iconPos="top"
                class="responsibility-entries__action"
                :disabled="false"
                @click="activateValidation"
            />

            <Button
                v-if="!isFormVisible && !props.disabled && currentEntity?.can_edit_by_coordinator && currentEntity?.can_take_in_progress && currentEntity?.status !== 'completed'"
                label="Взять в работу"
                icon="pi pi-bolt"
                severity="info"
                iconPos="top"
                @click="takeOnWorkEvent"
            />

            <Button
                v-if="!isFormVisible && !props.disabled && currentEntity?.can_edit_by_coordinator && currentEntity?.can_complete"
                label="Завершить"
                icon="pi pi-check"
                iconPos="top"
                severity="success"
                @click="completeEvent"
            />

            <Button
                v-if="canReturn"
                label="Вернуть в работу"
                icon="pi pi-angle-double-left"
                iconPos="top"
                severity="help"
                :disabled="false"
                @click="takeOnWorkEvent"
            />

        </div>

        <!--
          Форма создания/редактирования:
          - Отображается при isFormVisible
          - Сетка из 12 колонок с адаптивным поведением
          - Поля:
            * Выбор отдела (обязательное)
            * Выбор сотрудника (через модальное окно)
            * Описание мероприятия
            * Срочность
            * Срок выполнения
          - Кнопка отправки с динамическим текстом
        -->
        <form v-if="isFormVisible" @submit.prevent="onSubmit" class="mb-8">
            <div class="mb-5 grid grid-cols-12 gap-4">
                <div class="col-span-12 md:col-span-6">
                    <label class="block font-bold mb-3" for="employee_to">Исполнитель</label>
                    <div :class="fieldValidation.responsibilityValidation.employee_type ? 'field-error' : ''">
                        <Button
                            :label="employeeToLabel || 'Не выбрано. Нажмите, чтобы выбрать'"
                            variant="link"
                            class="!pl-0"
                            @click="showEmployeeModal = true"
                        />
                    </div>
                </div>
            </div>
            <div class="mb-5 grid grid-cols-12 gap-4">
                <div class="col-span-full">
                    <label class="block font-bold mb-3" for="comment" >Описание задачи</label>
                    <Textarea
                        v-model="responsibilityEntry.instructions"
                        rows="3"
                        cols="20"
                        id="comment"
                        fluid
                        :class="fieldValidation.responsibilityValidation.instructions_type ? 'field-error' : ''"
                    />
                </div>
            </div>
            <div class="col-span-12 md:col-span-6">
                <label class="block w-full font-bold mb-3" for="deadline_time">Срок выполнения</label>
                <DatePicker
                    v-model="deadlineDateModel"
                    showTime
                    showIcon
                    showButtonBar
                    inputId="deadline_time"
                    hourFormat="24"
                    fluid
                    :class="fieldValidation.responsibilityValidation.deadline_type ? 'field-error' : ''"
                />
            </div>
            <EmployeeSelectionModal
                v-model:visible="showEmployeeModal"
                target="responsibility_entry"
                :employees="filteredEmployees"
                :selected-employee-id="responsibilityEntry.responsible_employee?.id"
                @employee-selected="onEmployeeSelected"
            />
            <Button
                v-if="responsibilityEntriesStore.formMode === 'transfer' || isCreatingEntry"
                type="submit"
                :label="isCreatingEntry ? 'Создать запись ответственности' : 'Передать мероприятие'"
                class="mt-4"
            />
        </form>

        <!--
          История мероприятий:
          - Отображается в Fieldset с заголовком
          - Таблица с пагинацией (5, 10, 15 строк)
          - Колонки:
            * От кого (отдел/сотрудник)
            * Кому (отдел/сотрудник)
            * Описание (с возможностью раскрытия)
            * Срочность
            * Дата и время
            * Статус
        -->
        <div class="col-span-full">
            <p class="font-bold mb-2">История мероприятий</p>

            <div class="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead class="bg-gray-50 dark:bg-gray-800/60">
                    <tr class="text-left text-sm font-semibold text-gray-700 dark:text-gray-200">
                        <th class="px-4 py-3">От</th>
                        <th class="px-4 py-3">Кому</th>
                        <th class="px-4 py-3">Описание</th>
                        <th class="px-4 py-3">Дата создания</th>
                        <th class="px-4 py-3">Статус</th>
                    </tr>
                    </thead>

                    <tbody class="divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                    <!-- Пусто -->
                    <tr v-if="!responsibilityEntriesList.length">
                        <td colspan="5" class="px-4 py-6 text-center italic text-gray-500 dark:text-gray-400">
                            По этому событию пока нет мероприятий
                        </td>
                    </tr>

                    <!-- Строки -->
                    <tr
                        v-for="data in responsibilityEntriesList"
                        :key="data.id"
                        class="odd:bg-white even:bg-gray-50/50 dark:odd:bg-gray-900 dark:even:bg-gray-900/60 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                        <!-- От -->
                        <td class="px-4 py-3 align-top">
                            <template v-if="data.supervisor">
                                {{ formatShortName(data.supervisor) }}
                            </template>
                        </td>

                        <!-- Кому -->
                        <td class="px-4 py-3 align-top">
                            <template v-if="data.responsible_employee">
                                {{ formatShortName(data.responsible_employee as IResponsibilityEmployee) }}
                            </template>
                        </td>

                        <!-- Описание -->
                        <td class="px-4 py-3 align-top">
                            <p
                                v-if="!expandedDescriptionIds.includes(Number(data.id)) && (data.instructions ?? '').length >= 100"
                                class="overflow-auto"
                            >
                                {{ (data.instructions ?? '----').slice(0, 100) }}
                                <span
                                    class="text-blue-600 dark:text-sky-400 cursor-pointer"
                                    @click="() => expandedDescriptionIds.push(Number(data.id))"
                                />
                            </p>
                            <p v-else class="overflow-auto">
                                {{ data.instructions }}
                            </p>
                        </td>

                        <!-- Дата создания -->
                        <td class="px-4 py-3 align-top whitespace-nowrap">
                            {{ formatResponsibilityDate(data.created_at) || '—' }}
                        </td>

                        <!-- Статус -->
                        <td class="px-4 py-3 align-top">
                            {{ getStatusText(data.status) }}
                        </td>
                    </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</template>

<style lang="scss">
/*
  Стили компонента:

  .field-error - стиль для невалидных полей:
  - Красная рамка
  - Скругленные углы
  - Минимальная ширина

  .field-error-text - стиль для текста ошибок:
  - Красный цвет текста
*/

.field-error-text {
    color: #ff5252 !important;
}

.field-error {
    border: 1px solid #ff5252 !important;
    border-radius: 6px;
}

.p-datepicker.field-error,
.p-datepicker .p-inputtext.field-error {
    border: 1px solid #ff5252 !important;
    box-shadow: none !important;
}
</style>

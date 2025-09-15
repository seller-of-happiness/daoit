<script setup lang="ts">
/*
 * Компонент: PerformerTask — карточка задачи исполнителя в рамках НС
 *
 * Назначение:
 * - Показ одной записи ответственности (задачи исполнителя) внутри НС.
 * - Отображение постановщика/исполнителя, инструкции и срока.
 * - Выполнение задачи исполнителем: загрузка отчёта и файлов.
 * - Взятие задачи в работу (если разрешено) и завершение (с отчётом).
 * - Свертывание/разворачивание завершённых задач.
 *
 * Источники данных/действий:
 * - apiStore: текущее НС (статус, перезагрузка события после действий).
 * - responsibilityEntriesStore: действия с задачами (take/complete).
 *
 * UX:
 * - Если НС завершено, карточка ведёт себя read-only; завершённые задачи можно свернуть.
 * - Кнопка «Взять в работу» показывается при canTake и незавершённом НС.
 * - Форма отчёта доступна при canComplete и незавершённом НС.
 * - Пустой отчёт не отправляется (подсветка ошибки).
 */


/* ИМПОРТЫ (назначение)
 * - vue: ref/computed/watch — локальное состояние, производные значения и реакции.
 * - useApiStore — доступ к текущему НС (для проверки статуса и обновления данных).
 * - useResponsibilityEntries — вызовы take/complete записей ответственности.
 * - formatResponsibilityDate/getFullName — форматирование даты и ФИО в UI.
 * - openChat — переход в чат по ID сотрудника (на заголовках).
 */
import { computed, ref, watch } from 'vue'
import { useApiStore } from '@/refactoring/modules/apiStore/stores/apiStore'
import { formatResponsibilityDate, getFullName } from '@/refactoring/utils/formatters'
import { useTicketsStore } from '@/refactoring/modules/tickets/stores/ticketsStore'
import { useResponsibilityEntries } from '@/refactoring/modules/responsibilityEntries/stores/responsibilityEntriesStore'
import { openChat } from '@/refactoring/utils/openChat'

import FileAttach from '@/refactoring/modules/files/components/FileAttach.vue'
import FileList from '@/refactoring/modules/files/components/FileList.vue'

import type { ICreatedBy } from '@/refactoring/modules/apiStore/types/adverse-events/ICreatedBy'
import type { IExistingFile } from '@/refactoring/modules/files/types/IExistingFile'
import type { IResponsibilityEmployee } from '@/refactoring/modules/responsibilityEntries/types/IResponsibilityEmployee'


const apiStore = useApiStore()
const responsibilityEntries = useResponsibilityEntries()
const ticketsStore = useTicketsStore()

/**
 * Props PerformerTask
 * @prop {number}  eventId               — ID НС (нужен для API-действий и последующей перезагрузки).
 * @prop {number}  entryId               — ID записи ответственности (конкретная задача).
 * @prop {Partial<ICreatedBy>|null} supervisor          — Постановщик задачи (ФИО/ID, для открытия чата).
 * @prop {string|null}           instructions           — Текст задачи (инструкция исполнителю), read-only.
 * @prop {string|Date|null}      deadline               — Срок выполнения (строка ISO или Date).
 * @prop {string|null=}          existingReport         — Уже предоставленный отчёт (для завершённой задачи).
 * @prop {boolean=}              canTake                — Разрешено «взять в работу» текущему пользователю.
 * @prop {boolean=}              canComplete            — Разрешено завершить задачу (показ формы отчёта).
 * @prop {string|null=}          status                 — Статус задачи: 'new' | 'in_progress' | 'completed'.
 * @prop {Partial<ICreatedBy>|null=} responsibleEmployee — Исполнитель задачи (ФИО/ID, для открытия чата).
 * @prop {string} entityType — Тип сущности: 'adverse' или 'ticket'.
 */
const props = defineProps<{
    eventId: number
    entryId: number
    supervisor: Partial<IResponsibilityEmployee> | null
    instructions: string | null
    deadline: string | Date | null
    existingReport?: string | null
    canTake?: boolean
    canComplete?: boolean
    status?: string | null
    responsibleEmployee?: Partial<ICreatedBy> | null
    entityType?: string
}>()

/* ЛОКАЛЬНОЕ СОСТОЯНИЕ (refs)
 * completionReport: string     — текст отчёта, редактируется в форме завершения задачи.
 * reportError: boolean         — признак ошибки, когда отправляют пустой отчёт.
 * files: File[]                — локально выбранные файлы для загрузки с отчётом.
 * isExpanded: boolean          — состояние разворота карточки (актуально для завершённых задач).
 */
const completionReport = ref<string>(props.existingReport ?? '')
const reportError = ref<boolean>(false)
const files = ref<File[]>([])
const isExpanded = ref<boolean>(false)

const onFilesUpdate = (v: File[]) => {
    files.value = Array.isArray(v) ? v : []
}

/**
 * Флаг завершённости сущности
 *
 * Логика:
 * - Для тикетов → проверяет статус currentTicket
 * - Для НС → проверяет статус currentAdverseEvent
 *
 * Возвращает:
 * - true, если статус === 'completed'
 * - false в остальных случаях
 */
const isEventCompleted = computed(() => {
    if (props.entityType === 'ticket') {
        return ticketsStore.currentTicket?.status === 'completed'
    }
    return apiStore.currentAdverseEvent?.status === 'completed'
})

/**
 * WATCH: existingReport → completionReport
 * Держит локальный текст отчёта в синхронизации с входным пропсом.
 * Триггер: props.existingReport
 * Действие: completionReport = existingReport ?? ''
 */
watch(
    () => props.existingReport,
    v => { completionReport.value = v ?? '' }
)

/**
 * Отправка отчёта о выполнении задачи
 *
 * Логика:
 * 1. Проверяет, не завершена ли задача → если да, выходит
 * 2. Валидирует отчёт (completionReport) → при пустом значении ставит reportError
 * 3. В зависимости от entityType:
 *    - ticket → вызывает completeTicketResponsibilityEntry и обновляет тикет
 *    - adverse → вызывает completeResponsibilityEntry и обновляет НС
 * 4. Очищает состояние формы (completionReport и files)
 *
 * Возвращает:
 * - Promise<void>
 * - При ошибке пишет в консоль и не выбрасывает исключение
 */
const submitReport = async (event_id?: number) => {
    if (isCompletedTask.value) return
    reportError.value = !completionReport.value.trim()
    if (reportError.value) return

    try {
        if (props.entityType === 'ticket') {
            await responsibilityEntries.completeTicketResponsibilityEntry({
                event_id: props.eventId,
                entry_id: props.entryId,
                completion_report: completionReport.value.trim(),
                files: files.value.length ? files.value : undefined,
            })

            if (event_id) {
                await ticketsStore.fetchTicket(event_id)
            }
        } else {
            await responsibilityEntries.completeResponsibilityEntry({
                event_id: props.eventId,
                entry_id: props.entryId,
                completion_report: completionReport.value.trim(),
                files: files.value.length ? files.value : undefined,
            })

            if (event_id) {
                await apiStore.fetchAdverseEventById({ id: event_id })
            }
        }

        completionReport.value = ''
        files.value = []

    } catch (error) {
        console.error('Ошибка при отправке отчета:', error)
    }
}

/**
 * Читабельный статус задачи в UI.
 * Логика:
 * - Если НС завершено: 'Завершена' | 'НС завершено (задача не выполнена)'.
 * - Если статус задачи: 'completed' → 'Завершена', 'in_progress' → 'В работе'.
 * - Если 'new':
 *     canTake → 'Ожидает взятия в работу'
 *     canComplete → 'В работе'
 *     иначе → 'Ожидает выполнения'
 * Возвращает: string
 * Зависимости: props.status, props.canTake, props.canComplete, isEventCompleted
 */
const taskStatus = computed(() => {
    if (isEventCompleted.value) {
        if (props.status === 'completed') {
            return 'Завершена'
        } else {
            return 'НС завершено (задача не выполнена)'
        }
    }

    // 1. Приоритет - статус из API
    if (props.status === 'completed') return 'Завершена'
    if (props.status === 'in_progress') return 'В работе'

    // 2. Для задач со статусом "new" определяем статус в зависимости от прав
    if (props.status === 'new') {
        if (props.canTake) return 'Ожидает взятия в работу'
        if (props.canComplete) return 'В работе'

        // Инспектор видит задачу: нельзя взять и нельзя завершить
        // но задача не завершена - она ожидает выполнения исполнителем
        return 'Ожидает выполнения'
    }
})

/**
 * CSS-класс подсветки статуса ('completed' | 'in-progress').
 * Возвращает: 'completed' | 'in-progress'
 * Зависимости: taskStatus
 */
const statusColor = computed(() => {
    return taskStatus.value !== 'Завершена' ? 'in-progress' : 'completed'
})

/**
 * Задача считается завершённой, если сама завершена ИЛИ НС завершено.
 * Возвращает: boolean
 * Зависимости: props.status, isEventCompleted
 */
const isCompletedTask = computed(() => {
    return props.status === 'completed' || isEventCompleted.value
})

/**
 * Взятие задачи в работу
 *
 * Логика:
 * - Для ticket → вызывает takeTicketResponsibilityEntry и обновляет тикет
 * - Для adverse → вызывает takeResponsibilityEntry и обновляет НС
 *
 * Параметры:
 * - event_id: number — ID сущности
 * - entry_id: number — ID записи ответственности
 *
 * Возвращает:
 * - Promise<void>
 * - При ошибке пишет в консоль
 */
const takeOnWork = async (event_id: number, entry_id: number) => {
    try {
        if (props.entityType === 'ticket') {
            await responsibilityEntries.takeTicketResponsibilityEntry({entry_id: entry_id, event_id: event_id})
            await ticketsStore.fetchTicket(event_id)
        } else {
            await responsibilityEntries.takeResponsibilityEntry({entry_id: entry_id, event_id: event_id})
            await apiStore.fetchAdverseEventById({ id: event_id })
        }
    } catch (error) {
        console.error('Ошибка при взятии в работу', error)
    }
}


/**
 * Переключает сворачивание/разворачивание ТОЛЬКО для завершённых задач.
 * Для активных задач содержимое всегда развёрнуто.
 * Параметры: нет
 * Возврат: void
 */
const toggleExpand = () => {
    if (isCompletedTask.value) {
        isExpanded.value = !isExpanded.value
    }
}

/**
 * WATCH (immediate): isCompletedTask → isExpanded
 * Авторазворачивание активных и сворачивание завершённых задач.
 * Если completed → isExpanded = false; иначе → true.
 * Триггер: isCompletedTask (computed)
 * Параметры watch: { immediate: true }
 */
watch(
    () => isCompletedTask.value,
    (completed) => {
        isExpanded.value = !completed
    },
    { immediate: true }
)


/**
 * Получение нормализованного списка файлов записи ответственности
 *
 * Источник данных:
 * - Для ticket → ticketsStore.currentTicket.responsibility_entries
 * - Для adverse → apiStore.currentAdverseEvent.responsibility_entries
 *
 * Логика:
 * 1. Ищет запись по props.entryId
 * 2. Безопасно приводит entry.files к массиву
 * 3. Для каждого файла извлекает:
 *    - id: number (строка приводится к числу, некорректные значения отбрасываются)
 *    - file: string (если строка, берётся напрямую; иначе — f.file.url)
 * 4. Отбрасывает элементы без валидных id или file
 *
 * Возвращает:
 * - IExistingFile[] — массив { id: number; file: string }
 *
 * Особенности:
 * - Не бросает ошибок при некорректных данных
 * - Реактивно пересчитывается при изменении currentTicket / currentAdverseEvent
 */
const currentEntryFiles = computed<IExistingFile[]>(() => {
    let ev: any
    if (props.entityType === 'ticket') {
        ev = ticketsStore.currentTicket as any
    } else {
        ev = apiStore.currentAdverseEvent as any
    }

    const entry = ev?.responsibility_entries?.find((it: any) => it.id === props.entryId)
    const arr = Array.isArray(entry?.files) ? entry.files : []
    return arr
        .map((f: any) => {
            const id = typeof f?.id === 'number' ? f.id : Number(f?.id)
            const file = typeof f?.file === 'string' ? f.file : (f?.file?.url ?? '')
            return (Number.isFinite(id) && file) ? { id, file } as IExistingFile : null
        })
        .filter((x: any): x is IExistingFile => !!x)
})

/**
 * Назначение:
 * - Удобный флаг наличия прикреплённых файлов у выбранной записи ответственности.
 *
 * Логика:
 * - true, если currentEntryFiles.value.length > 0; иначе false.
 *
 * Возвращает:
 * - boolean — есть ли хотя бы один файл.
 *
 * Применение:
 * - Управление видимостью иконки у статуса задачи
 */
const hasAnyFiles = computed(() => currentEntryFiles.value.length > 0)
</script>

<template>
    <section
        class="performer-task performer-task__card p-4 md:p-5 rounded-2xl bg-surface-0 dark:bg-surface-900 shadow-sm"
        :class="{ 'completed-task': isCompletedTask }"
    >
        <!-- Заголовок с возможностью сворачивания для завершенных задач -->
        <header
            class="performer-task__header flex items-center gap-2 mb-4 flex-wrap"
            @click="isCompletedTask && toggleExpand()"
        >
            <!-- Чеврон только для завершённых задач -->
            <i
                v-if="isCompletedTask"
                class="pi text-xs mr-1 cursor-pointer w-7"
                :class="isExpanded ? 'pi-chevron-down' : 'pi-chevron-right'"
            />

                <!-- Исполнитель -->
                <button
                    v-if="responsibleEmployee"
                    type="button"
                    class="performer-task__meta inline-flex items-center min-w-0 text-sm cursor-pointer"
                    @click.stop="openChat(responsibleEmployee?.id)"
                    title="Исполнитель задачи"
                >
                    <i class="pi pi-user text-xs mr-1"></i>
                    <span class="truncate max-w-[22ch]">{{ getFullName(responsibleEmployee) }}</span>
                </button>

                <!-- Разделитель -->
                <span v-if="!isCompletedTask || isExpanded" class="text-surface-400 ms-2 me-2">·</span>

                <!-- Срок -->
                <span
                    v-if="!isCompletedTask || isExpanded"
                    class="text-sm text-surface-500 whitespace-nowrap"
                    :class="{
        'text-red-500':
          !isCompletedTask &&
          !!(deadline) &&
          new Date(deadline instanceof Date ? deadline.toISOString() : (deadline as string)) < new Date()
      }"
                    title="Срок исполнения задачи"
                >
      <i class="pi pi-clock text-xs mr-1"></i>
      {{ formatResponsibilityDate(deadline instanceof Date ? deadline.toISOString() : deadline) }}
    </span>

            <!-- ПРАВАЯ ЧАСТЬ: Чип статуса (уходит на вторую строку на мобилке) -->
            <span
                class="status-chip ml-auto w-full sm:w-auto text-right sm:text-left"
                :class="statusColor"
            >
                  <i
                      v-if="taskStatus === 'Завершена' && hasAnyFiles"
                      class="pi pi-save mr-1"
                      title="Есть прикреплённые файлы"
                  />
    {{ taskStatus }}
  </span>
        </header>

        <!-- Содержимое задачи (показывается только если развернуто или задача активна) -->
        <div v-if="!isCompletedTask || isExpanded">

            <!-- Задача -->
            <div class="performer-task__block mb-4">
                <h4 class="performer-task__subtitle text-sm md:text-base font-semibold mb-2">Задача</h4>
                <Textarea
                    :model-value="instructions || ''"
                    rows="4"
                    fluid
                    readonly
                    disabled
                    class="w-full"
                />
            </div>

            <!-- Блок для отображения отчета в завершенных задачах -->
            <div v-if="isCompletedTask" class="performer-task__block">
                <h4 class="performer-task__subtitle text-sm md:text-base font-semibold mb-2">
                    Отчет о выполнении
                </h4>
                <Textarea
                    :model-value="existingReport || 'Отчет не предоставлен'"
                    rows="4"
                    fluid
                    readonly
                    disabled
                    class="w-full"
                />

                <button type="button" class="p-button p-component mt-4" @click="openChat(responsibleEmployee?.id)">Написать исполнителю</button>
            </div>

            <!-- Отчёт -->
            <Button
                v-if="props.canTake && !isEventCompleted"
                label="Взять в работу"
                icon="pi pi-bolt"
                severity="info"
                iconPos="top"
                @click="takeOnWork(props.eventId, props.entryId)"
                class="mb-4"
            />

            <file-list
                v-if="isCompletedTask && isExpanded && currentEntryFiles.length"
                class="performer-task__files-existing mt-4 text-sm md:text-base font-semibold"
                :items="currentEntryFiles"
                :disabled="true"
            />

            <div v-if="props.canComplete" class="performer-task__block">
                <h4 class="performer-task__subtitle text-sm md:text-base font-semibold mb-2">Отчет о выполнении задачи</h4>

                <Textarea
                    v-model="completionReport"
                    rows="5"
                    fluid
                    :readonly="isCompletedTask"
                    :disabled="isCompletedTask"
                    :class="['w-full', { 'field-error': reportError }]"
                    placeholder="Опишите выполненные действия"
                />
                <p v-if="reportError" class="performer-task__error mt-1 text-sm">Необходимо заполнить отчет.</p>

                <!-- Файлы -->
                <div class="performer-task__files mt-3 flex flex-wrap items-center gap-3">
                    <file-attach
                        :files="files"
                        @update:files="onFilesUpdate"
                        :disabled="isCompletedTask"
                        :showSubmit="true"
                        submitLabel="Отчитаться о выполнении"
                        target="responsibility-complete"
                        :onSubmit="() => submitReport(props.eventId)"
                    />
                </div>
            </div>
        </div>

        <!-- Краткая информация для свернутой завершенной задачи -->
        <div v-else-if="isCompletedTask && !isExpanded && existingReport" class="text-sm text-surface-500 cursor-pointer" @click="isCompletedTask && toggleExpand()">
            Отчет:  {{ existingReport.length > 500 ? existingReport.slice(0, 500) + '...' : existingReport }}
        </div>
    </section>
</template>

<style scoped lang="scss">
.performer-task {
    &__meta {
        cursor: pointer;
    }

    &.completed-task {
        border-left: 4px solid var(--primary-color);
        opacity: 0.8;
        margin-bottom: 10px;
    }
}

.field-error {
    border: 1px solid #ef4444 !important;
}

.in-progress {
    color: var(--p-blue-400);
}

.completed {
    color: var(--primary-color);
}

.cursor-pointer {
    cursor: pointer;
}

.status-chip {
    display: inline-block;
    padding: 2px 8px;
    font-size: 12px;
    line-height: 1.2;
    border-radius: 9999px;
    border: 1px solid currentColor;
}

.status-chip.in-progress {
    color: var(--p-blue-400);
}

.status-chip.completed {
    color: var(--primary-color);
}

:deep(.performer-task__files-existing .file-list__title) {
    @apply font-semibold text-sm md:text-base mb-2;
}
</style>

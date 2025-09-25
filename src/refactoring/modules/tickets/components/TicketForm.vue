<script setup lang="ts">
/*
 * Компонент: TicketFormModal — модальное окно создания/редактирования тикета
 *
 * Назначение:
 * - Создание нового тикета и редактирование существующего.
 * - Заполнение основных полей (заголовок, описание, категория/подкатегория, приоритет, срок).
 * - Управление вложениями (FileList + FileAttach) с последующей синхронизацией.
 * - Безопасное закрытие диалога (подтверждение при несохранённых изменениях выполняется вне этого компонента).
 *
 * Состав UI:
 * - Поля формы: title, description, FilterTreeSelect (категории), DatePicker (deadline), Select (priority).
 * - Блок вложений: список существующих файлов и прикрепление новых.
 *
 * Данные и сторы:
 * - useTicketsStore(): категории, CRUD по тикету, опции приоритета.
 * - useTicketFiles(): локальная работа с файлами (existingFiles / files / onExistingFileRemove / onUpdateFiles / sync).
 * - useFeedbackStore(): тосты об ошибке валидации.
 * - useRoute(): определение режима (создание/редактирование по наличию id).
 *
 * Особенности:
 * - Категории отображаются в древовидном селекте; выбор хранится в primeTreeModal по ключу вида `c-<id>-...`.
 * - Для редактирования форма заполняется из tickets.initEditFormFromId(id) и восстанавливается выделение категории.
 * - Локальная валидация обязательных полей (title, category) с подсветкой и единым сообщением.
 * - При submit: сначала сохраняется тикет (create/update), затем всегда выполняется sync файлов.
 */

import { computed, onMounted, ref, watch } from 'vue'
import { useTicketsStore } from '@/refactoring/modules/tickets/stores/ticketsStore'
import { useRoute } from 'vue-router'
import { useFeedbackStore } from '@/refactoring/modules/feedback/stores/feedbackStore'
import { useTicketFiles } from '@/refactoring/utils/useTicketFiles'

import FilterTreeSelect from '@/components/tableFilters/FilterTreeSelect.vue'
import FileAttach from '@/refactoring/modules/files/components/FileAttach.vue'
import FileList from '@/refactoring/modules/files/components/FileList.vue'

import type { ICreateTicketPayload } from '@/refactoring/modules/tickets/types/ICreateTicketPayload'
import type { IExistingFile } from '@/refactoring/modules/files/types/IExistingFile'
import type { ITicketDetail } from '@/refactoring/modules/tickets/types/ITicketDetail'
import type { ITicketCategory } from '@/refactoring/modules/tickets/types/ITicketCategory'
import type { ITreeNode } from '@/refactoring/modules/apiStore/types/ITreeNode'
import type { IVModelTreeSelect } from '@/refactoring/types/IVModelTreeSelect'
import type { TicketPriority } from '@/refactoring/modules/tickets/types/TicketPriority'

const tickets = useTicketsStore()
const feedbackStore = useFeedbackStore()
const route = useRoute()
const ticketFiles = useTicketFiles()

/** visible — флаг видимости диалога. При закрытии инициирует возврат на родительский маршрут. */
const visible = ref(true)

/** isEdit — признак режима редактирования (true, если в маршруте есть id). */
const isEdit = computed(() => Boolean(route.params.id))

/**
 * form — реактивная модель формы создания/редактирования.
 * Поля:
 * - title: string — заголовок (обязательное).
 * - description: string — описание (опционально).
 * - category: { id: number } — выбранная категория/подкатегория (обязательное).
 * - priority: TicketPriority — приоритет (0 по умолчанию).
 * - deadline_time: string | null — ISO-строка или null.
 */
const form = ref<ICreateTicketPayload>({
    title: '',
    description: '',
    category: { id: 0 },
    priority: 0 as TicketPriority, // default 0
    deadline_time: null
})

/** primeTreeModal — модель выбранного ключа в FilterTreeSelect (single). Формат ключа: `c-<id>-...`. */
const primeTreeModal = ref<IVModelTreeSelect | null>(null)

/** categoryTree — дерево категорий, подготовленное для FilterTreeSelect (любой уровень вложенности). */
const categoryTree = computed<ITreeNode[]>(() => toTreeNodes(tickets.categories ?? []))

/**
 * Назначение:
 * - Обновляет form.category.id по выбранному ключу дерева.
 * - Поддерживает произвольную глубину: берётся последний id в цепочке ключа.
 *
 * Параметры:
 * - selected: IVModelTreeSelect | null — объект выбранных ключей (single).
 *
 * Побочные эффекты:
 * - Обновляет primeTreeModal для подсветки выбранного узла.
 * - Сбрасывает form.category в { id: 0 } при очистке выбора.
 */
function onChangeTreeSelectModal(selected: IVModelTreeSelect | null): void {
    const keys = selected ? Object.keys(selected as Record<string, boolean>) : []
    if (!keys.length) {
        primeTreeModal.value = null
        form.value.category = { id: 0 }
        return
    }
    const key = keys[0]
    const raw = key.replace(/^c-/, '')
    const ids = raw.split('-').map(Number).filter((n) => Number.isFinite(n))
    const chosen = ids.length ? ids[ids.length - 1] : 0
    form.value.category = { id: chosen }
    primeTreeModal.value = { [key]: true } as IVModelTreeSelect
}

/**
 * Назначение:
 * - Рекурсивно преобразует массив категорий в ITreeNode[] для FilterTreeSelect.
 *
 * Параметры:
 * - cats: ITicketCategory[] — исходные категории с потомками.
 * - level: number — текущий уровень вложенности (служебно).
 *
 * Возвращает:
 * - ITreeNode[] — узлы с key: `c-<id>` (и на потомках — цепочки `c-<id>-<id>-...`), label, icon, data.selfId.
 */
const toTreeNodes = (cats: ITicketCategory[] = [], level = 1): ITreeNode[] => {
    return cats.map((cat) => {
        const kids = (cat.childrens ?? (cat as any).childrens ?? []) as ITicketCategory[] // [FIX]
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
 * deadlineDateModel ⇄ Date
 * Назначение:
 * - Двусторонняя обёртка над form.deadline_time для DatePicker.
 * - Геттер: парсит ISO-строку в Date (или null).
 * - Сеттер: сериализует Date в ISO-строку (или null).
 */
const deadlineDateModel = computed<Date | null>({
    get() {
        const v = form.value.deadline_time
        if (!v) return null
        const dt = new Date(v)
        return isNaN(dt.getTime()) ? null : dt
    },
    set(val) {
        form.value.deadline_time = val ? new Date(val).toISOString() : null
    }
})


/**
 * Назначение:
 * - Рекурсивный поиск узла в уже построенном дереве по его key.
 *
 * Параметры:
 * - nodes: ITreeNode[] — корневые узлы дерева.
 * - key: string — ключ вида `c-...`.
 *
 * Возвращает:
 * - ITreeNode | null — найденный узел или null.
 */
const findNodeByKey = (nodes: ITreeNode[], key: string): ITreeNode | null => {
    for (const n of nodes) {
        if (n.key === key) return n
        if (n.children?.length) {
            const hit = findNodeByKey(n.children, key)
            if (hit) return hit
        }
    }
    return null
}

/**
 * Назначение:
 * - Поиск ключа узла (key) по числовому id категории, чтобы восстановить выбор в TreeSelect.
 *
 * Параметры:
 * - nodes: ITreeNode[] — дерево категорий.
 * - id: number — искомый id категории.
 *
 * Возвращает:
 * - string | null — ключ узла (например, `c-12-34`) или null, если не найден.
 */
const findKeyById = (nodes: ITreeNode[], id: number): string | null => {
    const target = String(id)
    for (const n of nodes) {
        if (n.data?.selfId === target) return n.key
        if (n.children?.length) {
            const hit = findKeyById(n.children, id)
            if (hit) return hit
        }
    }
    return null
}

/**
 * Назначение:
 * - Сбор и отправка payload формы на сервер (create/update), валидация перед отправкой.
 * - После успешного сохранения — синхронизация файлов через ticketFiles.sync(<id>).
 *
 * Алгоритм:
 * 1) Формирует payload из form (title, description, category.id, priority, deadline_time).
 * 2) validateForm(): при неуспехе — тост об ошибке и выход.
 * 3) Если isEdit:
 *    - tickets.updateTicket(id, payload);
 *    - await ticketFiles.sync(id);
 *    Иначе:
 *    - const created = await tickets.createTicket(payload);
 *    - await ticketFiles.sync(created.id);
 *    - history.back() (возврат к списку после создания).
 * 4) Скрывает диалог (visible = false).
 *
 * Побочные эффекты:
 * - Показывает тост об ошибке валидации (feedbackStore).
 * - Изменяет историю навигации при создании (history.back()).
 */
async function onTicketSubmit(): Promise<void> {
    const payload: ICreateTicketPayload = {
        title: form.value.title,
        description: form.value.description || '',
        category: { id: form.value.category.id },
        priority: form.value.priority,
        deadline_time: form.value.deadline_time ?? null
    }
    const id = Number(route.params.id)


    if (!validateForm()) {
        feedbackStore.showToast({
            type: 'error',
            title: 'Ошибка валидации',
            message: getValidationMessage(),
            time: 7000,
        })
        return
    }


    if (isEdit.value && typeof route.params.id === 'string') {
        await tickets.updateTicket(id, payload)
        await ticketFiles.sync(id)
    } else {
        const created: ITicketDetail = await tickets.createTicket(payload)
        await ticketFiles.sync(created.id)
        history.back()
    }


    visible.value = false
}

/**
 * Назначение:
 * - Обновляет видимость диалога. При закрытии (v=false) возвращает на родительский маршрут.
 *
 * Параметры:
 * - v: boolean — целевое состояние видимости.
 *
 * Побочные эффекты:
 * - history.back() при v === false.
 */
function onUpdateVisible(v: boolean) {
    // закрытие диалога — возвращаемся на родительский маршрут
    visible.value = v
    if (!v) history.back()
}

/**
 * fieldValidation — локальные флаги обязательных полей.
 * - title: true — заголовок пустой.
 * - category: true — категория не выбрана.
 */
const fieldValidation = ref<{ title: boolean; category: boolean }>({ title: false, category: false })

/**
 * Назначение:
 * - Составляет человекочитаемое сообщение об ошибках для тоста.
 *
 * Возвращает:
 * - string — «Заполните обязательные поля: ...».
 */
const getValidationMessage = (): string => {
    const errs: string[] = []
    if (fieldValidation.value.title) errs.push('не указан заголовок')
    if (fieldValidation.value.category) errs.push('не выбрана категория')
    return `Заполните обязательные поля: ${errs.join(', ')}`
}

/**
 * Назначение:
 * - Проверяет обязательные поля формы (title, category).
 * - Обновляет fieldValidation для подсветки полей с ошибками.
 *
 * Возвращает:
 * - boolean — true, если все проверки пройдены.
 */
const validateForm = (): boolean => {
    fieldValidation.value = { title: false, category: false }
    let ok = true
    if (!String(form.value.title || '').trim()) { fieldValidation.value.title = true; ok = false }
    if (!Number(form.value.category?.id || 0)) { fieldValidation.value.category = true; ok = false }
    return ok
}

/**
 * Назначение:
 * - Снимает подсветку ошибки поля title при любом непустом вводе.
 *
 * Триггер:
 * - Любая смена значения form.title.
 *
 * Побочный эффект:
 * - fieldValidation.value.title = false, если строка непустая.
 */
watch(
    () => form.value.title,
    (v) => {
        if (String(v || '').trim()) fieldValidation.value.title = false
    }
)

/**
 * Назначение:
 * - При первом монтировании загружает категории (если ещё не загружены).
 * - В режиме редактирования:
 *   • инициализирует форму из tickets.initEditFormFromId(id);
 *   • восстанавливает выделение категории в primeTreeModal через findKeyById().
 *
 * Ошибки:
 * - Ошибки загрузки категорий/формы не бросаются наружу (ожидаемая устойчивость UI).
 */
onMounted(async () => {
    if (!tickets.categories.length) await tickets.fetchCategories()

    if (isEdit.value && typeof route.params.id === 'string') {
        const prepared = await tickets.initEditFormFromId(Number(route.params.id))
        if (prepared) {
            form.value = prepared
            const key = findKeyById(categoryTree.value, form.value.category.id)
            primeTreeModal.value = key ? ({ [key]: true } as IVModelTreeSelect) : null
        }
    }
})
</script>

<template>
    <Dialog :visible="visible" :modal="true" header="Заявка" :style="{ width: '800px' }" @update:visible="onUpdateVisible">
        <div class="grid gap-3">
            <input
                v-model="form.title"
                type="text"
                placeholder="Заголовок"
                class="p-inputtext p-component"
                :class="{ 'field-error': fieldValidation.title }"
            />
            <textarea v-model="form.description" rows="4" placeholder="Описание" class="p-inputtext p-component" />

            <div class="flex gap-2">
                <div class="w-1/2">
                    <label class="block font-bold mb-2">Категория / подкатегория</label>
                    <FilterTreeSelect
                        id="ticket_category"
                        :labelFor="'ticket_category'"
                        :className="['w-full']"
                        :selectionMode="'single'"
                        :options="categoryTree"
                        v-model="primeTreeModal"
                        :changeHandler="onChangeTreeSelectModal"
                        placeholder="Выберите категорию и подкатегорию"
                        :class="{ 'field-error': fieldValidation.category }"
                    />
                </div>

                <div class="w-1/2">
                    <label class="block font-bold mb-2" for="deadline_time">Срок выполнения</label>
                    <DatePicker
                        v-model="deadlineDateModel"
                        showTime
                        showIcon
                        showButtonBar
                        inputId="deadline_time"
                        hourFormat="24"
                        fluid
                    />
                </div>
            </div>

            <label class="block font-bold" for="priority">Приоритет</label>
            <Select
                id="priority"
                v-model.number="form.priority"
                :options="tickets.priorityOptions"
                option-label="label"
                option-value="value"
                placeholder="Приоритет"
            />

            <div>
                <!-- Существующие файлы -->
                <FileList
                    v-if="ticketFiles.existingFiles.value.length"
                    :items="ticketFiles.existingFiles as unknown as IExistingFile[]"
                    :disabled="false"
                    @remove="ticketFiles.onExistingFileRemove"
                    class="mb-2"
                />


                <FileAttach
                    :files="ticketFiles.files as unknown as File[]"
                    @update:files="ticketFiles.onUpdateFiles"
                />
            </div>
        </div>

        <template #footer>
            <Button label="Отмена" icon="pi pi-times" text @click="onUpdateVisible(false)" />
            <Button :label="isEdit ? 'Сохранить' : 'Создать'" icon="pi pi-check" @click="onTicketSubmit" />
        </template>
    </Dialog>
</template>

<style scoped>
.field-error { border-color: #ef4444 !important; }
:deep(.field-error .p-inputtext),
:deep(.field-error .p-treeselect),
:deep(.field-error .p-inputwrapper) { border-color: #ef4444 !important; }
</style>



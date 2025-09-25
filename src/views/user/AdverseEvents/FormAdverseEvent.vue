<script setup lang="ts">
/*
 * Компонент для создания/редактирования нежелательных событий (НС)
 *
 * Назначение:
 * - Создаёт новое НС и редактирует существующее.
 * - Управляет участниками (пациент/сотрудник/посетитель/другое).
 * - Назначает координатора, оценивает вероятность/последствия.
 * - Добавляет/показывает записи ответственности (журнал задач, исполнители, сроки).
 * - Указывает место (структура или ручной ввод) и дату/время события.
 * - Валидирует форму и перехватывает закрытие диалога с подтверждением.
 * - Управляет фокусом (обход ограничений PrimeVue, автофокус на ключевых полях).
 *
 * Структура вкладок:
 * 0 — Форма: вид события, дата/время, отдел, место, краткое описание, принятые меры.
 * 1 — Участники: таблица участников + SplitButton добавления.
 * 2 — Координатор НС: вероятность, последствия, журнал ответственности.
 * 3 — Исполнитель: карточки задач для исполнителей.
 *
 * Права/режимы:
 * - Полный readonly при status === 'completed'.
 * - Разрешения по ролям (создатель/инспектор/координатор/исполнитель) управляют доступностью вкладок и полей.
 *
 * Подключенные компоненты:
 * - FilterTreeSelect: выбор категории/типа события
 * - ResponsibilityEntries: управление мероприятиями
 * - PatientModal/EmployeeSelectionModal: добавление участников
 * - RoomModal: выбор места события
 */

// Импорты Vue и сторонних библиотек
import { ref, computed, onMounted, watch, onUnmounted, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'

// Импорты хранилищ Pinia
import { useApiStore } from '@/refactoring/modules/apiStore/stores/apiStore'
import { useFeedbackStore } from '@/refactoring/modules/feedback/stores/feedbackStore'
import { useResponsibilityEntries } from '@/refactoring/modules/responsibilityEntries/stores/responsibilityEntriesStore'
import { useUserStore } from '@/refactoring/modules/user/stores/userStore'
import { useFilesStore } from '@/refactoring/modules/files/stores/filesStore'
import { useCentrifugeStore } from '@/refactoring/modules/centrifuge/stores/centrifugeStore'

// Вспомогательные функции и типы
import {
    formatPhoneNumber,
    getFullName,
    formatDateOnly,
    formatResponsibilityDate
} from '@/refactoring/utils/formatters'
import { useGlobalConfirm } from '@/refactoring/modules/feedback/utils/useGlobalConfirm'
import { getLocationPath } from '@/refactoring/utils/locationUtils'
import { openChat } from '@/refactoring/utils/openChat'
import { ERouteNames } from '@/router/ERouteNames'
import type { ICreateAdversePayload } from '@/refactoring/modules/apiStore/types/adverse-events/ICreateAdversePayload'
import type { IParticipant } from '@/refactoring/modules/apiStore/types/IParticipant'
import type { IVModelTreeSelect } from '@/refactoring/types/IVModelTreeSelect'
import type { ICreatedBy } from '@/refactoring/modules/apiStore/types/adverse-events/ICreatedBy'
import type { IExistingFile } from '@/refactoring/modules/files/types/IExistingFile'

// Импорты дочерних компонентов
import ResponsibilityEntries from '@/components/ResponsibilityEntries.vue'
import PatientModal from '@/components/adverseEvents/PatientModal.vue'
import EmployeeSelectionModal from '@/components/adverseEvents/EmployeeSelectionModal.vue'
import RoomModal from '@/components/adverseEvents/RoomModal.vue'
import CommentModal from '@/components/adverseEvents/CommentModal.vue'
import FilterTreeSelect from '@/components/tableFilters/FilterTreeSelect.vue'
import PerformerTask from '@/components/adverseEvents/PerformerTask.vue'
import FileList from '@/refactoring/modules/files/components/FileList.vue'
import FileAttach from '@/refactoring/modules/files/components/FileAttach.vue'
import StatusChip from '@/components/StatusChip.vue'

// Явно импортируем компоненты PrimeVue вкладок и формы, чтобы корректно работала разметка табов
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'


// Инициализация хранилищ
const apiStore = useApiStore()
const feedbackStore = useFeedbackStore()
const userStore = useUserStore()
const responsibilityEntries = useResponsibilityEntries()
const filesStore = useFilesStore()
const route = useRoute()
const router = useRouter()

// Деструктуризация значений из хранилищ с сохранением реактивности
const {
    hospitalSkeleton,
    categoryTypeTree,
    adverseEventProbability,
    adverseEventConsequences,
    currentAdverseEvent,
    departments,
} = storeToRefs(apiStore)

// Рефы из feedbackStore
const { createOrUpdatePopup, loadingOnConfirmModal, serverErrors } = storeToRefs(feedbackStore)

// Рефы из responsibilityEntries
const { fieldValidation, isCreatingEntry } = storeToRefs(responsibilityEntries)

// Реактивные переменные компонента
const confirmAction = useGlobalConfirm()
const formTabValue = ref<number>(0) // Текущая активная вкладка формы (0 - форма)
const primeTreeModal = ref<Record<string, boolean>>({}) // Выбранные элементы в древовидном селекторе типа события
const locationTypeModal = ref<boolean>(false) // Видимость модалки выбора места
const patientOrGuestModal = ref<boolean>(false) // Видимость модалки пациента/гостя
const employeeSelectionModalRef = ref<boolean>(false) // Видимость модалки выбора сотрудника
const commentModal = ref<boolean>(false) // Видимость модалки комментария
const eventParticipantType = ref<string>('') // Тип участника события (пациент/сотрудник/посетитель)
const employeeSelectionModalType = ref<'participant' | 'responsibility_entries'>('participant') // Тип модалки сотрудника
const tooltip = ref<string | undefined>(undefined) // Текст всплывающей подсказки
const isEditingManualLocation = ref(false) // Режим редактирования ручного ввода локации
const manualLocation = ref('') // Ручной ввод локации
const isInitialLoad = ref(true) // Флаг первой загрузки компонента
const isViewMode = ref(true) // Заменяем isViewMode вычисляемое свойство на реактивную переменную
const isCausePanelCollapsed = ref(true) // Флаг свернутости панели "Причины" (true — панель свернута, false — открыта)
const showEmployeeModal = ref(false) // Видимость модального окна выбора координатора
const adverseFiles = ref<File[]>([]) // Локальный список новых файлов, прикрепляемых к НС (только из UI, ещё не на сервере).
const adverseRemovedFileIds = ref<number[]>([]) // Список ID файлов, помеченных на удаление из текущего НС.
const existingAdverseFiles = computed<IExistingFile[]>(() => (currentAdverseEvent.value as any)?.files ?? []) // Существующие файлы НС, полученные с сервера. Берутся из currentAdverseEvent.files или пустой массив.
const isFileUploadEnabled = computed(() => Boolean(canEditFormGeneral.value)) // Флаг, разрешён ли аплоад/удаление файлов в форме НС. true, если доступно редактирование общей формы.

// Новые вычисляемые свойства для ролей
/** true, если пользователь — координатор этого НС */
const isCoordinator = computed(() => currentAdverseEvent.value.can_edit_by_coordinator)

/** true, если пользователь — исполнитель (есть назначенные записи) */
const isExecutor = computed(() => currentAdverseEvent.value.is_executor)

/** true, если пользователь — создатель события */
const isCreator = computed(() => currentAdverseEvent.value.can_edit_by_creator)

/** true, если пользователь — инспектор */
const isInspector = computed(() => currentAdverseEvent.value.can_edit_by_inspector)

/** true, если НС завершено (полный readonly) */
const isCompleted = computed(() => currentAdverseEvent.value.status === 'completed')

// Видимость вкладок
/** видимость вкладки «Координатор НС» — есть id и (координатор или инспектор) */
const canSeeCoordinatorTab = computed(
    () => !!route.params.id && (isCoordinator.value || isInspector.value),
)

/** видимость вкладки «Исполнитель» — есть id и пользователь исполнитель */
const canSeeExecutorTab = computed(() => !!route.params.id && isExecutor.value)

/** редактирование общих полей формы (дата/время/отдел/описания) */
const canEditFormGeneral = computed(() => {
    return !route.params.id || (!isCompleted.value && isCreator.value)
})

/** редактирование вида события (создатель/инспектор при незавершённом НС) */
const canEditFormEventType = computed(() => {
    if (!route.params.id) return true;            // создание — разрешено
    return !isCompleted.value && isInspector.value; // редактирование — только инспектор
});

/** редактирование участников (создатель при незавершённом НС) */
const canEditParticipants = computed(() => {
    return !route.params.id || (!isCompleted.value && isCreator.value)
})

/** можно назначать координатора/оценки (инспектор или координатор при незавершённом НС) */
const canEditCoordinatorAssign = computed(
    () => !isCompleted.value && (isInspector.value || isCoordinator.value),
)

/** можно ли показать действие «вернуть» завершенное НС*/
const canReturn = computed(() => isCompleted.value && isInspector.value)

/** доступность кнопки «Сохранить» */
const canSave = computed(() => {
    if (isCompleted.value) return false
    // Для нового события всегда разрешаем сохранение
    if (!route.params.id) return true
    return isCreator.value || isInspector.value || isCoordinator.value
})

/**
 * Флаг, предотвращающий повторный вход в onDialogVisibleChange,
 * когда мы сами внутри функции меняем visible обратно на true.
 *
 * Нужен для того, чтобы избежать зацикливания вызовов @update:visible
 * при перехвате закрытия окна (крестик, ESC, клик по маске, кнопка "Отмена").
 *
 * Логика:
 * - При начале обработки ставим guard = true
 * - В момент, когда диалог снова эмитит @update:visible, мы игнорируем вызов
 * - В конце обработки всегда сбрасываем guard = false
 */
let guard = false

/*ОГРОМНЫЙ КОСТЫЛЬ ЧТО БЫ ПЕРЕХВАТЫВАТЬ УПРАВЛЕНИЕ ФОКУСОМ У PRIMEVUE (начало)*/
const treeSelect = ref()

let observer: MutationObserver | null = null
const closeButtonClass = 'p-dialog-close-button'

const watchCloseButtonFocus = () => {
    // 1. Обработчик фокуса с правильной типизацией
    const handleFocus = (event: Event) => {
        const target = event.target as HTMLElement
        if (target.classList.contains(closeButtonClass)) {
            setTimeout(() => {
                const input =
                    treeSelect.value?.treeSelect?.$el?.querySelector('input[role="combobox"]')
                if (input) {
                    ;(input as HTMLInputElement).focus()
                }
            }, 10)
        }
    }

    // 2. Наблюдатель DOM с правильной типизацией
    observer = new MutationObserver(() => {
        const closeButton = document.querySelector(`.${closeButtonClass}`)
        if (closeButton) {
            closeButton.addEventListener('focus', handleFocus as EventListener)
        }
    })

    observer.observe(document.body, { subtree: true, childList: true })

    // 3. Инициализация для уже существующих элементов
    const closeButton = document.querySelector(`.${closeButtonClass}`)
    if (closeButton) {
        closeButton.addEventListener('focus', handleFocus as EventListener)
    }
}
/*ОГРОМНЫЙ КОСТЫЛЬ ЧТО БЫ ПЕРЕХВАТЫВАТЬ УПРАВЛЕНИЕ ФОКУСОМ У PRIMEVUE (конец) */

// Всегда показываем актуальное значение location (если оно есть)
watch(
    () => currentAdverseEvent.value.location,
    (val) => {
        if (!isEditingManualLocation.value) {
            manualLocation.value = val ?? ''
        }
    },
    { immediate: true },
)

// Разворачиваем Panel в режиме просмотра ИЛИ если есть текст причин
watch(
    [isViewMode, () => currentAdverseEvent.value.corrective_measures],
    ([viewMode, cause]) => {
        isCausePanelCollapsed.value = !(viewMode || (cause && cause.trim() !== ''))
    },
    { immediate: true },
)

/**
 * Переключение режима редактирования ручной локации
 */
function onEditManualLocation() {
    manualLocation.value = currentAdverseEvent.value.location ?? ''
    isEditingManualLocation.value = true
}

/**
 * Сохранение ручной локации
 */
function onSaveManualLocation() {
    currentAdverseEvent.value.location = manualLocation.value.trim()
    isEditingManualLocation.value = false
}

/**
 * Заголовок модального окна в зависимости от состояния
 */
const modalHeader = computed<string>(() => {
    if (feedbackStore.isGlobalLoading) return 'Загрузка...'
    if (!route.params.id) return 'Новое нежелательное событие'
    return currentAdverseEvent.value.event_type?.name || 'Редактирование события'
})

/**
 * Текст кнопки сохранения в зависимости от режима
 */
const modalSaveButtonText = computed<string>(() => {
    return route.params.id ? 'Сохранить' : 'Зарегистрировать новое НС'
})

/**
 * Вычисляет человекочитаемый путь локации текущего события
 * на основе ID из currentAdverseEvent и структуры hospitalSkeleton.
 *
 * Вызов использует утилиту getLocationPath, которая:
 * - возвращает текст "Место происшествия указано вручную", если поле location заполнено
 * - возвращает null, если отсутствуют данные или hospitalSkeleton пуст
 * - формирует путь: [больница, корпус, этаж, помещение], если доступны соответствующие id
 *
 * Возвращает строку, готовую для отображения в UI, или пустую строку.
 */
const locationTypeFullPath = computed(() => {
    return (
        getLocationPath(
            {
                location: currentAdverseEvent.value.location,
                block: currentAdverseEvent.value.block,
                floor: currentAdverseEvent.value.floor,
                room: currentAdverseEvent.value.room,
            },
            hospitalSkeleton.value,
            {
                manualText: 'Место происшествия указано вручную',
                includeHospital: true,
            },
        ) || ''
    )
})

/**
 * Обработчик изменения выбора в древовидном селекторе типа события
 * Преобразует выбранный ключ в ID типа события
 */
const onChangeTreeSelectModal = (selectedKeys: IVModelTreeSelect | null) => {
    if (
        !selectedKeys ||
        (typeof selectedKeys === 'object' &&
            !Array.isArray(selectedKeys) &&
            Object.keys(selectedKeys).length === 0)
    ) {
        currentAdverseEvent.value.event_type = { id: 0 }
        primeTreeModal.value = {}
        return
    }

    let selectedKey: string | undefined

    if (Array.isArray(selectedKeys)) {
        selectedKey = selectedKeys[0]
    } else {
        selectedKey = Object.keys(selectedKeys)[0]
    }

    if (selectedKey && selectedKey.includes('-')) {
        const selectedTypeId = Number(selectedKey.split('-')[1])
        currentAdverseEvent.value.event_type = { id: selectedTypeId }
        primeTreeModal.value = { [selectedKey]: true }
    }
    moveFocusTo('department_to')
}

/**
 * Удаление участника события с подтверждением.
 * Если после удаления участников не осталось и активна вкладка "Участники" (value=1),
 * переключаемся на вкладку "Форма" (value=0).
 */
async function fetchDeleteParticipant(participant: IParticipant) {
    try {
        await confirmAction({
            message: `Удалить участника НС? ${participant.full_name}`,
            header: 'Подтвердите действие',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Удалить',
            rejectLabel: 'Отмена',
            acceptClass: 'p-button-danger',
        })

        // Обновляем массив участников — фильтруем либо по id, либо по key
        currentAdverseEvent.value.participants = (
            currentAdverseEvent.value.participants || []
        ).filter((p: IParticipant) => {
            // Если есть id у того и другого — сравниваем по id
            if (participant.id !== undefined && p.id !== undefined) {
                return p.id !== participant.id
            }
            // Если нет id, сравниваем по key
            if (participant.key && p.key) {
                return p.key !== participant.key
            }
            // Если не совпало ни то ни другое — не удаляем
            return true
        })

        // Если были на вкладке "Участники" и участников больше нет — переключаемся на "Форма"
        const wasOnParticipantsTab = Number(formTabValue.value) === 1
        const hasParticipants =
            Array.isArray(currentAdverseEvent.value.participants) &&
            currentAdverseEvent.value.participants.length > 0

        if (wasOnParticipantsTab && !hasParticipants) {
            formTabValue.value = 0
        }
    } catch {
        // Отмена подтверждения — ничего не делаем
    }
}

/**
 * Формирует сообщение об ошибках валидации на основе текущего состояния полей
 *
 * Собирает все ошибки валидации из store responsibilityEntries.fieldValidation
 * и объединяет их в читаемое сообщение для пользователя.
 *
 * @returns {string} Строка с перечислением ошибок вида:
 * "Заполните обязательные поля: не выбран вид события, не указаны дата и время"
 * или пустую строку, если ошибок нет
 */
const getValidationMessage = (): string => {
    const errors = []
    const { fieldValidation } = responsibilityEntries

    if (fieldValidation.adverseEventValidation.event_type) errors.push('не выбран вид события')
    if (fieldValidation.adverseEventValidation.date_time) errors.push('не указаны дата и время')
    if (fieldValidation.adverseEventValidation.description)
        errors.push('не заполнено краткое описание')

    return errors.length ? `Заполните обязательные поля: ${errors.join(', ')}` : ''
}

/**
 * Валидирует данные нежелательного события перед отправкой на сервер
 *
 * Проверяет обязательные поля формы:
 * 1. Для мероприятий - проверяет отдел (если создается новое мероприятие)
 * 2. Вид события
 * 3. Дата и время события
 * 4. Место события (либо ручной ввод, либо выбор из структуры)
 * 5. Краткое описание
 *
 * Устанавливает флаги ошибок в store responsibilityEntries.fieldValidation
 * для подсветки невалидных полей в интерфейсе.
 *
 * @param {ICreateAdversePayload} adverseEvent - Данные события для валидации
 * @returns {boolean} true - если все проверки пройдены, false - если есть ошибки
 */
function validateAdverseEvent(adverseEvent: ICreateAdversePayload): boolean {
    // Сбрасываем ошибки
    responsibilityEntries.fieldValidation.adverseEventValidation = {
        event_type: false,
        date_time: false,
        description: false,
    }

    let isValid = true

    // Валидация вида события
    if (!adverseEvent.event_type?.id) {
        responsibilityEntries.fieldValidation.adverseEventValidation.event_type = true
        isValid = false
    }

    // Валидация даты и времени
    if (!adverseEvent.date_time) {
        responsibilityEntries.fieldValidation.adverseEventValidation.date_time = true
        isValid = false
    }

    // Валидация описания
    if (!adverseEvent.description || adverseEvent.description.trim() === '') {
        responsibilityEntries.fieldValidation.adverseEventValidation.description = true
        isValid = false
    }

    return isValid
}

/**
 * Удаление существующего файла.
 * Добавляет ID в список adverseRemovedFileIds и сразу обновляет список файлов события.
 * @param id ID файла для удаления
 */
function onExistingFileRemove(id: number): void {
  if (!adverseRemovedFileIds.value.includes(id)) adverseRemovedFileIds.value.push(id)
  ;(currentAdverseEvent.value as any).files = existingAdverseFiles.value.filter(f => f.id !== id)
}

/**
 * Обновление локального списка новых файлов.
 * @param v массив выбранных файлов
 */
function onFilesUpdate(v: File[]): void { adverseFiles.value = Array.isArray(v) ? v : [] }

/**
 * Синхронизация файлов НС с сервером.
 * Загружает новые файлы и удаляет помеченные, после чего обновляет карточку события.
 * @param eventId ID события
 */
async function syncAdverseFiles(eventId: number): Promise<void> {
    const hasNew = Array.isArray(adverseFiles?.value) && adverseFiles.value.length > 0
    const hasDel = Array.isArray(adverseRemovedFileIds?.value) && adverseRemovedFileIds.value.length > 0
    if (!hasNew && !hasDel) return

    const tasks: Promise<any>[] = []
    if (hasNew) {
        tasks.push(filesStore.uploadAdverseEventFiles(eventId, adverseFiles.value, 'update'))
    }
    if (hasDel) {
        for (const fid of adverseRemovedFileIds.value) {
            tasks.push(filesStore.deleteAdverseEventFile(eventId, fid))
        }
    }

    // не даём исключениям вылететь наружу
    await Promise.allSettled(tasks)

    adverseFiles.value = []
    adverseRemovedFileIds.value = []

    // обновление карточки события — тоже без падения
    try { await apiStore.fetchAdverseEventById({ id: eventId }) } catch {}
}

/**
 * Основной обработчик отправки формы НС
 *
 * Назначение:
 * - Управляет процессом создания или обновления нежелательного события (НС).
 * - Обрабатывает сценарии редактирования, передачи ответственности, добавления новых исполнителей.
 * - Синхронизирует прикреплённые файлы с сервером.
 * - Показывает пользователю уведомления о результатах операций.
 *
 * Алгоритм работы:
 * 1. Подготовка:
 *    - Получаем id из route.params.
 *    - Берём данные текущего события (apiStore.currentAdverseEvent).
 *    - Сбрасываем ошибки валидации serverErrors.
 *
 * 2. Валидация:
 *    - Проверяем корректность данных через validateAdverseEvent.
 *    - Если ошибки есть → показываем Toast об ошибке заполнения и прерываем выполнение.
 *
 * 3. Режим передачи ответственности (transfer):
 *    - Проверяем наличие id и последней записи (lastEntry).
 *    - Если нет данных → показываем Toast об ошибке и выходим.
 *    - Берём временную запись (newEntry), добавленную ранее через pushTempResponsibilityEntry.
 *    - Формируем payload { ...newEntry, event_id: id, entry_id: lastEntry.id }.
 *    - Отправляем transferResponsibilityEntry(payload).
 *    - Сбрасываем formMode → 'add'.
 *    - Закрываем попап createOrUpdatePopup.
 *    - Обновляем данные события через fetchAdverseEventById.
 *
 * 4. Режим создания нового НС (id отсутствует):
 *    - Вызываем createAdverseEvent(payload).
 *    - Сразу после создаём синхронизацию файлов через syncAdverseFiles(created.id).
 *    - Сбрасываем список responsibility_entries.
 *    - Закрываем форму (createOrUpdatePopup = false).
 *    - Делаем навигацию назад (feedbackStore.goToParentRoute).
 *    - Перезагружаем список НС (loadAdverseEvents).
 *
 * 5. Режим редактирования существующего НС (id есть):
 *    - Получаем editableEvent и текущее событие (currentEvent).
 *    - Исключаем поле files из сравнения (чтобы не считать файлы изменением тела).
 *    - Считаем флаги:
 *       • isEventChanged — изменилось ли тело события.
 *       • wasEntry — были ли записи ответственности.
 *       • isEntry — есть ли записи сейчас.
 *       • addedEntry — появилось ли новое мероприятие (старых не было, теперь есть).
 *       • hasNewEntry — увеличилась ли длина массива записей.
 *
 *    Сценарии:
 *    5.1. !isEventChanged && !wasEntry && !isEntry:
 *         → ничего не изменилось, нет мероприятий.
 *         Действие: только синк файлов → syncAdverseFiles(id),
 *         закрыть попап и вернуться назад.
 *
 *    5.2. isEventChanged && !wasEntry && !isEntry:
 *         → изменилось тело НС, но мероприятий нет.
 *         Действие: updateAdverseEvent, syncAdverseFiles(id),
 *         закрыть попап, вернуться назад, перезагрузить список.
 *
 *    5.3. isEventChanged && addedEntry:
 *         → изменилось тело НС и появилось новое мероприятие.
 *         Действие: updateAdverseEvent + createResponsibilityEntry,
 *         syncAdverseFiles(id), закрыть попап, вернуться назад, перезагрузить список.
 *
 *    5.4. !isEventChanged && addedEntry:
 *         → тело НС не изменилось, появилось мероприятие.
 *         Действие: только createResponsibilityEntry + syncAdverseFiles(id).
 *
 *    5.5. !isEventChanged && hasNewEntry:
 *         → добавлен очередной исполнитель.
 *         Действие: createResponsibilityEntry, обновить список мероприятий (getResponsibilityEntries),
 *         обновить карточку события (fetchAdverseEventById), syncAdverseFiles(id).
 *
 *    5.6. isEventChanged && newLen === oldLen:
 *         → изменилось только тело НС, список мероприятий не менялся.
 *         Действие: updateAdverseEvent, syncAdverseFiles(id),
 *         закрыть попап, вернуться назад, перезагрузить список.
 *
 * 6. Ошибки:
 *    - При возникновении ошибки кладём ошибки сервера в serverErrors.
 *    - Логируем ошибку в консоль.
 *
 * Возвращает:
 * - Promise<void>
 */
async function onFormSubmit() {
    console.log('onFormSubmit сработал')
    const id = Number(route.params.id)
    const data = apiStore.currentAdverseEvent
    serverErrors.value = {}

    // [1] Валидация
    if (!validateAdverseEvent(data as ICreateAdversePayload)) {
        feedbackStore.showToast({
            type: 'error',
            title: 'Ошибка заполнения',
            message: getValidationMessage(),
            time: 7000,
        })
        return
    }

    // === [TRANSFER MODE] ===
    if (responsibilityEntries.formMode === 'transfer') {
        const currentEntries = responsibilityEntries.currentResponsibilityEntries
        const lastEntry = currentEntries.length > 0 ? currentEntries[0] : null

        if (!id || !lastEntry?.id) {
            feedbackStore.showToast({
                type: 'error',
                title: 'Ошибка',
                message: 'Нет идентификатора события или мероприятия для передачи',
                time: 5000,
            })
            return
        }

        // Берем последнюю добавленную временную запись (которая только что была добавлена через pushTempResponsibilityEntry)
        const newEntry = apiStore.currentAdverseEvent.responsibility_entries?.[0]

        if (!newEntry) {
            feedbackStore.showToast({
                type: 'error',
                title: 'Ошибка',
                message: 'Не найдены данные для передачи',
                time: 5000,
            })
            return
        }

        try {
            // Собираем payload только с данными записи
            const transferPayload = {
                ...newEntry,
                event_id: id,
                entry_id: lastEntry.id,
            }

            await responsibilityEntries.transferResponsibilityEntry(transferPayload)
            responsibilityEntries.formMode = 'add' // Сброс режима
            feedbackStore.createOrUpdatePopup = false

            // Обновляем данные события
            await apiStore.fetchAdverseEventById({ id })
        } catch (error: any) {
            serverErrors.value = error?.data?.errors ?? {}
            console.log('[onFormSubmit][transfer] Ошибка:', error)
        }
        return
    }

    try {
        if (!id) {
            // === Кейс 1: Создание нового НС ===
            console.log('[onFormSubmit] Кейс: создание нового НС (createAdverseEvent).')
            // сначала JSON, потом файлы
            const created = await apiStore.createAdverseEvent(data as ICreateAdversePayload)
            await syncAdverseFiles(created.id)

            apiStore.currentAdverseEvent.responsibility_entries = []
            feedbackStore.createOrUpdatePopup = false
            await feedbackStore.goToParentRoute()
            await apiStore.loadAdverseEvents()
            return
        }

        // === Кейс 2: Редактирование существующего НС ===
        const editableEvent = apiStore.editableAdverseEvent
        const currentEvent = data as ICreateAdversePayload

        // ИСКЛЮЧАЕМ files из сравнения тела НС
        const { responsibility_entries: oldEntries = [], files: _f1, ...oldData } =
            ((editableEvent || {}) as any)
        const { responsibility_entries: newEntries = [], files: _f2, ...newData } =
            ((currentEvent || {}) as any)

        const isEventChanged = JSON.stringify(oldData) !== JSON.stringify(newData)
        const wasEntry = oldEntries.length > 0
        const isEntry = newEntries.length > 0
        const oldLen = oldEntries.length
        const newLen = newEntries.length

        // Проверяем: был ли entry и появился ли он
        // Сравниваем массивы по длине
        const addedEntry = !wasEntry && isEntry

        // 1. Ничего не поменялось, нет мероприятия — просто закрываем
        if (!isEventChanged && !wasEntry && !isEntry) {
            console.log('[onFormSubmit] Кейс: ничего не изменилось, мероприятий нет — закрываем.')
            await syncAdverseFiles(id)
            feedbackStore.createOrUpdatePopup = false
            await feedbackStore.goToParentRoute()
            return
        }

        // 2. Изменился НС, мероприятий нет и не появилось
        if (isEventChanged && !wasEntry && !isEntry) {
            console.log('[onFormSubmit] Кейс: изменилось тело НС, мероприятий не было и не появилось — PATCH НС.')
            await apiStore.updateAdverseEvent({ id, payload: data as ICreateAdversePayload })
            await syncAdverseFiles(id)
            feedbackStore.createOrUpdatePopup = false
            await feedbackStore.goToParentRoute()
            await apiStore.loadAdverseEvents()
            return
        }

        // 3. Изменилось тело НС, мероприятий не было, но появилось
        if (isEventChanged && addedEntry) {
            console.log('[onFormSubmit] Кейс: изменилось тело НС, мероприятие появилось — PATCH НС + POST мероприятие.')
            await apiStore.updateAdverseEvent({ id, payload: data as ICreateAdversePayload })
            await responsibilityEntries.createResponsibilityEntry({ event_id: id, ...newEntries[newEntries.length - 1] })
            await syncAdverseFiles(id)
            feedbackStore.createOrUpdatePopup = false
            await feedbackStore.goToParentRoute()
            await apiStore.loadAdverseEvents()
            return
        }

        // 4. Не изменилось тело НС, мероприятий не было, но появилось
        if (!isEventChanged && addedEntry) {
            console.log('[onFormSubmit] Кейс: тело НС не изменилось, появилось мероприятие — только POST мероприятие.')
            await responsibilityEntries.createResponsibilityEntry({ event_id: id, ...newEntries[newEntries.length - 1] })
            await apiStore.fetchAdverseEventById({ id })
            await syncAdverseFiles(id)
            return
        }

        // === Кейс 5: Добавление очередного исполнителя (новое мероприятие)
        const hasNewEntry = newEntries.length > oldEntries.length
        const isOnlyNewEntryAdded = !isEventChanged && hasNewEntry

        if (isOnlyNewEntryAdded) {
            console.log('[onFormSubmit] Кейс: добавление очередного исполнителя — только POST мероприятие.')
            await responsibilityEntries.createResponsibilityEntry({ event_id: id, ...newEntries[newEntries.length - 1] })

            // ⤵️ обновляем источник таблицы
            await apiStore.fetchAdverseEventById({ id })
            await syncAdverseFiles(id)
            return
        }

        // [CASE 6] Изменилось тело НС, а список мероприятий не менялся — PATCH НС.
        if (isEventChanged && newLen === oldLen) {
            console.log('[onFormSubmit] Кейс 6: изменилось тело НС, мероприятия не менялись — PATCH НС.')
            await apiStore.updateAdverseEvent({ id, payload: data as ICreateAdversePayload })
            await syncAdverseFiles(id)
            feedbackStore.createOrUpdatePopup = false
            await feedbackStore.goToParentRoute()
            await apiStore.loadAdverseEvents()
            return
        }

    } catch (error: any) {
        serverErrors.value = error?.data?.errors ?? {}
        console.log('[onFormSubmit] Ошибка:', error)
    }
}

/**
 * Создает конфигурацию кнопок для добавления участников
 */
function createTableActionButtons() {
    // Создание кнопок действий для таблицы участников
    return [
        {
            label: 'Пациент',
            command: () => {
                eventParticipantType.value = 'Пациент'
                patientOrGuestModal.value = true
            },
        },
        {
            label: 'Сотрудник',
            command: () => {
                eventParticipantType.value = 'Сотрудник'
                employeeSelectionModalRef.value = true
            },
        },
        {
            label: 'Посетитель',
            command: () => {
                eventParticipantType.value = 'Посетитель'
                patientOrGuestModal.value = true
            },
        },
        {
            label: 'Другое',
            command: () => {
                eventParticipantType.value = 'Другое'
                commentModal.value = true
            },
        },
    ]
}

/**
 * Реактивная модель для даты и времени события
 * Обеспечивает двустороннее связывание с преобразованием форматов
 */
const dateTimeModel = computed<Date | null>({
    get() {
        const val = currentAdverseEvent.value.date_time
        if (!val) return null
        if (val instanceof Date) return val
        // Если строка - пытаемся сконвертировать
        const d = new Date(val)
        return isNaN(d.getTime()) ? null : d
    },
    set(val) {
        currentAdverseEvent.value.date_time = val
            ? val instanceof Date
                ? val.toISOString()
                : String(val)
            : null
    },
})

/**
 * Обработчик выбора отделения
 * - Сохраняет выбор
 * - Очищает текст фильтра (и локально, и в реальном input)
 * - Переносит фокус на "Место"
 */
function onDepartmentSelect(id: string | null) {
    // 1) сохранить выбор
    currentAdverseEvent.value.department = id ? { id } : null

    // 2) очистить фильтр у Dropdown "Отделение"
    // (чтобы при следующем открытии поле поиска было пустым)
    if (typeof departmentFilter !== 'undefined') {
        departmentFilter.value = ''
    }
    const root = departmentDropdown.value?.$el as HTMLElement | undefined
    if (root) {
        const input = root.querySelector('input.p-select-filter') as HTMLInputElement | null
        if (input) {
            input.value = ''
            // сообщаем компоненту, что фильтр изменился
            input.dispatchEvent(new Event('input', { bubbles: true }))
        }
    }

    // 3) фокус на кнопку выбора места
    moveFocusTo('location')
    nextTick(() => {
        const locationButton = document.getElementById('location_button')
        if (locationButton) {
            locationButton.classList.add('force-focus-visible')
        }
    })
}

/**
 * Отслеживание изменений типа события и дерева категорий
 * для синхронизации выбранного значения в древовидном селекторе
 */
watch(
    [
        () => currentAdverseEvent.value.event_type,
        () => categoryTypeTree.value,
        () => isInitialLoad.value,
    ],
    ([et, tree, isInitial]) => {
        // Если нет типа события или дерево не загружено
        if (!et?.id || !tree?.length) {
            primeTreeModal.value = {}
            return
        }

        // Ищем соответствующий ключ в дереве
        let foundKey = ''
        for (const cat of tree) {
            if (cat.children) {
                const match = cat.children.find((child) => {
                    const childId = Number(child.key.split('-').pop())
                    return childId === et.id
                })
                if (match) {
                    foundKey = match.key
                    break
                }
            }
        }

        // Устанавливаем значение только если нашли ключ
        if (foundKey) {
            primeTreeModal.value = { [foundKey]: true }
        } else {
            primeTreeModal.value = {}
        }

        // Сбрасываем флаг начальной загрузки после первого выполнения
        if (isInitial) {
            isInitialLoad.value = false
        }
    },
    { immediate: true, deep: true },
)

/**
 * Проверка наличия ошибок валидации формы
 * Возвращает true, если хотя бы одно из обязательных полей не прошло валидацию
 */
const isFormTabError = computed(
    () =>
        responsibilityEntries.fieldValidation.adverseEventValidation.event_type ||
        responsibilityEntries.fieldValidation.adverseEventValidation.date_time ||
        responsibilityEntries.fieldValidation.adverseEventValidation.description,
)

/**
 * Закрывает форму и сбрасывает данные
 */
function closeForm() {
    // Сбрасываем временные данные мероприятий
    responsibilityEntries.resetResponsibilityEntry()
    responsibilityEntries.setFormMode('add')

    // Очищаем ошибки формы
    responsibilityEntries.fieldValidation = {
        adverseEventValidation: {
            event_type: false,
            date_time: false,
            description: false,
        },
        responsibilityValidation: {
            employee_type: false,
            instructions_type: false,
            deadline_type: false,
        },
    }

    isCreatingEntry.value = false

    // Закрываем форму
    feedbackStore.goToParentRoute()
}

/**
 * Проверяет, были ли изменения в форме
 */
function checkFormChanges(): boolean {
    const id = Number(route.params.id)

    // Для нового события проверяем, есть ли какие-то данные
    if (!id) {
        return !isEmptyForm(currentAdverseEvent.value)
    }

    // Для редактирования сравниваем с исходными данными
    const editableEvent = apiStore.editableAdverseEvent
    const currentEvent = currentAdverseEvent.value

    if (!editableEvent) return true

    // Сравниваем основные данные (исключая мероприятия)
    const { responsibility_entries: oldEntries = [], ...oldData } = editableEvent
    const { responsibility_entries: newEntries = [], ...newData } = currentEvent

    return (
        JSON.stringify(oldData) !== JSON.stringify(newData) ||
        JSON.stringify(oldEntries) !== JSON.stringify(newEntries)
    )
}

/**
 * Проверяет, является ли форма пустой (без пользовательских изменений)
 * Игнорирует автоматически установленную текущую дату
 */
function isEmptyForm(event: ICreateAdversePayload): boolean {
    // Получаем текущую дату и округляем до секунд для сравнения
    const now = new Date()
    const currentDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        now.getHours(),
        now.getMinutes(),
        now.getSeconds(),
    ).toISOString()

    // 1. Проверка полей с числовыми ID (игнорируем 0 и undefined)
    const hasIdFields = [
        event.event_type?.id,
        event.block?.id,
        event.floor?.id,
        event.room?.id,
    ].some((id) => id !== undefined && id !== 0)

    // 2. Проверка текстовых полей с учетом округленной даты
    const hasTextFields = [
        // Игнорируем дату, если она отличается от текущей менее чем на 2 минуты
        Math.abs(new Date(event.date_time || 0).getTime() - now.getTime()) > 120000
            ? event.date_time
            : '',
        event.description,
        event.location,
    ].some((text) => typeof text === 'string' && text.trim() !== '')

    // 3. Проверка массивов
    const hasArrays = [event.participants, event.responsibility_entries].some(
        (arr) => Array.isArray(arr) && arr.length > 0,
    )

    // Логирование
    console.log('Form check details:', {
        currentDateRounded: currentDate,
        formDateTime: event.date_time,
        timeDiffMs: Math.abs(new Date(event.date_time || 0).getTime() - now.getTime()),
        hasIdFields,
        hasTextFields,
        hasArrays,
    })

    return !hasIdFields && !hasTextFields && !hasArrays
}

/**
 * Тип ключей управляемых полей формы для программного фокуса.
 *
 * Назначение:
 * - Централизованный перечень допустимых идентификаторов контролов,
 *   совпадающих с их DOM id (используется в moveFocusTo).
 *
 * Состав:
 * - 'event_type'     — селектор вида события
 * - 'department_to'  — Dropdown отдела
 * - 'location'       — кнопка/поле выбора места
 * - 'date_time'      — Calendar (дата и время)
 * - 'description'    — Textarea краткого описания
 * - 'probability'    — Select вероятности
 * - 'consequence'    — Select последствий
 * - 'cause'          — Textarea причин (панель)
 */
type FocusField =
    | 'event_type'
    | 'department_to'
    | 'location'
    | 'date_time'
    | 'description'
    | 'probability'
    | 'consequence'
    | 'cause'

/**
 * Текущее целевое поле фокуса.
 *
 * Назначение:
 * - Хранит последний «запрошенный» фокус для отладки и условной логики.
 *
 * Поведение:
 * - Обновляется каждый раз при вызове moveFocusTo(field).
 * - Может быть null, когда явных запросов фокуса нет.
 */
const currentFocus = ref<FocusField | null>(null)

/**
 * Перемещает фокус на элемент формы по ключу FocusField.
 *
 * Алгоритм:
 * 1) Сохраняет целевой ключ в currentFocus.
 * 2) В nextTick ищет элемент с id == field.
 * 3) Вызывает .focus() и, если у элемента есть метод select,
 *    выделяет содержимое (для инпутов/текстовых полей).
 *
 * Назначение:
 * - Унифицированная точка программной навигации по полям формы.
 *
 * Важно:
 * - Требует, чтобы id в шаблоне совпадал с ключом FocusField.
 */
const moveFocusTo = (field: FocusField) => {
    currentFocus.value = field
    nextTick(() => {
        const el = document.getElementById(field)
        if (el) {
            el.focus()
            if ('select' in el) (el as HTMLInputElement).select()
        }
    })
}

/**
 * Вернуть фокус на первый контрол вкладки "Форма".
 * Ждём рендер панели и ставим фокус в TreeSelect.
 */
function focusFormTab() {
    nextTick(() => {
        // Пытаемся попасть в input внутри вашего FilterTreeSelect
        const input =
            treeSelect.value?.treeSelect?.$el?.querySelector?.('input[role="combobox"]') ||
            treeSelect.value?.$el?.querySelector?.('input[role="combobox"]')

        if (input instanceof HTMLInputElement) {
            input.focus()
            input.select?.()
            return
        }

        // Фолбэк: если id есть — используем вашу общую функцию
        moveFocusTo('event_type')
    })
}

/**
 * Возврат автофокуса на вкладку "Форма".
 *
 * Триггер:
 * - Срабатывает при переключении Tabs, когда активной становится вкладка с value=0.
 *
 * Действие:
 * - Вызывает focusFormTab(), который переводит фокус на первый контрол вкладки.
 */
watch(formTabValue, (v) => {
    if (Number(v) === 0) focusFormTab()
})

/**
 * Автофокус после закрытия модалки выбора места.
 *
 * Триггер:
 * - Изменение флага locationTypeModal: true → false.
 *
 * Действие:
 * - В nextTick переносит фокус на поле 'description'
 *   (следующий логический шаг после выбора места).
 */
watch(locationTypeModal, (newVal, oldVal) => {
    // Когда модалка закрывается (была true, стала false)
    if (oldVal && !newVal) {
        nextTick(() => {
            // Переносим фокус на следующее поле после выбора места
            moveFocusTo('description')
        })
    }
})

/**
 * Ссылка на текущий экземпляр Dropdown "Отделение".
 *
 * Назначение:
 * - Доступ к внутреннему DOM overlay/инпуту фильтра для автофокуса и биндинга событий.
 */
const departmentDropdown = ref()

/**
 * Локальная строка фильтра для Dropdown "Отделение".
 *
 * Назначение:
 * - Используется только для подсветки совпадений в разметке опций (через v-html).
 */
const departmentFilter = ref('')

/**
 * Подсветка совпадений в label по текущему фильтру.
 *
 * Алгоритм:
 * - Экранирует спецсимволы search.
 * - Оборачивает совпадения в <mark>…</mark> (регистронезависимо).
 *
 * Возвращает:
 * - HTML-строку для безопасного вывода в шаблоне опции.
 */
const highlightDepartmentMatch = (label: string, search: string) => {
    if (!search) return label
    const safe = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return (label ?? '').replace(new RegExp(`(${safe})`, 'ig'), '<mark>$1</mark>')
}

/**
 * MutationObserver и набор «привязанных» инпутов фильтра Dropdown.
 *
 * Назначение:
 * - deptMO отслеживает появление/перемонтирование overlay и инпута фильтра.
 * - deptBoundInputs предотвращает повторную регистрацию обработчиков на одном и том же input.
 */
let deptMO: MutationObserver | null = null
const deptBoundInputs = new WeakSet<HTMLInputElement>()

/**
 * Привязка к внутреннему инпуту фильтра Dropdown.
 *
 * Алгоритм:
 * 1) Находит input.p-select-filter внутри текущего Dropdown.
 * 2) Если ещё не привязан — фокусирует и выделяет текст.
 * 3) Подписывается на 'input' (passive) и обновляет departmentFilter.
 *
 * Особенности:
 * - Вызывается как немедленно (если overlay уже в DOM), так и из MutationObserver.
 */
const bindDepartmentFilterInput = () => {
    const root = departmentDropdown.value?.$el as HTMLElement | undefined
    if (!root) return

    // в DOM класс инпута — .p-select-filter (новый Dropdown)
    const input = root.querySelector('input.p-select-filter') as HTMLInputElement | null
    if (input && !deptBoundInputs.has(input)) {
        deptBoundInputs.add(input)

        // автофокус при первом появлении
        setTimeout(() => {
            input.focus()
            input.select()
        }, 0)

        // держим актуальный текст для подсветки
        input.addEventListener(
            'input',
            (e) => {
                departmentFilter.value = (e.target as HTMLInputElement).value || ''
            },
            { passive: true },
        )
    }
}


/**
 * Обрабатывает клик по основной кнопке "Выберите участника" и
 * переключает состояние выпадающего меню SplitButton.
 *
 * Алгоритм:
 * - Находит элемент SplitButton в DOM по ID 'participantsSplit'
 * - Ищет внутри него кнопку со стрелкой (dropdown) для открытия меню
 * - Определяет текущее состояние меню по overlay-элементу:
 *   - isOpen = true, если overlay существует и не скрыт через display: none
 * - Если меню открыто — закрывает его кликом по кнопке закрытия внутри overlay
 * - Если меню закрыто — открывает его кликом по dropdown-кнопке
 *
 * Возвращает: ничего.
 */
const handleMainButtonClick = () => {
    const splitButton = document.getElementById('participantsSplit')
    const dropdownBtn = splitButton?.querySelector('.p-splitbutton-dropdown') as HTMLElement

    if (!dropdownBtn) return

    // 1. Получаем текущее состояние через overlay
    const overlay = document.getElementById('participantsSplit_overlay')
    const isOpen = !!overlay && overlay.style.display !== 'none'

    // 2. Если меню открыто - закрываем, иначе открываем
    if (isOpen) {
        // Закрываем через клик по overlay (более надежно)
        const closeBtn = overlay?.querySelector('.p-overlay-close') as HTMLElement
        closeBtn?.click()
    } else {
        // Открываем через клик по dropdown-кнопке
        dropdownBtn.click()
    }
}

/**
 * Управляет изменением видимости формы создания/редактирования НС.
 *
 * Алгоритм:
 * 1. Если nextVisible === true → просто открываем форму (createOrUpdatePopup = true).
 * 2. Если nextVisible === false:
 *    - Если guard уже true → выходим, чтобы не зациклиться.
 *    - Ставим guard = true.
 *    - Мгновенно возвращаем createOrUpdatePopup = true, чтобы форма не исчезла до подтверждения.
 *    - Если изменений в форме нет (checkFormChanges() === false) → сбрасываем guard и закрываем (closeForm()).
 *    - Если изменения есть:
 *        • Показываем confirmAction()
 *        • При подтверждении — сбрасываем guard и закрываем форму
 *        • При отмене — просто сбрасываем guard (форма остаётся открытой)
 *
 * Параметры:
 * @param nextVisible — целевое состояние видимости, пришедшее из @update:visible
 *
 * Возвращает: Promise<void>
 */
const onDialogVisibleChange = async (nextVisible: boolean): Promise<void> => {
    // Открытие — просто открыть
    if (nextVisible) {
        createOrUpdatePopup.value = true
        return
    }

    // Всегда мгновенно возвращаем видимость обратно
    createOrUpdatePopup.value = true

    // Уже внутри перехвата — выходим
    if (guard) return
    guard = true

    await nextTick()
    createOrUpdatePopup.value = true

    // если изменений нет — закрываем сразу
    if (!checkFormChanges()) {
        guard = false
        closeForm()
        return
    }

    try {
        await confirmAction({
            message: route.params.id
                ? 'Отменить изменения события?'
                : 'Отменить создание нового события?',
            header: 'Подтвердите действие',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Да, отменить',
            rejectLabel: 'Нет, продолжить',
            acceptClass: 'p-button-secondary',
        })
        // подтвердили — закрываем
        guard = false
        closeForm()
    } catch {
        // отказались — оставляем открытым (оно уже true), просто снимаем guard
        guard = false
        createOrUpdatePopup.value = true
    }
}

/**
 * Подпись для кнопки назначения/смены координатора.
 *
 * Назначение:
 * - Показывает корректный текст в зависимости от наличия текущего координатора.
 *
 * Возвращает:
 * @returns {string} 'Сменить координатора' | 'Назначить координатора'
 *
 * Зависимости:
 * - currentAdverseEvent.value.coordinator
 */
const coordinatorLabel = computed(() =>
    currentAdverseEvent.value.coordinator ? 'Сменить координатора' : 'Назначить координатора',
)

/**
 * Обработчик выбора координатора НС из модального окна.
 *
 * Назначение:
 * - При выборе сотрудника — сохраняет его как координатора события.
 * - При передаче null — очищает текущего координатора.
 *
 * Параметры:
 * @param {ICreatedBy | null} employee — выбранный сотрудник или null для очистки
 *
 * Возвращает:
 * @returns {void}
 *
 * Побочные эффекты:
 * - Мутирует currentAdverseEvent.value.coordinator.
 */
function onEmployeeSelected(employee: ICreatedBy | null) {
    if (!employee) {
        // Очистка выбора
        currentAdverseEvent.value.coordinator = null
        return
    }

    // Установка выбранного сотрудника
    currentAdverseEvent.value.coordinator = employee
}

const centrifugeStore = useCentrifugeStore()
let currentAdverseEventsChannel: string | null = null

/**
 * Инициализация компонента.
 *
 * Последовательность:
 * 1) Если есть id в маршруте — грузит событие и связанные записи; при отсутствии прав переключает в режим просмотра.
 * 2) Если id нет — создаёт новый черновик и проставляет текущую дату (если не задана).
 * 3) Сбрасывает флаг первичной загрузки.
 * 4) Запускает перехват фокуса крестика диалога (watchCloseButtonFocus()).
 * 5) После nextTick:
 *    - Инициализирует MutationObserver (deptMO) на Dropdown «Отделение».
 *    - Немедленно пытается привязаться к инпуту фильтра (если overlay уже в DOM).
 */
onMounted(async () => {
    const id = Number(route.params.id)
    if (id) {
        // 1) Пытаемся загрузить событие
        try {
            await apiStore.fetchAdverseEventById({ id })

        } catch (e) {
            await router.replace({ name: ERouteNames.ADVERSE_EVENTS })
            return
        }
        feedbackStore.showPopup()
    } else {
        isViewMode.value = false
        feedbackStore.showPopup()
        if (!currentAdverseEvent.value.date_time) {
            currentAdverseEvent.value.date_time = new Date().toISOString()
        }
    }

    isInitialLoad.value = false

    watchCloseButtonFocus()

    await nextTick()
    const root = departmentDropdown.value?.$el as HTMLElement | undefined
    if (root) {
        deptMO = new MutationObserver(() => bindDepartmentFilterInput())
        deptMO.observe(root, { childList: true, subtree: true })
        bindDepartmentFilterInput()
    }
})

/**
 * Деинициализация компонента.
 *
 * Действия:
 * - Отключает наблюдателей (observer, deptMO) и обнуляет ссылки,
 *   чтобы не держать лишние подписки после размонтирования.
 */
onUnmounted(() => {
    observer?.disconnect()
    deptMO?.disconnect()
    deptMO = null
    if (currentAdverseEventsChannel) {
        centrifugeStore.centrifugeUnsubscribe(currentAdverseEventsChannel)
    }
})
</script>

<template>
    <!-- Основное диалоговое окно формы -->
    <Dialog
        v-model:visible="createOrUpdatePopup"
        :style="{ width: '1000px' }"
        :modal="true"
        @update:visible="onDialogVisibleChange"
        :auto-focus="false"
    >
        <template #header>
            <div class="flex items-center justify-between gap-3 flex-nowrap w-full min-h-[44px]">
                <h2 class="flex-1 min-w-0 m-0 font-semibold text-[18px] truncate p-dialog-title">
                    <span v-if="tooltip" v-app-tooltip.bottom="tooltip"> {{ modalHeader }} </span>
                    <span v-else> {{ modalHeader }} </span>
                </h2>

                <StatusChip :status="currentAdverseEvent?.status" />
            </div>
        </template>

        <Form @submit="onFormSubmit" @entry-added="onFormSubmit">
            <!-- Вкладки формы -->
            <Tabs :value="formTabValue" @update:value="(val) => (formTabValue = Number(val))">
                <TabList>
                    <Tab :value="0" :class="[isFormTabError ? 'tab-error' : '']">Форма</Tab>
                    <Tab :value="1" v-if="currentAdverseEvent?.participants?.length">Участники</Tab>
                    <Tab :value="2" v-if="canSeeCoordinatorTab">Координатор НС</Tab>
                    <Tab
                        :value="3"
                        v-if="
                            (canSeeExecutorTab || canSeeCoordinatorTab) &&
                            currentAdverseEvent.responsibility_entries?.length
                        "
                        >Исполнитель</Tab
                    >
                </TabList>

                <TabPanels>
                    <!-- Вкладка "Форма" -->
                    <TabPanel :value="0" header="Форма" class="flex flex-col gap-4 w-full">
                        <div class="grid grid-cols-12 gap-4">
                            <!-- Вид события -->
                            <div class="col-span-12 md:col-span-6">
                                <label for="event_type" class="block font-bold mb-3 label-required"
                                    >Вид события</label
                                >
                                <FilterTreeSelect
                                    ref="treeSelect"
                                    name="event_type"
                                    :class="[
                                        'w-full',
                                        fieldValidation.adverseEventValidation.event_type
                                            ? 'field-error'
                                            : '',
                                        serverErrors?.event_type ? 'invalid-by-server' : '',
                                    ]"
                                    labelFor="categoryTypeTreeModal"
                                    placeholder="Выберите вид"
                                    selectionMode="single"
                                    :changeHandler="onChangeTreeSelectModal"
                                    :options="categoryTypeTree"
                                    v-model="primeTreeModal"
                                    :disabled="!canEditFormEventType"
                                    :readonly="!canEditFormEventType"
                                />
                                <Message
                                    v-if="serverErrors?.event_type"
                                    severity="error"
                                    size="small"
                                    variant="simple"
                                    class="mt-2"
                                >
                                    <ul class="my-0 flex flex-col gap-1">
                                        <li
                                            v-for="(error, index) of serverErrors?.event_type"
                                            :key="index"
                                        >
                                            {{ error }}
                                        </li>
                                    </ul>
                                </Message>
                            </div>

                            <!-- Дата и время -->
                            <div class="col-span-12 md:col-span-6">
                                <label for="date_time" class="block font-bold mb-3 label-required"
                                    >Дата и время события</label
                                >
                                <DatePicker
                                    v-model="dateTimeModel"
                                    showTime
                                    showIcon
                                    showButtonBar
                                    inputId="date_time"
                                    :class="[
                                        'w-full',
                                        fieldValidation.adverseEventValidation.date_time
                                            ? 'field-error'
                                            : '',
                                    ]"
                                    :disabled="!canEditFormGeneral"
                                    :readonly="!canEditFormGeneral"
                                />
                            </div>
                        </div>

                        <!-- Отделение -->
                        <div class="col-span-12">
                            <div class="grid grid-cols-12 gap-4 md:gap-6 items-center">
                                <!-- Отдел -->
                                <div class="col-span-12 md:col-span-4 min-w-0 flex items-center flex-col justify-center">
                                    <label for="department_to" class="font-bold mb-3">
                                        Выберите отделение, в котором произошло НС
                                    </label>
                                    <Select
                                        ref="departmentDropdown"
                                        append-to="self"
                                        :options="departments"
                                        option-label="name"
                                        option-value="id"
                                        :filter="true"
                                        showClear
                                        placeholder="Выберите отделение"
                                        input-id="department_to"
                                        class="w-full"
                                        :model-value="currentAdverseEvent.department?.id ?? null"
                                        @update:model-value="onDepartmentSelect"
                                        :disabled="!canEditFormGeneral"
                                    >
                                        <template #option="slotProps">
          <span
              v-html="highlightDepartmentMatch(slotProps.option?.name ?? '', departmentFilter)"
          ></span>
                                        </template>
                                    </Select>
                                </div>

                                <!-- Место события -->
                                <div class="col-span-12 md:col-span-4 min-w-0 flex items-center flex-col justify-center">
                                    <label class="font-bold mb-3">Место события</label>

                                    <Button
                                        v-if="locationTypeFullPath"
                                        variant="link"
                                        class="text-left"
                                        @click="!isCompleted && !isInspector && (locationTypeModal = true)"
                                        :disabled="!canEditFormGeneral"
                                    >
                                        {{ locationTypeFullPath }}
                                    </Button>

                                    <Button
                                        v-else
                                        variant="link"
                                        id="location_button"
                                        class="w-full text-left break-words whitespace-normal"
                                        @click="locationTypeModal = true"
                                        :disabled="!canEditFormGeneral"
                                    >
                                        <template v-if="!canEditFormGeneral">
                                            {{
                                                currentAdverseEvent.location
                                                    ? 'Не указано'
                                                    : 'Не указано'
                                            }}
                                        </template>
                                        <template v-else>
                                        {{
                                            currentAdverseEvent.location
                                                ? 'Не выбрано, нажмите чтобы выбрать'
                                                : 'Не выбрано. Нажмите, чтобы выбрать'
                                        }}
                                        </template>
                                    </Button>

                                    <Message
                                        v-if="serverErrors?.location_type"
                                        severity="error"
                                        size="small"
                                        variant="simple"
                                        class="mt-2"
                                    >
                                        <ul class="my-0 flex flex-col gap-1">
                                            <li v-for="(error, index) of serverErrors?.location_type" :key="index">
                                                {{ error }}
                                            </li>
                                        </ul>
                                    </Message>
                                </div>

                                <!-- Участники -->
                                <div class="col-span-12 md:col-span-4 min-w-0 flex flex-col items-center justify-center ">
                                    <label class="font-bold mb-3">Участники события</label>
                                    <SplitButton
                                        id="participantsSplit"
                                        v-if="canEditParticipants"
                                        :disabled="!canEditParticipants"
                                        label="Выберите участника"
                                        :model="createTableActionButtons()"
                                        @click="handleMainButtonClick"
                                        class="md:w-auto"
                                    />
                                    <span class="font-bold" :style="{ color: 'var(--text-color)' }" v-if="!canEditParticipants">Выбор запрещен (режим просмотра)</span>
                                </div>
                            </div>
                        </div>

                        <!-- Последний добавленный участник (простая таблица, без DataTable и без SplitButton) -->
                        <div v-if="currentAdverseEvent?.participants?.length" class="col-span-full">
                            <p class="font-bold mb-2">Последний добавленный участник</p>

                            <div class="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                                <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                    <thead class="bg-gray-50 dark:bg-gray-800/60">
                                    <tr class="text-left text-sm font-semibold text-gray-700 dark:text-gray-200">
                                        <th class="px-4 py-3">Тип участника</th>
                                        <th class="px-4 py-3">ФИО</th>
                                        <th class="px-4 py-3">Дата рождения</th>
                                        <th class="px-4 py-3">Номер телефона</th>
                                        <th class="px-4 py-3">Комментарий</th>
                                        <th v-if="canEditParticipants" class="px-4 py-3 w-1">Действия</th>
                                    </tr>
                                    </thead>

                                    <tbody class="divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                                    <tr
                                        v-for="p in [currentAdverseEvent.participants[currentAdverseEvent.participants.length - 1]]"
                                        :key="p.key || p.employee_id || p.full_name || p.comment || 'last-row'"
                                        class="odd:bg-white even:bg-gray-50/50 dark:odd:bg-gray-900 dark:even:bg-gray-900/60 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                    >
                                        <!-- Тип -->
                                        <td class="px-4 py-3 align-top">
                                            {{
                                                p?.participant_type
                                                    ? (apiStore.participantTypes[p.participant_type] || p.participant_type)
                                                    : '----'
                                            }}
                                        </td>

                                        <!-- ФИО -->
                                        <td class="px-4 py-3 align-top">
                                            <span v-if="p.full_name" class="font-medium">{{ p.full_name }}</span>
                                            <span v-else class="text-gray-500 italic">---- </span>
                                        </td>

                                        <!-- Дата рождения (participant или employee) -->
                                        <td class="px-4 py-3 align-top">
            <span v-if="p.birth_date">
              {{ formatDateOnly(p.birth_date) }}
            </span>
                                            <span v-else class="text-gray-500 italic">---- </span>
                                        </td>

                                        <!-- Телефон (participant или employee) -->
                                        <td class="px-4 py-3 align-top">
            <span v-if="p.phone_number">
              {{ formatPhoneNumber(p.phone_number) }}
            </span>
                                            <span v-else class="text-gray-500 italic">---- </span>
                                        </td>

                                        <!-- Комментарий -->
                                        <td class="px-4 py-3 align-top">
                                            <span v-if="p.comment">{{ p.comment }}</span>
                                            <span v-else class="text-gray-500 italic">---- </span>
                                        </td>

                                        <!-- Действия -->
                                        <td class="px-4 py-3 align-top">
                                            <Button
                                                v-if="canEditParticipants"
                                                :disabled="!canEditParticipants"
                                                icon="pi pi-trash"
                                                rounded
                                                outlined
                                                severity="danger"
                                                size="small"
                                                @click="fetchDeleteParticipant(p)"
                                            />
                                        </td>
                                    </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>


                        <!-- Место события -->


                        <!-- Ручной ввод локации -->
                        <div
                            v-if="locationTypeFullPath === 'Место происшествия указано вручную'"
                            class="mb-4"
                        >
                            <label class="block font-bold mb-2" for="manualLocation">
                                Место события, описанное пользователем:
                            </label>
                            <textarea
                                id="manualLocation"
                                v-model="manualLocation"
                                class="w-full p-2 rounded resize-none transition border-2 outline-none"
                                :class="
                                    isEditingManualLocation
                                        ? 'border-[var(--primary-color)] bg-[var(--surface-card)] text-[var(--text-color)]'
                                        : 'border-[var(--surface-border)] bg-[var(--surface-card)] text-[var(--text-color-secondary)] cursor-not-allowed'
                                "
                                :readonly="!canEditFormGeneral || !isEditingManualLocation"
                                :disabled="!canEditFormGeneral || !isEditingManualLocation"
                                rows="4"
                            />
                            <Button
                                class="mt-2"
                                :label="isEditingManualLocation ? 'Сохранить' : 'Редактировать'"
                                :icon="isEditingManualLocation ? 'pi pi-check' : 'pi pi-pencil'"
                                :severity="isEditingManualLocation ? 'success' : 'info'"
                                @click="
                                    !isViewMode &&
                                    (isEditingManualLocation
                                        ? onSaveManualLocation()
                                        : onEditManualLocation())
                                "
                                :disabled="isCompleted || isInspector"
                                v-if="canEditFormGeneral"
                            />
                        </div>

                        <!-- Краткое описание и причины (было во вкладке "Описание") -->
                        <div class="flex flex-col gap-4 w-full">
                            <label class="block font-bold label-required"
                                >Краткое описание</label
                            >
                            <Textarea
                                id="description"
                                v-model="currentAdverseEvent.description"
                                rows="3"
                                fluid
                                :class="[
                                    'w-full',
                                    fieldValidation.adverseEventValidation.description
                                        ? 'field-error'
                                        : '',
                                    { 'invalid-by-server': serverErrors?.description },
                                ]"
                                :readonly="!canEditFormGeneral"
                                :disabled="!canEditFormGeneral"
                            />
                            <Message v-if="serverErrors?.description" severity="error" class="mt-2">
                                <ul class="my-0 flex flex-col gap-1">
                                    <li
                                        v-for="(error, index) of serverErrors?.description"
                                        :key="index"
                                    >
                                        {{ error }}
                                    </li>
                                </ul>
                            </Message>

                            <div class="flex flex-col gap-4 w-full">
                                <label class="block font-bold">Принятые меры</label>
                                <Textarea
                                    id="cause-textarea"
                                    ref="causeTextareaRef"
                                    v-model="currentAdverseEvent.corrective_measures"
                                    rows="3"
                                    fluid
                                    :class="[
                                        { 'invalid-by-server': serverErrors?.corrective_measures },
                                    ]"
                                    :readonly="!canEditFormGeneral"
                                    :disabled="!canEditFormGeneral"
                                />
                            </div>
                        </div>

                        <!-- [NEW] Файлы НС -->
                        <div class="adverse-form__files">
                            <file-list
                                v-if="existingAdverseFiles.length"
                                class="adverse-form__files-existing"
                                :items="existingAdverseFiles"
                                :disabled="!isFileUploadEnabled"
                                @remove="onExistingFileRemove"
                            />

                            <file-attach
                                :files="adverseFiles"
                                @update:files="onFilesUpdate"
                                :disabled="!isFileUploadEnabled"
                                :accept="'*'"
                            />
                        </div>
                    </TabPanel>

                    <!-- Вкладка "Участники" -->
                    <TabPanel :value="1" header="Участники">
                        <!-- Участники события -->
                        <div class="grid grid-cols-12 mb-5">
                            <div class="flex justify-between items-center col-span-full">
                                <p class="font-bold">Участники события</p>
                                <SplitButton
                                    id="participantsSplit"
                                    v-if="canEditParticipants"
                                    :disabled="!canEditParticipants"
                                    label="Выберите участника"
                                    :model="createTableActionButtons()"
                                    @click="handleMainButtonClick"
                                />
                            </div>
                            <div class="col-span-full mt-3">
                                <div
                                    v-if="currentAdverseEvent?.participants?.length"
                                    class="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm"
                                >
                                    <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                        <thead class="bg-gray-50 dark:bg-gray-800/60">
                                        <tr class="text-left text-sm font-semibold text-gray-700 dark:text-gray-200">
                                            <th class="px-4 py-3">Тип участника</th>
                                            <th class="px-4 py-3">ФИО</th>
                                            <th class="px-4 py-3">Номер телефона</th>
                                            <th class="px-4 py-3">Комментарий</th>
                                            <!-- как у тебя: колонка заголовка всегда есть -->
                                            <th v-if="canEditParticipants" class="px-4 py-3 w-1">Действия</th>
                                        </tr>
                                        </thead>

                                        <tbody class="divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                                        <tr
                                            v-for="data in currentAdverseEvent.participants"
                                            :key="data.key || data.employee_id || data.full_name || data.comment || 'row'"
                                            class="odd:bg-white even:bg-gray-50/50 dark:odd:bg-gray-900 dark:even:bg-gray-900/60 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                        >
                                            <!-- Тип участника -->
                                            <td class="px-4 py-3 align-top">
                                                {{
                                                    data?.participant_type
                                                        ? apiStore.participantTypes[data.participant_type] || data.participant_type
                                                        : ''
                                                }}
                                            </td>

                                            <!-- ФИО + ДР для patient/visitor -->
                                            <td class="px-4 py-3 align-top">
                                                <div class="flex flex-col">
                                                    <template v-if="data.participant_type === 'other'">
                                                        <span class="text-gray-500 italic"> ---- </span>
                                                    </template>
                                                    <template v-else>
                                                        <span>{{ data.full_name }}</span>
                                                    </template>
                                                    <span
                                                        v-if="(data.participant_type === 'patient' || data.participant_type === 'visitor') && data.birth_date"
                                                        class="text-xs text-gray-500"
                                                    >
                    {{ formatDateOnly(data.birth_date) }}
                  </span>
                                                </div>
                                            </td>

                                            <!-- Телефон  -->
                                            <td class="px-4 py-3 align-top">
                                                <div class="flex flex-col">
                                                    <template v-if="data.participant_type === 'other'">
                                                        <span class="text-gray-500 italic"> ---- </span>
                                                    </template>
                                                    <template v-else>
                                                        {{
                                                            data.phone_number  ? formatPhoneNumber(String(data.phone_number))
                                                                : ''
                                                        }}
                                                    </template>
                                                </div>
                                            </td>

                                            <!-- Комментарий -->
                                            <td class="px-4 py-3 align-top">
                                                <template v-if="data.participant_type === 'other' && data.comment">
                                                    <span class="font-semibold">{{ data.comment }}</span>
                                                </template>
                                                <template v-else>
                                                    {{ data.comment }}
                                                </template>
                                            </td>

                                            <!-- Действия: как у тебя — кнопка рендерится только если можно редактировать -->
                                            <td class="px-4 py-3 align-top">
                                                <Button
                                                    v-if="canEditParticipants"
                                                    :disabled="!canEditParticipants"
                                                    icon="pi pi-trash"
                                                    rounded
                                                    outlined
                                                    severity="danger"
                                                    size="small"
                                                    @click="fetchDeleteParticipant(data)"
                                                />
                                            </td>
                                        </tr>
                                        </tbody>
                                    </table>
                                </div>

                                <div v-else class="italic text-center">
                                    Участники события не указаны
                                </div>
                            </div>
                        </div>
                    </TabPanel>

                    <TabPanel :value="2" header="Координатор НС">
                        <!-- Текущий Координатор -->
                        <div class="block font-bold mb-3">
                            <!-- Координатор -->
                            <span class="text-sm text-surface-600 dark:text-surface-300"
                                >Текущий координатор -
                            </span>
                            <span>{{
                                currentAdverseEvent.coordinator
                                    ? getFullName(currentAdverseEvent.coordinator)
                                    : 'Не назначен'
                            }}</span>

                            <div class="col-span-12 md:col-span-6">
                                <label class="block font-bold mb-3" for="employee_to"></label>
                                <Button
                                    :label="coordinatorLabel"
                                    variant="link"
                                    class="!pl-0"
                                    @click="showEmployeeModal = true"
                                    :disabled="!canEditCoordinatorAssign"
                                />
                            </div>
                        </div>

                        <!-- Вероятность и последствия -->
                        <div class="grid grid-cols-12 gap-4">
                            <div class="col-span-12 md:col-span-6">
                                <label class="block font-bold mb-3">Вероятность</label>
                                <Select
                                    v-model="currentAdverseEvent.probability"
                                    :options="adverseEventProbability"
                                    fluid
                                    valueType="number"
                                    option-label="label"
                                    option-value="value"
                                    placeholder="Оценить вероятность"
                                    option-disabled="disabled"
                                    showClear
                                    :class="[{ 'invalid-by-server': serverErrors?.probability }]"
                                    :disabled="!canEditCoordinatorAssign"
                                />
                                <Message
                                    v-if="serverErrors?.probability"
                                    severity="error"
                                    class="mt-2"
                                >
                                    <ul class="my-0 flex flex-col gap-1">
                                        <li
                                            v-for="(error, index) of serverErrors?.probability"
                                            :key="index"
                                        >
                                            {{ error }}
                                        </li>
                                    </ul>
                                </Message>
                            </div>
                            <div class="col-span-12 md:col-span-6">
                                <label class="block font-bold mb-3">Последствия</label>
                                <Select
                                    v-model="currentAdverseEvent.consequence"
                                    :options="adverseEventConsequences"
                                    valueType="number"
                                    fluid
                                    option-label="label"
                                    option-value="value"
                                    option-disabled="disabled"
                                    placeholder="Оценить последствия"
                                    showClear
                                    :class="[{ 'invalid-by-server': serverErrors?.consequence }]"
                                    :disabled="!canEditCoordinatorAssign"
                                />
                                <Message
                                    v-if="serverErrors?.consequence"
                                    severity="error"
                                    class="mt-2"
                                >
                                    <ul class="my-0 flex flex-col gap-1">
                                        <li
                                            v-for="(error, index) of serverErrors?.consequence"
                                            :key="index"
                                        >
                                            {{ error }}
                                        </li>
                                    </ul>
                                </Message>
                            </div>
                        </div>

                        <!-- Исполнители -->
                        <div class="mt-4 w-full">
                            <ResponsibilityEntries
                                :disabled="!canEditCoordinatorAssign"
                                :entries="currentAdverseEvent.responsibility_entries || []"
                                @entry-added="onFormSubmit"
                                :is-active="Number(formTabValue) === 2"
                                :can-return="canReturn"
                            />
                        </div>
                    </TabPanel>

                    <TabPanel :value="3" header="Исполнитель">
                        <performer-task
                            v-for="(t, i) in currentAdverseEvent.responsibility_entries || []"
                            :key="i"
                            :event-id="Number(route.params.id)"
                            :entry-id="t.id as number"
                            :supervisor="t.supervisor || null"
                            :instructions="t.instructions || ''"
                            :deadline="t.deadline_time"
                            :existing-report="t.completion_report || ''"
                            :can-complete="t.can_complete"
                            :can-take="t.can_take_in_progress"
                            :status="t.status"
                            :responsible-employee="t.responsible_employee"
                        />
                    </TabPanel>
                </TabPanels>
            </Tabs>

            <!-- Кнопки действий формы -->
            <div class="flex justify-end gap-3">
                <Button
                    text
                    :label="isViewMode ? 'Закрыть' : 'Отмена'"
                    icon="pi pi-times"
                    @click="onDialogVisibleChange(false)"
                    :disabled="loadingOnConfirmModal"
                />
                <Button
                    v-if="canSave"
                    :label="modalSaveButtonText"
                    icon="pi pi-check"
                    type="submit"
                    :loading="loadingOnConfirmModal"
                />
            </div>

            <div
                class="hidden md:flex items-center gap-2 ml-4 text-sm text-surface-600 dark:text-surface-300"
            >
                <template v-if="!route.params.id">
                    <!-- Режим создания - показываем текущего пользователя -->
                    <span>Создатель НС - </span>
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
                                @click.prevent="openChat(currentAdverseEvent.created_by?.id)"
                            >
                            <span>Создатель НС - </span>
                            <span>{{ getFullName(currentAdverseEvent.created_by ?? {}) }}</span>
                            <i class="pi pi-building"></i>
                            <span>{{
                                currentAdverseEvent.created_by?.department?.name ||
                                'Подразделение не указано'
                            }}</span>
                            </div>
                            <i class="pi pi-clock text-xs"></i>
                            <span class="cursor-default" title="Дата создания НС">{{  formatResponsibilityDate(currentAdverseEvent?.created_at) || 'Не удалось определить дату создания НС' }}</span>
                        </div>
                        <div
                            class="md:flex items-center gap-2 ml-4 text-sm text-surface-600 dark:text-surface-300 cursor-pointer 2222"
                            @click.prevent="openChat(currentAdverseEvent.coordinator?.id)"
                        >
                            <!-- Координатор -->
                            <span>Координатор НС - </span>
                            <span>{{
                                currentAdverseEvent.coordinator
                                    ? getFullName(currentAdverseEvent.coordinator)
                                    : 'Координатор не назначен'
                            }}</span>
                            <i class="pi pi-building"></i>
                            <span>{{
                                currentAdverseEvent.coordinator?.department?.name ||
                                'Подразделение не указано'
                            }}</span>
                        </div>
                    </div>
                </template>
            </div>
        </Form>
    </Dialog>

    <!-- Модалки -->
    <RoomModal
        v-model:visible="locationTypeModal"
        @closeModal="locationTypeModal = false"
        :disabled="isViewMode"
        targetStore="apiStore"
    />
    <EmployeeSelectionModal
        :type="employeeSelectionModalType"
        target="participants"
        v-model:visible="employeeSelectionModalRef"
        @closeModal="employeeSelectionModalRef = false"
        :disabled="isViewMode"
    />
    <EmployeeSelectionModal
        v-model:visible="showEmployeeModal"
        target="adverse"
        @employee-selected="onEmployeeSelected"
    />
    <PatientModal
        v-model:visible="patientOrGuestModal"
        :eventParticipantType="eventParticipantType"
        @closeModal="patientOrGuestModal = false"
        :disabled="isViewMode"
    />
    <CommentModal
        v-model:visible="commentModal"
        @closeModal="commentModal = false"
        :disabled="isViewMode"
    />
</template>

<style lang="scss" scoped>
/* Основные стили формы */
.p-dialog-title {
    font-weight: var(--p-dialog-title-font-weight);
    font-size: var(--p-dialog-title-font-size);
}

// Стили для обязательных полей
.label-required {
    position: relative;
    &::after {
        content: '*';
        color: #ff5252;
        margin-left: 4px;
        font-size: 18px;
        font-weight: bold;
        vertical-align: super;
    }
}

// Таб с ошибкой
.tab-error {
    border: 1px solid #ff5252 !important;
    border-radius: 6px;
}

// Текст ошибки
.field-error-text {
    color: #ff5252 !important;
}

.cause-panel {
    cursor: pointer;
}

.field-error {
    border: 1px solid #ff5252 !important;
}

.p-datepicker.field-error,
.p-datepicker .p-inputtext.field-error {
    border: 1px solid #ff5252 !important;
    box-shadow: none !important;
}

.force-focus-visible {
    outline: var(--p-button-focus-ring-width) var(--p-button-focus-ring-style)
        var(--p-button-primary-focus-ring-color) !important;
}
</style>

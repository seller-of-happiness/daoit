<script setup lang="ts">
/*
 * Компонент формы создания/редактирования заявки во вспомогательные службы
 *
 * Основные функции:
 * - Создание новой заявки
 * - Редактирование существующей заявки
 * - Валидация вводимых данных
 * - Управление структурой данных заявки (группы, категории, местоположение)
 *
 * Особенности:
 * - Работает в двух режимах (просмотр и редактирование)
 * - Интегрируется с древовидным выбором категорий
 * - Поддерживает сложную валидацию взаимосвязанных полей
 * - Логирует ошибки при работе с API
 *
 * Используемые хранилища:
 * - supportServiceStore: управление данными заявок
 * - apiStore: доступ к данным сотрудников и структуре зданий
 * - feedbackStore: управление состоянием UI
 *
 * Подключенные компоненты:
 * - FilterTreeSelect: выбор группы/категории
 * - RoomModal: выбор местоположения
 * - EmployeeSelectionModal: выбор ответственного
 */

// Импорты Vue и сторонних библиотек
import { ref, computed, onMounted, watch, nextTick, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'

// Импорты хранилищ
import { useSupportService } from '@/refactoring/modules/supportService/stores/supportService'
import { useApiStore } from '@/refactoring/modules/apiStore/stores/apiStore'
import { useFeedbackStore } from '@/refactoring/modules/feedback/stores/feedbackStore'
import { useUserStore } from '@/refactoring/modules/user/stores/userStore'
import { useFilesStore } from '@/refactoring/modules/files/stores/filesStore'

// Импорты утилит и компонентов
import { getLocationPath } from '@/refactoring/utils/locationUtils'
import { useGlobalConfirm } from '@/refactoring/modules/feedback/utils/useGlobalConfirm'
import { formatResponsibilityDate, getFullName } from '@/refactoring/utils/formatters'
import { openChat } from '@/refactoring/utils/openChat'
import FilterTreeSelect from '@/components/tableFilters/FilterTreeSelect.vue'
import RoomModal from '@/components/adverseEvents/RoomModal.vue'
import FileAttach from '@/refactoring/modules/files/components/FileAttach.vue'

// Импорты типов
import type { IVModelTreeSelect } from '@/refactoring/types/IVModelTreeSelect'
import type { IValidationErrors } from '@/refactoring/modules/supportService/types/IValidationErrors'
import type { IExistingFile } from '@/refactoring/modules/files/types/IExistingFile'
import FileList from '@/refactoring/modules/files/components/FileList.vue'

// Инициализация роутера
const route = useRoute()

// Инициализация хранилищ
const supportServiceStore = useSupportService()
const apiStore = useApiStore()
const userStore = useUserStore()
const feedbackStore = useFeedbackStore()
const filesStore = useFilesStore()

// Деструктуризация значений из хранилищ
const { priority, supportServiceGroups, currentSupportService } = storeToRefs(supportServiceStore)
const { departments, hospitalSkeleton } = storeToRefs(apiStore)

// Реактивные переменные состояния
const confirmAction = useGlobalConfirm()
const createOrUpdatePopup = ref(true) // Видимость модального окна формы
const locationTypeModal = ref(false) // Видимость модалки выбора местоположения
const formTabValue = ref<number>(0) // Активная вкладка формы (в данном компоненте всегда 0)
const primeTreeModal = ref<Record<string, boolean>>({}) // Состояние выбранных элементов в древовидном селекторе
const isCausePanelCollapsed = ref(true) // Состояние панели "Описание" (свернута/развернута)
const isViewMode = ref(true) // Заменяем isViewMode вычисляемое свойство на реактивную переменную
const treeSelect = ref() // Ссылка на компонент TreeSelect
const manualLocation = ref('') // Ручной ввод локации
const isEditingManualLocation = ref(false) // Режим редактирования ручного ввода локации
const isFileUploadEnabled = computed(() => !isViewMode.value) // кнопка загрузки неактивна только в режиме просмотра
const supportFiles = ref<File[]>([]) //  новые прикрепляемые файлы
const removedFileIds = ref<number[]>([]) //  id существующих файлов к удалению


/**
 * Назначение:
 * - Синхронизирует прикреплённые файлы заявки с сервером после сохранения/обновления.
 *
 * Алгоритм:
 * 1. Проверяет, есть ли новые файлы (supportFiles.value) и/или файлы на удаление (removedFileIds.value).
 * 2. Если нет ни новых, ни удалённых — выходим.
 * 3. Если есть новые — вызывает filesStore.uploadSupportServiceFiles(...).
 * 4. Если есть удалённые — для каждого вызывает filesStore.deleteSupportServiceFile(...).
 * 5. Все задачи запускаются параллельно через Promise.allSettled (чтобы ошибки не роняли форму).
 * 6. После завершения — очищает локальные состояния (supportFiles, removedFileIds).
 * 7. Пытается обновить данные заявки через supportServiceStore.fetchSupportServiceById(...).
 *
 * Параметры:
 * - supportId: number — id заявки для которой выполняется синхронизация.
 *
 * Возвращает:
 * - Promise<void>
 */
const syncSupportServiceFiles = async (supportId: number): Promise<void> => {
    const hasNew = Array.isArray(supportFiles.value) && supportFiles.value.length > 0
    const hasDel = Array.isArray(removedFileIds.value) && removedFileIds.value.length > 0
    if (!hasNew && !hasDel) return

    const tasks: Promise<any>[] = []

    if (hasNew) {
        tasks.push(
            filesStore.uploadSupportServiceFiles(supportId, supportFiles.value, 'update')
        )
    }
    if (hasDel) {
        for (const fid of removedFileIds.value) {
            tasks.push(filesStore.deleteSupportServiceFile(supportId, fid))
        }
    }

    // не даём исключениям сорвать закрытие формы
    await Promise.allSettled(tasks)

    // чистим локальные состояния в любом случае
    supportFiles.value = []
    removedFileIds.value = []

    // обновим данные заявки; тоже не роняем форму
    try { await supportServiceStore.fetchSupportServiceById({ id: supportId }) } catch {}
}

/**
 * Назначение:
 * - Возвращает список уже прикреплённых файлов текущей заявки из currentSupportService.
 *
 * Источник:
 * - currentSupportService.value.files
 *
 * Возвращает:
 * - IExistingFile[] — массив файлов (или [] если файлов нет).
 */
const existingFiles = computed<IExistingFile[]>(() => (currentSupportService.value as any)?.files ?? [])

/**
 * Флаг для предотвращения рекурсивных вызовов при управлении видимостью диалога
 */
let guard = false

/**
 * Переключение режима редактирования ручной локации
 */
function onEditManualLocation() {
    manualLocation.value = currentSupportService.value.location ?? ''
    isEditingManualLocation.value = true
}

/**
 * Сохранение ручной локации
 */
function onSaveManualLocation() {
    currentSupportService.value.location = manualLocation.value.trim()
    isEditingManualLocation.value = false
}

// Всегда показываем актуальное значение location (если оно есть)
watch(
    () => currentSupportService.value.location,
    (val) => {
        if (!isEditingManualLocation.value) {
            manualLocation.value = val ?? ''
        }
    },
    { immediate: true },
)

/**
 * Текст кнопки сохранения в зависимости от режима
 */
const modalSaveButtonText = computed<string>(() => {
    return route.params.id ? 'Сохранить изменения' : 'Создать заявку'
})

// Ошибки валидации формы
const validationErrors = ref<IValidationErrors>({
    serviceGroup: false,
    serviceCategory: false,
    location: false,
})

/**
 * Формирует сообщение об ошибках валидации
 * @returns {string} Строка с перечислением ошибок
 */
const getValidationMessage = (): string => {
    const errors = []

    if (validationErrors.value.serviceGroup) errors.push('не выбрана служба')
    if (validationErrors.value.serviceCategory) errors.push('не выбрана категория')
    if (validationErrors.value.location) errors.push('не указано помещение')

    return `Заполните обязательные поля: ${errors.join(', ')}`
}

/**
 * Валидирует данные формы перед отправкой
 * @returns {boolean} true если валидация пройдена, false если есть ошибки
 */
const validate = (): boolean => {
    // Сбрасываем ошибки
    validationErrors.value = {
        serviceGroup: false,
        serviceCategory: false,
        location: false,
    }

    let isValid = true

    // Валидация группы
    if (!currentSupportService.value.service_group?.id) {
        validationErrors.value.serviceGroup = true
        isValid = false
    } else {
        // Валидация категории (если у группы есть категории)
        const selectedGroup = supportServiceGroups.value.find(
            (g) => g.id === currentSupportService.value.service_group?.id,
        )
        if (
            selectedGroup?.service_categories?.length &&
            !currentSupportService.value.service_category?.id
        ) {
            validationErrors.value.serviceCategory = true
            isValid = false
        }
    }

    // Валидация локации
    // Если ручной ввод (location) — блок/этаж/комната НЕ нужны
    if (
        !currentSupportService.value.location &&
        !currentSupportService.value.block?.id &&
        !currentSupportService.value.floor?.id &&
        !currentSupportService.value.room?.id
    ) {
        validationErrors.value.location = true
        isValid = false
    }

    return isValid
}

/**
 * Обновляет состояние древовидного выбора при загрузке данных
 */
const updatePrimeTreeModal = () => {
    const { service_group, service_category } = currentSupportService.value
    if (service_group?.id) {
        primeTreeModal.value = service_category?.id
            ? { [`${service_group.id}-${service_category.id}`]: true }
            : { [`g-${service_group.id}`]: true }
    } else {
        primeTreeModal.value = {}
    }
}

/**
 * Формирует дерево групп и категорий для отображения в селекторе
 * @returns {Array} Массив с древовидной структурой групп и категорий
 */
const categoryGroupTree = computed(() => {
    return supportServiceGroups.value.map((group) => ({
        key: `g-${group.id}`,
        label: group.name,
        data: { name: group.name, position: 1, selfId: String(group.id) },
        icon: 'pi pi-users',
        children: (group.service_categories || []).map((category) => ({
            key: `${group.id}-${category.id}`,
            label: category.name,
            data: { name: category.name, position: 2, selfId: String(category.id) },
            icon: 'pi pi-tag',
            children: [],
        })),
    }))
})

/**
 * Обрабатывает выбор элемента в древовидном селекторе
 * @param {IVModelTreeSelect | null} select - Выбранные элементы
 */
const onChangeTreeSelectModal = (select: IVModelTreeSelect | null) => {
    // Сбрасываем текущий выбор
    currentSupportService.value.service_group = { id: 0 }
    currentSupportService.value.service_category = { id: 0 }

    if (!select || Object.keys(select).length === 0) {
        primeTreeModal.value = {}
        return
    }

    const key = Object.keys(select)[0]

    if (key.startsWith('g-')) {
        const groupId = Number(key.replace('g-', ''))
        currentSupportService.value.service_group = { id: groupId }
        primeTreeModal.value = { [key]: true }
    } else {
        const [groupId, categoryId] = key.split('-')
        currentSupportService.value.service_group = { id: Number(groupId) }
        currentSupportService.value.service_category = { id: Number(categoryId) }
        primeTreeModal.value = { [key]: true }
    }

    setTimeout(() => moveFocusTo('location'), 50)
}

/**
 * Вычисляет человекочитаемый путь местоположения из currentSupportService
 * с использованием hospitalSkeleton.
 *
 * Использует утилиту getLocationPath, которая:
 * - возвращает "Описано вручную", если указано поле location
 * - возвращает null, если данные неполные или hospitalSkeleton пуст
 * - формирует путь: [больница, корпус, этаж, помещение] по доступным id
 */
const locationTypeFullPath = computed(() => {
    return getLocationPath(
        {
            location: currentSupportService.value.location,
            block: currentSupportService.value.block,
            floor: currentSupportService.value.floor,
            room: currentSupportService.value.room,
        },
        hospitalSkeleton.value,
        {
            manualText: 'Описано вручную',
            includeHospital: true,
        },
    )
})

/**
 * Назначение:
 * - Отправляет данные формы заявки на сервер (создание или обновление).
 * - Управляет валидацией, загрузкой файлов и обновлением интерфейса.
 *
 * Алгоритм:
 * 1. Извлекает id заявки из route.params.
 * 2. Валидирует форму (validate()):
 *    • При ошибках — показывает Toast через feedbackStore.showToast и выходит.
 * 3. Если id есть (режим редактирования):
 *    • Вызывает supportServiceStore.updateSupportService(id, currentSupportService.value).
 *    • Синхронизирует файлы через syncSupportServiceFiles(id).
 * 4. Если id отсутствует (режим создания):
 *    • Вызывает supportServiceStore.createSupportService(...).
 *    • После создания синхронизирует файлы через syncSupportServiceFiles(created.id).
 * 5. Закрывает модалку (createOrUpdatePopup.value = false).
 * 6. Переходит на родительский маршрут через feedbackStore.goToParentRoute().
 *
 * Возвращает:
 * - Promise<void>
 */
const onFormSubmit = async () => {
    const id = Number(route.params.id)
    if (!validate()) {
        feedbackStore.showToast({
            type: 'error',
            title: 'Ошибка валидации',
            message: getValidationMessage(),
            time: 7000,
        })
        return
    }

    try {
        if (id) {
            await supportServiceStore.updateSupportService(
                Number(route.params.id),
                currentSupportService.value,
            )
            await syncSupportServiceFiles(id)
        } else {
            const created = await supportServiceStore.createSupportService(currentSupportService.value)
            await syncSupportServiceFiles(created.id)
        }
        createOrUpdatePopup.value = false
        await feedbackStore.goToParentRoute()
    } catch (error) {

    }
}


/**
 * Обрабатывает клик по заголовку панели:
 * - В режиме просмотра → игнорирует
 * - В режиме редактирования → переключает свёрнутое состояние
 * - При развёртывании → фокусирует поле ввода
 */
function onPanelHeaderClick() {
    if (isViewMode.value) return

    const willOpen = isCausePanelCollapsed.value
    isCausePanelCollapsed.value = !isCausePanelCollapsed.value

    if (willOpen) {
        nextTick(focusCauseTextarea)
    }
}

/**
 * Контролирует состояние панели описания по правилам:
 * - Просмотр: всегда развернута
 * - Редактирование:
 *   - Развернута, если есть текст
 *   - Свернута, если текст пустой
 * - Создание: всегда свернута (по умолчанию)
 */
watch(
    [isViewMode, () => currentSupportService.value.description],
    ([isView, description]) => {
        if (isView) {
            // Режим просмотра - всегда развернуто
            isCausePanelCollapsed.value = false
        } else {
            // Режим редактирования/создания
            isCausePanelCollapsed.value = !description?.trim()
        }
    },
    { immediate: true },
)

// ───────────────────────────────────────────────────────────────────────────────
// Поиск/подсветка отдела
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Локальная строка фильтра для Dropdown "Отдел".
 * Используется ТОЛЬКО для подсветки совпадений в шаблоне option.
 */
const departmentFilter = ref('')

/**
 * Подсвечивает совпадения текста label с поисковой строкой search.
 *
 * Назначение:
 * - Безопасно экранирует спецсимволы search (чтобы не ломать RegExp)
 * - Оборачивает найденные фрагменты в <mark>…</mark>
 *
 * Алгоритм:
 * 1) Если search пустой — вернуть label без изменений.
 * 2) Экранировать все спецсимволы в search.
 * 3) Выполнить замену по регистронезависимому шаблону.
 *
 * Параметры:
 * @param {string} label  — исходный текст опции.
 * @param {string} search — текст фильтра (из departmentFilter).
 *
 * Возвращает:
 * @returns {string} HTML-строку, где совпадения обёрнуты в <mark>.
 */
const highlightDepartmentMatch = (label: string, search: string) => {
    if (!search) return label
    const safe = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return (label ?? '').replace(new RegExp(`(${safe})`, 'ig'), '<mark>$1</mark>')
}

/**
 * Хендлер смены отдела.
 *
 * Назначение:
 * - Ничего не меняет в данных. Только переносит фокус на поле "Служба/категория".
 *
 * Особенности:
 * - Небольшая задержка (50ms) нужна, чтобы дать завершить внутренние
 *   апдейты Dropdown перед программной установкой фокуса.
 *
 * Возвращает: ничего.
 */
const onDepartmentChange = () => {
    setTimeout(() => {
        moveFocusTo('service_category')
    }, 50)
}

// ───────────────────────────────────────────────────────────────────────────────
// Фокус-менеджмент
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Допустимые ключи для перемещения фокуса по форме.
 */
type FocusField = 'department' | 'service_category' | 'location' | 'priority'

/**
 * Текущее «целевое» поле фокуса. Используется для отладки и условной логики.
 */
const currentFocus = ref<FocusField | null>(null)

/**
 * Наблюдатель для отслеживания появления кнопки закрытия PrimeVue Dialog в DOM.
 * Нужен, потому что PrimeVue динамически монтирует/размонтирует кнопку-крестик.
 */
let observer: MutationObserver | null = null

/**
 * CSS-класс кнопки закрытия диалога PrimeVue.
 */
const closeButtonClass = 'p-dialog-close-button'

/**
 * Ссылки на элементы управления (если доступны из шаблона через ref).
 * Используются как предпочтительный способ фокусировки вместо прямого поиска по DOM.
 */
const departmentDropdown = ref<any>(null)
const prioritySelectRef = ref<any>(null)
const locationButtonRef = ref<any>(null)

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
    const input = root.querySelector('input.p-select-filter') as HTMLInputElement | null
    if (input && !deptBoundInputs.has(input)) {
        deptBoundInputs.add(input)
        setTimeout(() => { input.focus(); input.select?.() }, 0)
        input.addEventListener('input', (e: Event) => {
            departmentFilter.value = (e.target as HTMLInputElement).value || ''
        }, { passive: true })
    }
}

/**
 * Перехват фокуса на крестике диалога PrimeVue.
 *
 * Назначение:
 * - Когда фокус попадает на кнопку закрытия (крестик),
 *   принудительно переводим его на «первичный» контрол
 *
 * Алгоритм:
 * 1) Вешаем обработчик focus на элемент с классом .p-dialog-close-button.
 * 2) При срабатывании — через 10ms ищем поле подразделение:
 * 3) Ставим фокус, добавляем визуальный класс фокуса, снимаем класс при blur.
 *
 * Особенности:
 * - MutationObserver подписывается на body и в момент появления кнопки
 *   навешивает обработчик ещё раз (на случай пере-монтажа).
 *
 * Возвращает: ничего.
 */
const watchCloseButtonFocus = () => {
    const handleFocus = (event: Event) => {
        const target = event.target as HTMLElement | null
        if (!target || !target.classList.contains(closeButtonClass)) return

        setTimeout(() => {
            const root =
                (departmentDropdown.value?.$el as HTMLElement | null) ??
                document.getElementById('department')

            if (!root) return
            const combo = root.querySelector('[role="combobox"]') as HTMLElement | null
            if (!combo) return

            combo.focus()

            // визуальная подсветка фокуса на контейнере
            root.classList.add('force-focus-visible')
            const onBlur = () => {
                root.classList.remove('force-focus-visible')
                combo.removeEventListener('blur', onBlur as EventListener)
            }
            combo.addEventListener('blur', onBlur as EventListener, { once: true })
        }, 10)
    }

    // навешиваем хендлер на все текущие крестики
    const attach = () => {
        const btns = document.querySelectorAll(`.${closeButtonClass}`)
        btns.forEach((btn) => {
            btn.removeEventListener('focus', handleFocus as EventListener)
            btn.addEventListener('focus', handleFocus as EventListener)
        })
    }

    // первичное навешивание
    attach()

    // наблюдаем DOM и перевешиваем при перемонтаже кнопки
    observer?.disconnect()
    observer = new MutationObserver(() => attach())
    observer.observe(document.body, { subtree: true, childList: true })
}

/**
 * Программно переносит фокус на указанный контрол формы.
 *
 * Назначение:
 * - Унифицированный способ навигации по ключевым полям без прямого доступа к DOM вне функции.
 *
 * Алгоритм:
 * 1) Сохраняем целевой ключ в currentFocus (для отладки).
 * 2) В nextTick определяем нужный контейнер/элемент:
 *    - 'department'     → Dropdown: фокус в элемент с role="combobox".
 *    - 'service_category' → TreeSelect: фокус в input[role="combobox"] внутри #service_category.
 *    - 'location'       → кнопка (ref или #location/_button), с автопереносом на 'priority',
 *                          если модалка локации не открылась.
 *    - 'priority'       → Dropdown: фокус в [role="combobox"] или .p-dropdown-label.
 *
 * Особенности:
 * - Для кнопок добавляется/снимается класс 'force-focus-visible' на время фокуса.
 * - Для поля 'location' дополнительно дожидаемся blur и, если модалка не открыта,
 *   переносим фокус на 'priority' через небольшой таймер.
 *
 * Параметры:
 * @param {FocusField} field — ключ целевого поля.
 *
 * Возвращает: ничего.
 */
const moveFocusTo = (field: FocusField) => {
    currentFocus.value = field

    nextTick(() => {
        // 2. Подразделение (Dropdown)
        if (field === 'department') {
            const dropdown = departmentDropdown.value?.$el as HTMLElement | undefined
            if (dropdown) {
                const combobox = dropdown.querySelector('[role="combobox"]') as HTMLElement | null
                combobox?.focus()
            }
            return
        }

        // 3. Служба/категория (TreeSelect)
        if (field === 'service_category') {
            const root = document.getElementById('service_category') as HTMLElement | null
            if (!root) return

            const combo = root.querySelector('input[role="combobox"]') as HTMLElement | null
            combo?.focus()
            return
        }

        // 4. Помещение (кнопка)
        if (field === 'location') {
            const el =
                locationButtonRef.value?.$el ||
                document.getElementById('location') ||
                document.getElementById('location_button')
            if (el) {
                el.focus()
                el.classList.add('force-focus-visible')
                const removeFocus = () => {
                    el.classList.remove('force-focus-visible')
                    el.removeEventListener('blur', removeFocus)
                }
                el.addEventListener('blur', removeFocus)

                el.addEventListener(
                    'blur',
                    () => {
                        if (!locationTypeModal.value) {
                            window.setTimeout(() => {
                                const activeElement = document.activeElement
                                const priorityElement = document.getElementById('priority')

                                if (
                                    !activeElement ||
                                    (activeElement !== priorityElement &&
                                        !activeElement.closest('#priority'))
                                ) {
                                    moveFocusTo('priority')
                                }
                            }, 50)
                        }
                    },
                    { once: true },
                )
            }
            return
        }

        // 5. Приоритет (Dropdown)
        if (field === 'priority') {
            const dropdown = prioritySelectRef.value?.$el
            if (dropdown) {
                const combobox =
                    (dropdown.querySelector('[role="combobox"]') as HTMLElement) ||
                    (dropdown.querySelector('.p-dropdown-label') as HTMLElement)
                combobox?.focus()
            }
            return
        }
    })
}

/**
 * Переводит фокус в textarea "Причины" и ставит каретку в конец.
 */
function focusCauseTextarea() {
    const el = document.getElementById('description') as HTMLTextAreaElement | null
    if (!el) return
    el.focus({ preventScroll: true })
    try {
        el.setSelectionRange(el.value.length, el.value.length)
    } catch {}
}

/**
 * Хендлер закрытия модалки выбора помещения.
 *
 * Назначение:
 * - Скрыть модалку и после закрытия вернуть фокус на поле "Приоритет".
 *
 * Особенности:
 * - Используется задержка 100ms для корректного завершения анимации закрытия модалки,
 *   чтобы к моменту фокусировки DOM был в стабильном состоянии.
 *
 * Возвращает: ничего.
 */
const handleRoomModalClose = () => {
    locationTypeModal.value = false
    setTimeout(() => moveFocusTo('priority'), 100)
}

/**
 * Проверяет, является ли форма пустой (без пользовательских изменений)
 *
 * Проверяет основные поля формы:
 * - service_group (служба)
 * - service_category (категория)
 * - location (локация)
 * - block/floor/room (структурная локация)
 * - description (описание)
 * - priority (приоритет)
 *
 * @returns {boolean} true - если форма пустая, false - если есть заполненные поля
 */
function isEmptyForm() {
    const form = currentSupportService.value
    return (
        !form.department?.id &&
        !form.service_group?.id &&
        !form.service_category?.id &&
        !form.location &&
        !form.block?.id &&
        !form.floor?.id &&
        !form.room?.id &&
        !form.description &&
        !form.priority
    )
}

/**
 * Проверяет, были ли изменения в форме по сравнению с исходными данными
 *
 * Для новой заявки (без ID) проверяет, есть ли какие-то заполненные поля.
 * Для существующей заявки сравнивает текущие данные с оригинальными из хранилища.
 *
 * @returns {boolean} true - если были изменения, false - если форма не изменялась
 */
function checkFormChanges(): boolean {
    const id = Number(route.params.id)

    // Для новой заявки проверяем, есть ли какие-то данные
    if (!id) {
        return !isEmptyForm()
    }

    // Для редактирования сравниваем с исходными данными
    const editableEvent = supportServiceStore.editableSupportService
    const current = currentSupportService.value

    if (!editableEvent) return true

    return JSON.stringify(editableEvent) !== JSON.stringify(current)
}

/**
 * Закрывает форму и сбрасывает данные
 *
 * Выполняет:
 * - Сброс текущей заявки в хранилище
 * - Переход на родительский маршрут
 */
function closeForm() {
    supportServiceStore.resetCurrentSupportService()
    feedbackStore.goToParentRoute()
}

/**
 * Обрабатывает изменение видимости диалогового окна формы
 *
 * Алгоритм работы:
 * 1. При открытии (nextVisible=true) просто показывает форму
 * 2. При попытке закрытия (nextVisible=false):
 *    - Если guard=true - выходит для предотвращения рекурсии
 *    - Устанавливает guard=true
 *    - Мгновенно возвращает форму в открытое состояние
 *    - Если изменений нет - закрывает форму
 *    - Если есть изменения - показывает подтверждение
 *    - При подтверждении закрытия - сбрасывает guard и закрывает форму
 *    - При отмене - только сбрасывает guard
 *
 * @param {boolean} nextVisible - целевое состояние видимости диалога
 * @returns {Promise<void>}
 */
const onDialogVisibleChange = async (nextVisible: boolean): Promise<void> => {
    // Открытие - просто открыть
    if (nextVisible) {
        createOrUpdatePopup.value = true
        await nextTick(() => {
            if (!isViewMode.value) moveFocusTo('department')
        })
        return
    }

    // Уже внутри перехвата - выходим
    if (guard) return
    guard = true

    createOrUpdatePopup.value = true

    // если изменений нет - закрываем сразу
    if (!checkFormChanges()) {
        guard = false
        closeForm()
        return
    }

    try {
        await confirmAction({
            message: route.params.id
                ? 'Отменить изменения заявки?'
                : 'Отменить создание новой заявки?',
            header: 'Подтвердите действие',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Да, отменить',
            rejectLabel: 'Нет, продолжить',
            acceptClass: 'p-button-secondary',
        })
        // подтвердили - закрываем
        guard = false
        closeForm()
    } catch {
        // отказались - оставляем открытым (оно уже true), просто снимаем guard
        guard = false
    }
}


/**
 * Назначение:
 * - Двусторонняя привязка (v-model) для Dropdown "Отделение".
 * - Обеспечивает запись/чтение department.id в currentSupportService.
 *
 * get:
 * - Возвращает текущий id отдела или null, если он не задан.
 *
 * set:
 * - При выборе значения — обновляет department.id.
 * - При очистке Dropdown — сбрасывает department.id в пустую строку.
 *
 * Возвращает:
 * - string | null
 */
const departmentIdModel = computed<string | null>({
    get() {
        return currentSupportService.value.department?.id ?? null
    },
    set(val) {
        if (val) {
            currentSupportService.value.department = { id: val }
        } else {
            // при очистке дропдауна
            currentSupportService.value.department = { id: '' }
        }
    },
})

/**
 * Хук жизненного цикла: onMounted
 *
 * Назначение:
 * - Инициализирует форму создания/редактирования заявки СП.
 * - При наличии ID: грузит заявку, синхронизирует TreeSelect, определяет режим (просмотр/редактирование),
 *   догружает справочники групп/категорий при необходимости.
 * - При отсутствии ID: включает режим редактирования и сбрасывает текущую заявку.
 * - Настраивает перехват фокуса (крестик диалога → Dropdown "Подразделение").
 * - После рендера настраивает MutationObserver для автофокуса и биндинга фильтра Dropdown "Подразделение".
 *
 * Последовательность:
 * 1) Берёт id из маршрута, при id — fetchSupportServiceById() и updatePrimeTreeModal().
 * 2) Выставляет isViewMode по checkEditPermission() либо снимает его при создании.
 * 3) Догружает справочники групп/категорий (если пустые).
 * 4) watchCloseButtonFocus() → перехват фокуса на контрол формы.
 * 5) nextTick() → создаёт/перезапускает deptMO и bindDepartmentFilterInput() для dropdown.
 *
 * Параметры:
 * - Нет.
 *
 * Возвращает:
 * @returns {Promise<void>}
 *
 * Побочные эффекты:
 * - Мутирует isViewMode, состояние supportServiceStore (current/filters), включает MutationObserver (deptMO).
 *
 * Зависимости:
 * - route, supportServiceStore, updatePrimeTreeModal, watchCloseButtonFocus, nextTick,
 *   departmentDropdown, deptMO (MutationObserver), bindDepartmentFilterInput.
 */
onMounted(async () => {
    const id = Number(route.params.id)

    if (id) {
        await supportServiceStore.fetchSupportServiceById({ id })
        updatePrimeTreeModal()

        // режим: просмотр/редактирование
        isViewMode.value = !supportServiceStore.checkEditPermission()

        if (!supportServiceStore.supportServiceGroups.length) {
            await supportServiceStore.fetchSupportServiceGroups()
        }
        if (!supportServiceStore.supportServiceCategories.length) {
            await supportServiceStore.fetchSupportServiceCategories()
        }
    } else {
        isViewMode.value = false
        supportServiceStore.resetCurrentSupportService()
    }

    // перехват фокуса крестика диалога → на dropdown "Подразделение"
    watchCloseButtonFocus()

    // ждём DOM
    await nextTick()

    // корень Dropdown "Подразделение" (append-to="self")
    const root =
        (departmentDropdown.value?.$el as HTMLElement | null) ??
        document.getElementById('department')

    if (root) {
        // на случай повторного монтирования
        deptMO?.disconnect()

        // следим за появлением overlay/внутреннего input.p-select-filter
        deptMO = new MutationObserver(() => bindDepartmentFilterInput())
        deptMO.observe(root, { childList: true, subtree: true })

        // первая попытка привязки (если инпут уже в DOM)
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
})
</script>

<template>
    <Dialog
        :visible="createOrUpdatePopup"
        :style="{ width: '1000px' }"
        :modal="true"
        header="Заявка во вспомогательную службу"
        class="support-service-modal"
        @update:visible="onDialogVisibleChange"
        :auto-focus="false"
    >
        <Form @submit="onFormSubmit">
            <Tabs :value="formTabValue" @update:value="(val) => (formTabValue = Number(val))">
                <TabList>
                    <Tab :value="0">Форма</Tab>
                </TabList>
                <TabPanels>
                    <TabPanel :value="0" class="flex flex-col gap-4 w-full">

                        <div class="col-span-12 md:col-span-6">
                                <label for="department" class="block font-bold mb-3"
                                    >Подразделение</label
                                >
                            <Select
                                ref="departmentDropdown"
                                append-to="self"
                                id="department"
                                v-model="departmentIdModel"
                                :options="departments"
                                placeholder="Выберите подразделение"
                                option-label="name"
                                option-value="id"
                                :disabled="isViewMode"
                                :readonly="isViewMode"
                                showClear
                                filter
                                fluid
                                @update:model-value="onDepartmentChange"
                                class="w-full"
                            >
                                <template #option="slotProps">
                                        <span
                                            v-html="
                                                highlightDepartmentMatch(
                                                    slotProps.option?.name ?? '',
                                                    departmentFilter,
                                                )
                                            "
                                        ></span>
                                </template>
                            </Select>
                            </div>


                        <div class="grid grid-cols-12 gap-4">
                            <div class="col-span-12 md:col-span-6">
                                <label class="block font-bold mb-3">Служба/категория</label>
                                <FilterTreeSelect
                                    id="service_category"
                                    ref="treeSelect"
                                    name="event_type"
                                    class="w-full"
                                    :class="{
                                        'border-red-500':
                                            validationErrors.serviceGroup ||
                                            validationErrors.serviceCategory,
                                    }"
                                    labelFor="supportServiceGroupCategory"
                                    placeholder="Служба/категория"
                                    :selectionMode="'single'"
                                    :options="categoryGroupTree"
                                    v-model="primeTreeModal"
                                    :changeHandler="onChangeTreeSelectModal"
                                    :disabled="isViewMode"
                                />
                            </div>
                            <div class="col-span-12 md:col-span-6">
                                <label class="block font-bold mb-3">Приоритет</label>
                                <Select
                                    id="priority"
                                    ref="prioritySelectRef"
                                    name="priority"
                                    v-model="currentSupportService.priority"
                                    :options="priority"
                                    placeholder=""
                                    fluid
                                    option-label="label"
                                    option-value="value"
                                    :disabled="isViewMode"
                                    :readonly="isViewMode"
                                ></Select>
                            </div>
                        </div>
                        <div class="grid grid-cols-12">
                            <div class="col-span-12">
                                <label class="font-bold mr-2">Помещение:</label>
                                <Button
                                    id="location"
                                    ref="locationButtonRef"
                                    v-if="locationTypeFullPath"
                                    variant="link"
                                    @click="() => (locationTypeModal = true)"
                                    :class="[{ 'text-red-500': validationErrors.location }]"
                                    :disabled="isViewMode"
                                >
                                    {{ locationTypeFullPath }}
                                </Button>
                                <Button
                                    v-else
                                    id="location_button"
                                    ref="locationButtonRef"
                                    @click="() => (locationTypeModal = true)"
                                    label="Не выбрано. Нажмите, чтобы выбрать"
                                    variant="link"
                                    :class="[{ 'text-red-500': validationErrors.location }]"
                                    :disabled="isViewMode"
                                />
                            </div>
                        </div>
                        <div v-if="locationTypeFullPath === 'Описано вручную'" class="mb-4">
                            <label class="block font-bold mb-2" for="manualLocation">
                                Место описанное пользователем:
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
                                :readonly="isViewMode || !isEditingManualLocation"
                                :disabled="isViewMode || !isEditingManualLocation"
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
                                :disabled="isViewMode"
                                v-if="!isViewMode"
                            />
                        </div>
                        <Panel
                            :toggleable="!isViewMode"
                            :collapsed="isCausePanelCollapsed"
                            class="cause-panel mb-4"
                        >
                            <template #header>
                                <div
                                    @click="onPanelHeaderClick"
                                    class="w-full h-full cause-panel__header"
                                >
                                    Описание (необязательно)
                                </div>
                            </template>
                            <Textarea
                                id="description"
                                ref="descriptionTextareaRef"
                                name="description"
                                v-model="currentSupportService.description"
                                rows="10"
                                cols="20"
                                fluid
                                :readonly="isViewMode"
                                :disabled="isViewMode"
                            />
                        </Panel>

                        <!-- Прикреплённые файлы -->

                        <div class="support-service__files-block">
                            <file-list
                                v-if="existingFiles.length"
                                class="support-service__files-existing text-sm md:text-base font-semibold"
                                :items="existingFiles"
                                :disabled="isViewMode"
                                @remove="(id:number) => { if (!removedFileIds.includes(id)) removedFileIds.push(id); (currentSupportService as any).files = existingFiles.filter(f=>f.id!==id) }"

                            />

                            <file-attach
                                :files="supportFiles"
                                @update:files="(v: File[]) => (supportFiles = Array.isArray(v) ? v : [])"
                                :disabled="!isFileUploadEnabled"
                                :accept="'*'"

                            />
                        </div>
                    </TabPanel>
                </TabPanels>
            </Tabs>
            <div class="flex justify-end gap-3">
                <Button
                    label="Отмена"
                    icon="pi pi-times"
                    text
                    @click="onDialogVisibleChange(false)"
                />
                <Button
                    :label="modalSaveButtonText"
                    icon="pi pi-check"
                    type="submit"
                    v-if="!isViewMode"
                />
            </div>

            <div
                class="flex flex-wrap items-center gap-x-2 gap-y-1 ml-4 text-sm"
            >
                <template v-if="!route.params.id">
                    <!-- Режим создания - показываем текущего пользователя -->
                    <span>Постановщик заявки - {{ getFullName(userStore.user ?? {}) }}</span>
                    <i class="pi pi-building"></i>
                    <span>{{
                        userStore.user?.department?.name || 'Подразделение не указано'
                    }}</span>
                </template>
                <template v-else>
                    <!-- Режим редактирования/просмотра - показываем автора заявки -->
                    <span class="cursor-pointer" @click.prevent="openChat(currentSupportService.created_by?.id)">Постановщик заявки - {{ getFullName(currentSupportService.created_by ?? {}) }}</span>
                    <i class="pi pi-building"></i>
                    <span>{{
                        currentSupportService.created_by?.department?.name ||
                        'Подразделение не указано'
                    }}</span>
                    <i class="pi pi-clock text-xs"></i>
                    <span class="cursor-default" title="Дата создания заявки"> {{ formatResponsibilityDate(currentSupportService.created_at) || 'Не удалось определить дату создания заявки' }} </span>
                </template>
            </div>
        </Form>
        <RoomModal
            v-model:visible="locationTypeModal"
            @closeModal="handleRoomModalClose"
            :disabled="isViewMode"
            targetStore="supportService"
        />
    </Dialog>
</template>

<style scoped lang="scss">
.border-red-500 {
    border-color: #ef4444;
}
.text-red-500 {
    color: #ef4444;
    border: 1px solid #ef4444;
}

.force-focus-visible {
    outline: var(--p-button-focus-ring-width) var(--p-button-focus-ring-style)
        var(--p-button-primary-focus-ring-color) !important;
}

:deep(.support-service__files-existing .file-list__title) {
    @apply font-semibold text-sm md:text-base mb-2;
}
</style>

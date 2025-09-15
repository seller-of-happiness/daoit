<script setup lang="ts">
/*
* Компонент модального окна для выбора сотрудников.
*
* Основные функции:
* - Отображает иерархическую структуру сотрудников по отделам и должностям
* - Поддерживает два режима работы: для участников событий и для ответственных лиц
* - Реализует поиск по ФИО и отделам
* - Позволяет выбирать несколько сотрудников (в режиме участников)
* - Автоматически форматирует телефон и дату рождения
* - Сохраняет выбранных сотрудников в текущее событие
*/
// Импорт необходимых функций Vue и утилит
import { ref, watch, computed, nextTick, onUnmounted } from 'vue'
import { useApiStore } from '@/refactoring/modules/apiStore/stores/apiStore'
import { useAuthStore } from '@/refactoring/modules/authStore/stores/authStore'
import { useFeedbackStore } from '@/refactoring/modules/feedback/stores/feedbackStore'
import { storeToRefs } from 'pinia'
import { useGlobalConfirm } from '@/refactoring/modules/feedback/utils/useGlobalConfirm'
import type { IEmployee } from '@/refactoring/modules/apiStore/types/employees/IEmployee'
import { ITreeNode } from '@/refactoring/modules/apiStore/types/ITreeNode'

/*
* Компонент модального окна для выбора сотрудников.
*
* Основные функции:
* - Отображает иерархию сотрудников (отдел → должность → сотрудник)
* - Поиск по ФИО/узлам дерева с подсветкой
* - Поддержка режимов работы:
*     - 'participants' — множественный выбор; модалка сама пушит участников в currentAdverseEvent.participants
*     - 'responsibility_entry' — одиночный выбор; модалка ничего не пишет, эмитит 'employee-selected' наружу
*     - 'support' — одиночный выбор; модалка ничего не пишет, эмитит 'employee-selected' наружу
*     - 'adverse' — одиночный выбор; модалка ничего не пишет, эмитит 'employee-selected' наружу
*     - 'ticket' — одиночный выбор координатора тикета; модалка НИЧЕГО не пишет в сторы,
*       просто эмитит наружу ('employee-selected', IEmployee). Родитель сам назначает координатора.
*
* Прочее:
* - Быстрый вход (fastLogin) — DEV-режим: при выборе сразу дергается authStore.fastLogin и закрывается модалка.
*/
const props = defineProps<{
    target?: 'participants' | 'responsibility_entry' | 'support' | 'adverse' | 'ticket'
    employees?: IEmployee[]
    selectedEmployeeId?: string | null
    fastLogin?: boolean
}>()

// Определение событий компонента
const emit = defineEmits(['closeModal', 'employee-selected'])

// Модель видимости модального окна
const visible = defineModel<boolean>('visible')

// Инициализация хранилищ и утилит
const apiStore = useApiStore()
const authStore = useAuthStore()
const feedbackStore = useFeedbackStore()

const confirmAction = useGlobalConfirm() // Утилита для подтверждения действий
const { employees, currentAdverseEvent } = storeToRefs(apiStore) // Реактивные данные из хранилища

// Реактивные переменные компонента
const treeNodes = ref<any[]>([]) // Узлы дерева сотрудников
const search = ref('') // Строка поиска
const searchQuery = ref('') // Фактический запрос для поиска (с дебаунсом)
const selectedKeys = ref<Record<string, boolean>>({}) // Выбранные ключи в дереве
const selectedEmployees = ref<IEmployee[]>([]) // Выбранные сотрудники
// Одиночные режимы
const isSingle =
    props.target === 'responsibility_entry' ||
    props.target === 'support' ||
    props.target === 'adverse' ||
    props.target === 'ticket'


// Таймер для дебаунса
let searchTimeout: number | null = null

/**
 * Строит иерархическое дерево сотрудников по отделам и должностям
 * @param employeesList - массив сотрудников для построения дерева
 * @returns Иерархическое дерево сотрудников
 */
function buildEmployeeTree(employeesList: IEmployee[]) {
    const depMap: Record<string, any> = {} // Маппинг по отделам
    const noDepMap: Record<string, IEmployee[]> = {} // Маппинг сотрудников без отдела

    // Группировка сотрудников по отделам и должностям
    for (const emp of employeesList) {
        const depName = emp.department?.name || 'Без отделения'
        const posName = emp.position?.name || 'Без должности'

        if (depName === 'Без отделения') {
            noDepMap[posName] = noDepMap[posName] || []
            noDepMap[posName].push(emp)
        } else {
            depMap[depName] = depMap[depName] || {}
            depMap[depName][posName] = depMap[depName][posName] || []
            depMap[depName][posName].push(emp)
        }
    }

    // Построение дерева с отделами
    const tree = Object.entries(depMap).map(([depName, positions]: [string, any]) => ({
        key: `dep-${depName}`,
        label: depName,
        children: (Object.entries(positions) as [string, IEmployee[]][]).map(([posName, emps]) => ({
            key: `dep-${depName}-pos-${posName}`,
            label: posName,
            children: emps.map(emp => ({
                key: `emp-${emp.id}`,
                label: `${emp.last_name} ${emp.first_name} ${emp.middle_name ?? ''}`.trim(),
                data: emp,
                isLeaf: true,
            }))
        }))
    }))

    // Добавление сотрудников без отдела в дерево
    if (Object.keys(noDepMap).length) {
        tree.push({
            key: 'dep-no-department',
            label: 'Без отделения',
            children: Object.entries(noDepMap).map(([posName, emps]: [string, IEmployee[]]) => ({
                key: `dep-no-department-pos-${posName}`,
                label: posName,
                children: emps.map(emp => ({
                    key: `emp-${emp.id}`,
                    label: `${emp.last_name} ${emp.first_name} ${emp.middle_name ?? ''}`.trim(),
                    data: emp,
                    isLeaf: true,
                }))
            }))
        })
    }

    return tree
}

/**
 * Обработчик выбора сотрудника для быстрого входа
 */
async function handleFastLogin(employee: IEmployee) {
    if (!props.fastLogin) return

    try {
        const success = await authStore.fastLogin({ uuid: employee.id })
        if (success) {
            feedbackStore.showToast({
                type: 'success',
                title: 'Успешно',
                message: `Вход выполнен как ${employee.last_name} ${employee.first_name}`,
                time: 3000,
            })
            emit('closeModal')
        }
    } catch (error) {
        console.error('Ошибка быстрого входа:', error)
    } finally {
        feedbackStore.isGlobalLoading = false
    }
}

/**
 * Флаг отображения кнопки «Очистить выбор».
 *
 * Логика:
 * - Кнопка видна только в режиме 'responsibility_entry'
 * - И только если в форме родителя уже выбран сотрудник (selectedEmployeeId не пуст)
 *
 * Возвращает: boolean
 */
const canShowClearButton = computed(() => (
    props.target === 'responsibility_entry' && !!props.selectedEmployeeId
))


// Следим за изменением списка сотрудников и обновляем дерево
watch(
    () => props.employees || employees.value,
    val => {
        treeNodes.value = buildEmployeeTree(val)
    },
    { immediate: true }
)

// Фильтрация дерева по поисковому запросу
const filteredTree = computed(() => {
    if (!searchQuery.value) return treeNodes.value
    const lower = searchQuery.value.toLowerCase()

    // Рекурсивная фильтрация дерева
    function filterTree(nodes: any[]): any[] {
        return nodes
            .map(node => {
                if (node.children) {
                    const filteredChildren = filterTree(node.children)
                    if (filteredChildren.length) {
                        return { ...node, children: filteredChildren }
                    }
                }
                if (node.label.toLowerCase().includes(lower)) {
                    return node
                }
                return null
            })
            .filter(Boolean)
    }

    return filterTree(treeNodes.value)
})

// Сброс выбора при изменении отфильтрованного дерева
watch(filteredTree, () => {
    selectedKeys.value = {}
    selectedEmployees.value = []
})

/**
 * Находит путь к узлу по его ключу
 * @param nodes - массив узлов для поиска
 * @param key - искомый ключ
 * @param path - текущий путь (используется рекурсивно)
 * @returns Массив ключей пути или null
 */
function findPathByKey(nodes: any[], key: string, path: string[] = []): string[] | null {
    for (const node of nodes) {
        if (node.key === key) return [...path, node.key]
        if (node.children) {
            const found = findPathByKey(node.children, key, [...path, node.key])
            if (found) return found
        }
    }
    return null
}

/**
 * Обработчик изменения выбора в дереве
 * * Что делает:
 * - Собирает выбранных сотрудников из отмеченных листьев.
 * - Для одиночных режимов ('responsibility_entry' | 'support' | 'adverse' | 'ticket')
 *   оставляет только первого выбранного.
 * - Для 'participants' — оставляет весь набор (мультиселект).
 *
* Важно:
 * - Не пишет в сторы и формы — только формирует локальное состояние selectedEmployees/selectedKeys.
 */
function onSelectionChange(val: Record<string, boolean>) {
    const employeesSelected: IEmployee[] = []
    const allKeys: Record<string, boolean> = {}

    // Рекурсивно собираем отмеченные листья (сотрудников)
    function walk(nodes: any[]) {
        for (const node of nodes) {
            if (node.children) walk(node.children)
            if (val[node.key] && node.isLeaf) {
                employeesSelected.push(node.data as IEmployee)
                const path = findPathByKey(treeNodes.value, node.key) ?? [node.key]
                path.forEach(k => (allKeys[k] = true))
            }
        }
    }
    walk(filteredTree.value)

    selectedEmployees.value = isSingle ? employeesSelected.slice(0, 1) : employeesSelected
    selectedKeys.value = allKeys
}

// Очистка текущего выбора
function clearSelection() {
    selectedKeys.value = {}
    selectedEmployees.value = []
}

/**
 * Сохранение выбранных сотрудников.
 *
 * * Логика:
 * - Если включён fastLogin — выполняем dev-логин и закрываем модалку.
 * - Для одиночных режимов ('responsibility_entry' | 'support' | 'adverse' | 'ticket')
 *   НИЧЕГО не пишем в сторы внутри модалки — просто эмитим наружу ('employee-selected', IEmployee).
 *   Родитель решает, что делать с выбором (в т.ч. назначение координатора тикета).
 * - Для 'participants' — множественный выбор, пушим недостающих участников в currentAdverseEvent.participants.
 *
 * После:
 * - Очищаем локальный выбор, закрываем модалку, эмитим 'closeModal'.
 */
function setData() {
    if (!selectedEmployees.value.length) return

    // Обработка быстрого входа
    if (props.fastLogin) {
        handleFastLogin(selectedEmployees.value[0])
        return
    }

    if (isSingle) {
        emit('employee-selected', selectedEmployees.value[0])
    } else {
        // Участники — множественный выбор, модалка самостоятельно синхронизирует с событием
        if (!Array.isArray(currentAdverseEvent.value.participants)) {
            currentAdverseEvent.value.participants = []
        }
        for (const emp of selectedEmployees.value) {
            const already = currentAdverseEvent.value.participants
                .some(p => p.employee_id === emp.id)
            if (!already) {
                currentAdverseEvent.value.participants.push({
                    employee_id: emp.id,                         // UUID сотрудника
                    full_name: `${emp.last_name} ${emp.first_name} ${emp.middle_name || ''}`.trim(),
                    birth_date: emp.birth_date ?? null,
                    phone_number: emp.phone_number ?? null,
                    key: 'emp-' + emp.id,
                    participant_type: 'employee',
                })
            }
        }
    }

    clearSelection()
    visible.value = false
    emit('closeModal')
}


/**
 * Обработчик «Очистить выбор» для режима responsibility_entry.
 *
 * Зачем target:
 *  - Кнопка есть только когда target === 'responsibility_entry' — очищаем выбор ИСКЛЮЧИТЕЛЬНО в формовом сторе родителя,
 *    чтобы избежать рассинхрона со state события.
 *
 * Что делаем:
 *  1) По props.selectedEmployeeId (UUID) находим сотрудника в списке (props.employees || store),
 *     чтобы показать ФИО в подтверждении.
 *  2) Показываем confirm; на accept шлём emit('employee-selected', null) — родитель очистит форму.
 *  3) Сбрасываем локальный выбор и закрываем модалку.
 *
 * Важно:
 *  - НЕ трогаем currentAdverseEvent здесь, вся логика формы — в родителе.
 */
async function handleClearButton() {
    if (props.target !== 'responsibility_entry') return

    const list = props.employees ?? employees.value ?? []
    const selId = props.selectedEmployeeId
    let employeeName = ''

    if (selId) {
        const emp = list.find(e => e.id === selId)
        if (emp) {
            employeeName = `${emp.last_name} ${emp.first_name} ${emp.middle_name ?? ''}`.trim()
        }
    }

    try {
        await confirmAction({
            message: employeeName
                ? `Удалить выбранного сотрудника: ${employeeName}?`
                : 'Удалить выбранного сотрудника?',
            header: 'Подтверждение действия',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Удалить',
            rejectLabel: 'Отмена',
            acceptClass: 'p-button-danger',
        })

        // Сигнал родителю: очисти employee_to в формовом сторе
        emit('employee-selected', null)

        clearSelection()
        visible.value = false
        emit('closeModal')
    } catch {
        // Отмена — ничего не делаем
    }
}

// Управление раскрытием узлов дерева
const expandedKeys = ref<Record<string, boolean>>({})


/**
 * Обрабатывает клик по label узла дерева сотрудников.
 *
 * * Поведение:
 * - Если это родитель (есть children) — просто раскрываем/сворачиваем.
 * - Если это лист (сотрудник) и он уже отмечен:
 *     — Синхронизируем selectedEmployees:
 *         * для одиночных режимов ('responsibility_entry' | 'support' | 'adverse' | 'ticket') — единственный выбранный
 *         * для 'participants' — добавляем к списку
 *     — После nextTick() вызываем setData(), имитируя нажатие «Выбрать».
 */
function handleNodeLabelClick(node: any, event: MouseEvent) {
    // Родители — только раскрытие/сворачивание
    if (node?.children && node?.key) {
        event.stopPropagation()
        expandedKeys.value = {
            ...expandedKeys.value,
            [node.key]: !expandedKeys.value[node.key]
        }
        return
    }

    // Лист: если уже выбран — сразу триггерим подтверждение, как кнопка "Выбрать"
    if (node?.isLeaf && node?.key && selectedKeys.value?.[node.key]) {
        event.stopPropagation()
        const emp = node.data as IEmployee

        selectedEmployees.value = isSingle
            ? [emp]
            : [emp, ...selectedEmployees.value.filter(e => e.id !== emp.id)]

        nextTick(() => setData())
    }
}

// Обработчики раскрытия/сворачивания узлов
function onNodeExpand(node: any) {
    if (node?.key) {
        expandedKeys.value = { ...expandedKeys.value, [node.key]: true }
    }
}
function onNodeCollapse(node: any) {
    if (node?.key) {
        const newKeys = { ...expandedKeys.value }
        delete newKeys[node.key]
        expandedKeys.value = newKeys
    }
}

/* БЛОК АВТОФОКУСА / ПОДСВЕТКИ ПОИСКОВОГО ЗАПРОСА / РАСКРЫТИЕ РОДИТЕЛЬСКИХ УЗЛОВ И ОЧИСТКИ*/

/**
 * Ссылка на инпут поиска в модальном окне.
 *
 * Назначение:
 * - Хранит ref на input (или оболочку с $el), чтобы программно навести и удерживать фокус.
 * - Может быть null до рендера, учитывайте это при обращении.
 *
 * Тип: HTMLInputElement | { $el?: HTMLElement } | null
 */
    // const s
const searchInputRef = ref<HTMLInputElement | { $el?: HTMLElement } | null>(null)

/**
 * Хранилище функции очистки обработчиков фокуса.
 *
 * Назначение:
 * - При открытии модалки навешиваются слушатели (focusin в capture и т.д.) и запускается цикл удержания фокуса.
 * - При закрытии вызывается сохранённый cleanup для корректного снятия слушателей/остановки циклов.
 *
 * Значение:
 * - null — пока нет активных обработчиков.
 * - () => void — функция, снимающая все навешанные слушатели/циклы.
 */
let cleanupFocusHandlers: (() => void) | null = null // Для очистки обработчиков фокуса

/**
 * Принудительно удерживает фокус на переданном input в течение durationMs.
 *
 * Как работает:
 * - До истечения deadline на каждом кадре (requestAnimationFrame) проверяет, не уехал ли фокус.
 * - Если фокус ушёл — возвращает его на input и выделяет текст (select).
 * - Возвращает функцию-останавливалку, которую нужно вызвать при закрытии модалки.
 *
 * Параметры:
 * - input: HTMLInputElement — целевой инпут.
 * - durationMs: number = 1200 — длительность «упорного» удержания фокуса.
 *
 * Возвращает: () => void — функция для остановки механизма удержания.
 */
function startFocusEnforcer(input: HTMLInputElement, durationMs = 1200) {
    let stopped = false
    const deadline = performance.now() + durationMs

    const tick = () => {
        if (stopped) return
        if (document.activeElement !== input) {
            input.focus({ preventScroll: true })
            input.select()
        }
        if (performance.now() < deadline) requestAnimationFrame(tick)
    }

    requestAnimationFrame(tick)
    return () => { stopped = true }
}


/**
 * Наводит и удерживает фокус на поле поиска при открытии модалки.
 *
 * Что делает:
 * - Ждёт рендер (nextTick + двойной requestAnimationFrame), чтобы переждать focus-trap PrimeVue.
 * - Ищет диалог .employee-modal и внутри — текстовый input с классом .p-inputtext.
 * - У кнопки закрытия снимает autofocus и выставляет tabindex="-1", уменьшая шанс перехвата фокуса.
 * - Вешает обработчик 'focusin' в режиме capture, чтобы возвращать фокус обратно на input при попытке уехать на крестик.
 * - Запускает startFocusEnforcer(...) на ~1.2s для «упорного» удержания фокуса.
 * - Сохраняет функцию очистки в cleanupFocusHandlers (снятие слушателей и остановка удержания).
 *
 * Использует: nextTick, requestAnimationFrame, startFocusEnforcer, cleanupFocusHandlers.
 */
const focusSearch = () => {
    nextTick(() => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const dialog = document.querySelector('.employee-modal') as HTMLElement | null
                if (!dialog) return

                const input = dialog.querySelector('input[type="text"].p-inputtext') as HTMLInputElement | null
                if (!input) return

                // 1) Убираем перехват фокуса у крестика
                const closeBtn = dialog.querySelector('.p-dialog-header-close') as HTMLButtonElement | null
                closeBtn?.removeAttribute('autofocus')
                closeBtn?.setAttribute('tabindex', '-1') // [ADD] сложнее увести фокус табом

                // 2) Возврат фокуса при любых фокус-событиях внутри диалога (capture, раньше чем PV)
                const focusBack = () => { input.focus({ preventScroll: true }); input.select() }
                const onFocusIn = (e: FocusEvent) => {
                    const t = e.target as HTMLElement
                    if (!t) return
                    if (t === closeBtn || t.classList.contains('p-dialog-header-close')) focusBack()
                }
                dialog.addEventListener('focusin', onFocusIn, true) // [CHANGED] capture=true

                // 3) Упорный цикл до стабилизации (пережидаем внутренний focus-trap)
                const stopEnforce = startFocusEnforcer(input, 1200) // [ADD]

                // 4) Начальный фокус
                focusBack()

                // 5) Очистка
                cleanupFocusHandlers = () => {
                    dialog.removeEventListener('focusin', onFocusIn, true)
                    stopEnforce()
                }
            })
        })
    })
}

/**
 * Подсвечивает совпадения поискового запроса в тексте label.
 *
 * Что делает:
 * - Экранирует спецсимволы в строке поиска.
 * - Оборачивает все вхождения (без учёта регистра) в <mark>...</mark>.
 * - При пустом запросе возвращает исходный label без изменений.
 *
 * Параметры:
 * - label: string = '' — исходный текст.
 * - q: string = '' — строка поиска.
 *
 * Возвращает: string — HTML-строка с разметкой подсветки.
 */
const highlightMatch = (label: string = '', q: string = '') => {
    if (!q) return label
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return label.replace(new RegExp(`(${safe})`, 'ig'), '<mark>$1</mark>')
}

/**
 * Строит объект expandedKeys на основе дерева и карты «какие узлы должны быть открыты».
 *
 * Что делает:
 * - Обходит дерево ITreeNode в глубину и для каждого узла с children выставляет ключ в результате.
 * - Если в openMap[key] true — узел помечается как раскрытый, иначе — закрыт.
 *
 * Параметры:
 * - nodes: ITreeNode[] = [] — корни дерева.
 * - openMap: Record<string, boolean> = {} — карта открытых узлов (ключ -> открыт/закрыт).
 *
 * Возвращает: Record<string, boolean> — объект для передачи в :expandedKeys Tree.
 */
const buildExpandedState = (nodes: ITreeNode[] = [], openMap: Record<string, boolean> = {}) => {
    const res: Record<string, boolean> = {}
    const walk = (n: ITreeNode) => {
        if (n.children?.length) {
            res[n.key] = Boolean(openMap[n.key])
            n.children.forEach(walk)
        }
    }
    nodes.forEach(walk)
    return res
}

/**
 * Реакция на ввод в поле поиска (watch за search).
 *
 * Логика:
 * - Если строка поиска пустая: сбрасывает раскрытие — expandedKeys = buildExpandedState(roots, {}).
 * - Если есть запрос: вычисляет toExpand — набор всех родителей узлов, чьи label содержат подстроку поиска (без регистра).
 *   Затем применяет buildExpandedState(roots, toExpand), чтобы раскрыть только релевантные ветви.
 *
 * Использует: treeNodes (как корни ITreeNode[]), buildExpandedState.
 */
/**
 * Реакция на ввод в поле поиска (watch за search) с дебаунсом и минимальной длиной
 */
watch(search, (val) => {
    const q = (val || '').toLowerCase().trim()
    const roots = treeNodes.value as ITreeNode[]

    // Очищаем предыдущий таймаут
    if (searchTimeout) {
        clearTimeout(searchTimeout)
        searchTimeout = null
    }

    // Если поиск пустой - сразу сбрасываем
    if (!q) {
        searchQuery.value = ''
        expandedKeys.value = buildExpandedState(roots, {})
        return
    }

    // Если меньше 2 символов - не выполняем поиск, но сбрасываем предыдущие результаты
    if (q.length < 2) {
        searchQuery.value = ''
        expandedKeys.value = buildExpandedState(roots, {})
        return
    }

    // Для 2+ символов - устанавливаем таймаут дебаунса
    searchTimeout = setTimeout(() => {
        searchQuery.value = q


        const toExpand: Record<string, boolean> = {}
        const dfs = (node: ITreeNode, parents: string[]) => {
            const label = (node.label || '').toLowerCase()
            if (label.includes(q)) parents.forEach(k => { toExpand[k] = true })
            node.children?.forEach((ch) => dfs(ch, [...parents, node.key]))
        }
        roots.forEach((n) => dfs(n, []))
        expandedKeys.value = buildExpandedState(roots, toExpand)

        searchTimeout = null
    }, 300) // 300ms задержка
})

/**
 * Реакция на открытие/закрытие модалки (watch за visible).
 *
 * При открытии (true):
 * - Вызывает focusSearch(), чтобы навести и удержать фокус на поле поиска.
 *
 * При закрытии (false):
 * - Очищает строку поиска (search = '').
 * - Сбрасывает раскрытие дерева: expandedKeys = buildExpandedState(treeNodes, {}).
 * - Вызывает cleanupFocusHandlers(), если есть, и обнуляет ссылку (cleanupFocusHandlers = null).
 *
 * Параметры watch: { immediate: true } — выполняет обработчик сразу при инициализации.
 */
watch(visible, (v) => {
    if (v) {
        focusSearch()
    } else {
        search.value = '' // очистка строки поиска
        expandedKeys.value = buildExpandedState(treeNodes.value, {})
        cleanupFocusHandlers?.()
        cleanupFocusHandlers = null
    }
}, { immediate: true })

// Очистка при размонтировании компонента
onUnmounted(() => {
    if (searchTimeout) {
        clearTimeout(searchTimeout)
    }
})
</script>

<template>
    <!-- Модальное окно выбора сотрудника -->
    <Dialog
        v-model:visible="visible"
        header="Выбор сотрудника"
        :modal="true"
        :style="{ width: '600px', minHeight: '400px' }"
        class="employee-modal"
    >
        <!-- Поле поиска -->
        <div class="employee-modal__body max-h-[50vh] overflow-y-auto pb-2">
            <div class="mb-4">
                <InputText
                    ref="searchInputRef"
                    v-model="search"
                    placeholder="Введите 2 или более символа для поиска"
                    class="w-full"
                />
            </div>

            <!-- Дерево сотрудников -->
            <Tree
                :value="filteredTree"
                selectionMode="single"
                v-model:selectionKeys="selectedKeys"
                @update:selectionKeys="onSelectionChange"
                class="w-full"
                :filter="false"
                filterMode="str"
                :expandedKeys="expandedKeys"
                @node-expand="onNodeExpand"
                @node-collapse="onNodeCollapse"
            >
                <!-- Кастомный рендеринг узлов дерева -->
                <template #default="{ node }">
<span
    class="employee-tree-label"
    @click="handleNodeLabelClick(node, $event)"
>
  <span v-html="highlightMatch(node.label, search)"></span>
</span>
                </template>
            </Tree>
        </div>

        <!-- Кнопки действий -->
        <div class="employee-modal__actions sticky bottom-0 z-10  flex justify-end flex-wrap gap-3 pt-4 pb-3 border-t">
            <!-- Кнопка очистки выбора (только для responsibility_entry) -->
            <Button
                v-if="canShowClearButton"
                label="Очистить выбор"
                icon="pi pi-trash"
                severity="danger"
                outlined
                @click="handleClearButton"
                class="mr-auto"
            />

            <!-- Кнопка отмены -->
            <Button
                label="Отмена"
                icon="pi pi-times"
                text
                @click="() => { clearSelection(); visible = false; emit('closeModal') }"
            />

            <!-- Кнопка выбора -->
            <Button
                label="Выбрать"
                icon="pi pi-check"
                :disabled="!selectedEmployees.length"
                @click="setData"
            />
        </div>
    </Dialog>
</template>

<!-- Стили компонента -->
<style scoped lang="scss">
</style>

<template>
    <!-- Диалог приглашения пользователей -->
    <Dialog
        v-model:visible="visible"
        :header="`Пригласить пользователей в ${chatTitle}`"
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
                selectionMode="checkbox"
                v-model:selectionKeys="selectedKeys"
                @update:selectionKeys="onSelectionChange"
                class="w-full employee-tree"
                :filter="false"
                filterMode="str"
                :expandedKeys="expandedKeys"
                @node-expand="onNodeExpand"
                @node-collapse="onNodeCollapse"
                :metaKeySelection="false"
            >
                <!-- Кастомный рендеринг узлов дерева -->
                <template #default="{ node }">
                    <div class="employee-node-wrapper flex items-center justify-between w-full">
                        <span
                            class="employee-tree-label flex-1"
                            @click="handleNodeLabelClick(node, $event)"
                        >
                            <span v-html="highlightMatch(node.label, searchQuery)"></span>
                        </span>
                        <!-- Кнопки для групповых операций с отделами и должностями -->
                        <div v-if="!node.isLeaf && node.children" class="flex gap-1">
                            <Button
                                icon="pi pi-check-square"
                                class="p-button-rounded p-button-text p-button-sm group-select-btn"
                                @click="selectAllInGroup(node, $event)"
                                :disabled="isInviting"
                                size="small"
                                v-tooltip.left="'Выбрать всех'"
                            />
                            <Button
                                icon="pi pi-minus-circle"
                                class="p-button-rounded p-button-text p-button-sm group-deselect-btn"
                                @click="deselectAllInGroup(node, $event)"
                                :disabled="isInviting"
                                size="small"
                                v-tooltip.left="'Снять выбор со всех'"
                            />
                        </div>
                    </div>
                </template>
            </Tree>

            <!-- Выбранные участники -->
            <div v-if="selectedEmployees.length > 0" class="selected-users">
                <div class="flex items-center justify-between mb-2">
                    <div class="label-small">
                        Выбранные участники ({{ selectedEmployees.length }})
                    </div>
                    <div class="flex gap-2">
                        <Button
                            icon="pi pi-check-square"
                            label="Выбрать всех"
                            size="small"
                            severity="success"
                            outlined
                            @click="selectAllEmployees"
                            :disabled="isInviting"
                            v-tooltip.top="'Выбрать всех сотрудников'"
                        />
                        <Button
                            icon="pi pi-times-circle"
                            label="Очистить"
                            size="small"
                            severity="danger"
                            outlined
                            @click="clearAllSelection"
                            :disabled="isInviting"
                            v-tooltip.top="'Очистить выбор'"
                        />
                    </div>
                </div>
                <div class="selected-users-list">
                    <div
                        v-for="user in selectedEmployees"
                        :key="user.id"
                        class="selected-user-chip"
                    >
                        <span
                            >{{ user.last_name }} {{ user.first_name }}
                            {{ user.middle_name || '' }}</span
                        >
                        <Button
                            icon="pi pi-times"
                            size="small"
                            text
                            rounded
                            class="remove-user-btn"
                            @click="removeUserFromSelection(user)"
                        />
                    </div>
                </div>
            </div>
        </div>

        <!-- Кнопки действий -->
        <div
            class="employee-modal__actions sticky bottom-0 z-10 flex justify-end flex-wrap gap-3 pt-4 pb-3 border-t"
        >
            <!-- Кнопка отмены -->
            <Button label="Отмена" icon="pi pi-times" text @click="closeDialog" />

            <!-- Кнопка приглашения -->
            <Button
                label="Пригласить"
                icon="pi pi-check"
                :disabled="!selectedEmployees.length || isInviting"
                :loading="isInviting"
                @click="inviteUsers"
            />
        </div>
    </Dialog>
</template>

<script setup lang="ts">
/*
 * Компонент диалога приглашения пользователей в чат.
 *
 * Основные функции:
 * - Отображает иерархическую структуру сотрудников по отделам и должностям сразу при открытии
 * - Реализует поиск по ФИО и отделам с дебаунсом (начинает работать после ввода 2 символов)
 * - Поддерживает множественный выбор сотрудников через чекбоксы
 * - Предоставляет кнопки для групповых операций (выбрать всех/снять выбор) для отделов и должностей
 * - Показывает список выбранных участников с возможностью удаления
 * - Автоматически фокусируется на поле поиска
 * - Исключает уже добавленных в чат участников
 */

// Импорт необходимых функций Vue и утилит
import { ref, watch, computed, nextTick, onUnmounted } from 'vue'
import { useApiStore } from '@/refactoring/modules/apiStore/stores/apiStore'
import { useFeedbackStore } from '@/refactoring/modules/feedback/stores/feedbackStore'
import { storeToRefs } from 'pinia'
import type { IEmployee } from '@/refactoring/modules/apiStore/types/employees/IEmployee'
import { ITreeNode } from '@/refactoring/modules/apiStore/types/ITreeNode'
import type { IChat, IChatMember } from '@/refactoring/modules/chat/types/IChat'

// Определение пропсов и событий компонента
const props = defineProps<{
    visible: boolean
    chat: IChat | null
}>()

// Определение событий компонента
const emit = defineEmits(['update:visible', 'invite-users'])

// Модель видимости модального окна
const visible = defineModel<boolean>('visible')

// Инициализация хранилищ и утилит
const apiStore = useApiStore()
const feedbackStore = useFeedbackStore()

const { employees } = storeToRefs(apiStore) // Реактивные данные из хранилища

// Реактивные переменные компонента
const treeNodes = ref<any[]>([]) // Узлы дерева сотрудников
const search = ref('') // Строка поиска
const searchQuery = ref('') // Фактический запрос для поиска (с дебаунсом)
const selectedKeys = ref<Record<string, boolean>>({}) // Выбранные ключи в дереве
const selectedEmployees = ref<IEmployee[]>([]) // Выбранные сотрудники
const isInviting = ref(false)

// Таймер для дебаунса
let searchTimeout: number | null = null

// Вычисляемые свойства
const chatTitle = computed(() => {
    if (!props.chat) return ''
    return props.chat.title || `Чат #${props.chat.id}`
})

// Получаем текущих участников чата
const currentMembers = computed<IChatMember[]>(() => {
    if (!props.chat || !props.chat.members) return []
    return props.chat.members
})

// Фильтруем сотрудников, исключая уже добавленных в чат
const availableEmployees = computed(() => {
    if (!props.chat || !props.chat.members) return employees.value

    // Получаем список ID участников чата
    const existingMemberIds = props.chat.members.map((member) => member.user.id)

    // Исключаем пользователей, которые уже есть в чате
    return employees.value.filter((employee) => !existingMemberIds.includes(employee.id))
})

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
            children: emps.map((emp) => ({
                key: `emp-${emp.id}`,
                label: `${emp.last_name} ${emp.first_name} ${emp.middle_name ?? ''}`.trim(),
                data: emp,
                isLeaf: true,
            })),
        })),
    }))

    // Добавление сотрудников без отдела в дерево
    if (Object.keys(noDepMap).length) {
        tree.push({
            key: 'dep-no-department',
            label: 'Без отделения',
            children: Object.entries(noDepMap).map(([posName, emps]: [string, IEmployee[]]) => ({
                key: `dep-no-department-pos-${posName}`,
                label: posName,
                children: emps.map((emp) => ({
                    key: `emp-${emp.id}`,
                    label: `${emp.last_name} ${emp.first_name} ${emp.middle_name ?? ''}`.trim(),
                    data: emp,
                    isLeaf: true,
                })),
            })),
        })
    }

    return tree
}

// Следим за изменением списка доступных сотрудников и обновляем дерево
watch(
    () => availableEmployees.value,
    (val) => {
        treeNodes.value = buildEmployeeTree(val)
    },
    { immediate: true },
)

// Фильтрация дерева по поисковому запросу
const filteredTree = computed(() => {
    // Всегда показываем полное дерево, если поиск пустой или менее 2 символов
    if (!searchQuery.value || searchQuery.value.length < 2) return treeNodes.value
    const lower = searchQuery.value.toLowerCase()

    // Рекурсивная фильтрация дерева
    function filterTree(nodes: any[]): any[] {
        return nodes
            .map((node) => {
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

// Сброс выбора при изменении отфильтрованного дерева (только при фильтрации)
watch(filteredTree, (newTree, oldTree) => {
    // Сбрасываем выбор только если дерево действительно отфильтровано (есть поисковый запрос >= 2 символов)
    if (searchQuery.value && searchQuery.value.length >= 2) {
        selectedKeys.value = {}
        selectedEmployees.value = []
    }
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
 */
function onSelectionChange(val: Record<string, boolean>) {
    // Обрабатываем изменения выбора в дереве с чекбоксами
    const newSelectedEmployees: IEmployee[] = []

    // Рекурсивно обходим дерево и находим выбранных сотрудников
    const processNode = (node: any) => {
        if (node.isLeaf && node.data && val[node.key]) {
            const employee = node.data as IEmployee
            // Проверяем, не добавлен ли уже этот сотрудник
            if (!newSelectedEmployees.find((emp) => emp.id === employee.id)) {
                newSelectedEmployees.push(employee)
            }
        }

        if (node.children) {
            node.children.forEach(processNode)
        }
    }

    // Обрабатываем все узлы дерева
    treeNodes.value.forEach(processNode)

    // Обновляем список выбранных сотрудников
    selectedEmployees.value = newSelectedEmployees
}

// Очистка текущего выбора (deprecated - используйте clearAllSelection)
function clearSelection() {
    clearAllSelection()
}

/**
 * Проверяет, выбран ли пользователь
 */
const isUserSelected = (user: { id: string }) => {
    return selectedEmployees.value.some((selected) => selected.id === user.id)
}

/**
 * Функции для групповых операций
 */
const selectAllInGroup = (node: any, event: MouseEvent) => {
    event.stopPropagation()

    const collectEmployees = (n: any): any[] => {
        const employees: any[] = []
        if (n.isLeaf && n.data) {
            employees.push(n)
        }
        if (n.children) {
            n.children.forEach((child: any) => {
                employees.push(...collectEmployees(child))
            })
        }
        return employees
    }

    const employees = collectEmployees(node)
    const newSelectedKeys = { ...selectedKeys.value }

    employees.forEach((emp) => {
        if (!isUserSelected({ id: emp.data.id })) {
            newSelectedKeys[emp.key] = true
        }
    })

    selectedKeys.value = newSelectedKeys
}

const deselectAllInGroup = (node: any, event: MouseEvent) => {
    event.stopPropagation()

    const collectEmployees = (n: any): any[] => {
        const employees: any[] = []
        if (n.isLeaf && n.data) {
            employees.push(n)
        }
        if (n.children) {
            n.children.forEach((child: any) => {
                employees.push(...collectEmployees(child))
            })
        }
        return employees
    }

    const employees = collectEmployees(node)
    const newSelectedKeys = { ...selectedKeys.value }

    employees.forEach((emp) => {
        delete newSelectedKeys[emp.key]
    })

    selectedKeys.value = newSelectedKeys
}

// Глобальные функции выбора
const selectAllEmployees = () => {
    const newSelectedKeys: Record<string, boolean> = {}

    const collectAllEmployees = (nodes: any[]) => {
        nodes.forEach((node) => {
            if (node.isLeaf && node.data) {
                newSelectedKeys[node.key] = true
            }
            if (node.children) {
                collectAllEmployees(node.children)
            }
        })
    }

    collectAllEmployees(filteredTree.value.length ? filteredTree.value : treeNodes.value)
    selectedKeys.value = newSelectedKeys
}

const clearAllSelection = () => {
    selectedKeys.value = {}
    selectedEmployees.value = []
}


/**
 * Удаляет пользователя из списка выбранных
 */
const removeUserFromSelection = (user: IEmployee) => {
    const index = selectedEmployees.value.findIndex((selected) => selected.id === user.id)
    if (index >= 0) {
        selectedEmployees.value.splice(index, 1)

        // Также снимаем выделение с соответствующего узла в дереве
        const findAndDeselectNode = (nodes: any[]): boolean => {
            for (const node of nodes) {
                if (node.isLeaf && node.data && node.data.id === user.id) {
                    // Снимаем выделение с узла
                    const newSelectedKeys = { ...selectedKeys.value }
                    delete newSelectedKeys[node.key]
                    selectedKeys.value = newSelectedKeys
                    return true
                }
                if (node.children && findAndDeselectNode(node.children)) {
                    return true
                }
            }
            return false
        }

        findAndDeselectNode(treeNodes.value)
    }
}

/**
 * Приглашение выбранных пользователей
 */
const inviteUsers = async () => {
    if (!selectedEmployees.value.length) return

    isInviting.value = true
    try {
        const userIds = selectedEmployees.value.map((user) => user.id)
        emit('invite-users', userIds)

        clearAllSelection()
        visible.value = false
    } catch (error) {
        feedbackStore.showToast({
            type: 'error',
            title: 'Ошибка',
            message: 'Не удалось пригласить пользователей',
            time: 5000,
        })
    } finally {
        isInviting.value = false
    }
}

const closeDialog = () => {
    clearAllSelection()
    visible.value = false
}

// Управление раскрытием узлов дерева
const expandedKeys = ref<Record<string, boolean>>({})

/**
 * Обрабатывает клик по label узла дерева сотрудников.
 */
function handleNodeLabelClick(node: any, event: MouseEvent) {
    // Проверяем, что клик не был по чекбоксу или его части
    const target = event.target as HTMLElement
    if (target.closest('.p-checkbox') || target.classList.contains('p-checkbox-icon')) {
        // Если клик был по чекбоксу - не обрабатываем, позволяем стандартному поведению Tree работать
        return
    }

    // Родители — только раскрытие/сворачивание
    if (node?.children && node?.key) {
        event.preventDefault()
        expandedKeys.value = {
            ...expandedKeys.value,
            [node.key]: !expandedKeys.value[node.key],
        }
        return
    }

    // Для листьев (сотрудников) клик по label НЕ переключает выбор
    // Оставляем это для чекбоксов Tree компонента
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
 */
const searchInputRef = ref<HTMLInputElement | { $el?: HTMLElement } | null>(null)

/**
 * Хранилище функции очистки обработчиков фокуса.
 */
let cleanupFocusHandlers: (() => void) | null = null // Для очистки обработчиков фокуса

/**
 * Принудительно удерживает фокус на переданном input в течение durationMs.
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
    return () => {
        stopped = true
    }
}

/**
 * Наводит и удерживает фокус на поле поиска при открытии модалки.
 */
const focusSearch = () => {
    nextTick(() => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const dialog = document.querySelector('.employee-modal') as HTMLElement | null
                if (!dialog) return

                const input = dialog.querySelector(
                    'input[type="text"].p-inputtext',
                ) as HTMLInputElement | null
                if (!input) return

                // 1) Убираем перехват фокуса у крестика
                const closeBtn = dialog.querySelector(
                    '.p-dialog-header-close',
                ) as HTMLButtonElement | null
                closeBtn?.removeAttribute('autofocus')
                closeBtn?.setAttribute('tabindex', '-1')

                // 2) Возврат фокуса при любых фокус-событиях внутри диалога
                const focusBack = () => {
                    input.focus({ preventScroll: true })
                    input.select()
                }
                const onFocusIn = (e: FocusEvent) => {
                    const t = e.target as HTMLElement
                    if (!t) return
                    if (t === closeBtn || t.classList.contains('p-dialog-header-close')) focusBack()
                }
                dialog.addEventListener('focusin', onFocusIn, true)

                // 3) Упорный цикл до стабилизации
                const stopEnforce = startFocusEnforcer(input, 1200)

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
 * Возвращает исходный текст без подсветки.
 */
const highlightMatch = (label: string = '', q: string = '') => {
    return label
}

/**
 * Строит объект expandedKeys на основе дерева и карты «какие узлы должны быть открыты».
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
 * Реакция на ввод в поле поиска с дебаунсом и минимальной длиной
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
            if (label.includes(q))
                parents.forEach((k) => {
                    toExpand[k] = true
                })
            node.children?.forEach((ch) => dfs(ch, [...parents, node.key]))
        }
        roots.forEach((n) => dfs(n, []))
        expandedKeys.value = buildExpandedState(roots, toExpand)

        searchTimeout = null
    }, 300) // 300ms задержка
})

/**
 * Реакция на открытие/закрытие модалки
 */
watch(
    visible,
    (v) => {
        if (v) {
            focusSearch()
        } else {
            search.value = '' // очистка строки поиска
            expandedKeys.value = buildExpandedState(treeNodes.value, {})
            clearAllSelection() // очистка выбора
            cleanupFocusHandlers?.()
            cleanupFocusHandlers = null
        }
    },
    { immediate: true },
)

// Очистка при размонтировании компонента
onUnmounted(() => {
    if (searchTimeout) {
        clearTimeout(searchTimeout)
    }
})
</script>

<!-- Стили компонента -->
<style scoped lang="scss">
/* Стили для дерева сотрудников */
.employee-tree-label {
    cursor: pointer;
    padding: 0.25rem 0;
    display: block;
    width: 100%;
    transition: color 0.2s;
    /* Исключаем pointer-events для области чекбокса */
    pointer-events: none;
}

/* Включаем pointer-events для текста внутри label */
.employee-tree-label span {
    pointer-events: auto;
}

.employee-tree-label:hover {
    color: var(--primary-color);
}

:deep(.p-tree .p-tree-container .p-treenode .p-treenode-content) {
    padding: 0.5rem;
    border-radius: 0.375rem;
    transition: all 0.2s;
}

:deep(.p-tree .p-tree-container .p-treenode .p-treenode-content:hover) {
    background: var(--surface-100);
}

:deep(.p-tree .p-tree-container .p-treenode .p-treenode-content.p-treenode-selectable) {
    cursor: pointer;
}

:deep(.p-tree .p-tree-container .p-treenode .p-treenode-content .p-tree-toggler) {
    width: 1.5rem;
    height: 1.5rem;
    margin-right: 0.5rem;
}

/* Показываем чекбоксы только для листьев (сотрудников) */
:deep(.p-tree .p-tree-container .p-treenode .p-treenode-content .p-checkbox) {
    margin-right: 0.5rem;
    pointer-events: auto;
    z-index: 1;
}

/* Скрываем чекбоксы для не-листьев (отделов и должностей) */
:deep(.p-tree .p-tree-container .p-treenode:not(.p-treenode-leaf) .p-treenode-content .p-checkbox) {
    display: none;
}

/* Обеспечиваем что чекбокс кликабелен */
:deep(.p-tree .p-tree-container .p-treenode-leaf .p-treenode-content .p-checkbox) {
    pointer-events: auto !important;
    position: relative;
    z-index: 2;
}

/* Стили для wrapper узла с кнопкой */
.employee-node-wrapper {
    width: 100%;
    align-items: center;
}


/* Стили для кнопок групповых операций */
.group-select-btn,
.group-deselect-btn {
    opacity: 0;
    transition: opacity 0.2s ease;
    min-width: 1.75rem !important;
    height: 1.75rem !important;
    padding: 0 !important;
}

.group-select-btn {
    color: var(--green-600) !important;
}

.group-deselect-btn {
    color: var(--red-600) !important;
}

/* Показываем кнопки при наведении на узел */
:deep(.p-treenode-content:hover) .group-select-btn,
:deep(.p-treenode-content:hover) .group-deselect-btn {
    opacity: 1;
}

/* Всегда показываем кнопки при фокусе */
.group-select-btn:focus,
.group-deselect-btn:focus {
    opacity: 1;
}


/* Стили для выбранных участников */
.selected-users {
    border: 1px solid var(--surface-border);
    border-radius: 0.5rem;
    padding: 1rem;
    background: var(--surface-50);
    margin-top: 1rem;
}

.selected-users-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    max-height: 100px;
    overflow-y: auto;
}

.selected-user-chip {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background-color: var(--primary-100);
    color: var(--primary-700);
    padding: 0.375rem 0.75rem;
    border-radius: 1rem;
    font-size: 0.875rem;
    border: 1px solid var(--primary-200);
}

.remove-user-btn {
    width: 1.25rem !important;
    height: 1.25rem !important;
    min-width: 1.25rem !important;
    color: var(--primary-600) !important;
}

.label-small {
    font-weight: 600;
    color: var(--surface-900);
    margin-bottom: 0.5rem;
    font-size: 0.75rem;
}

/* Стили для темной темы */
:global(.dark) .label-small {
    color: var(--surface-0);
}

:global(.dark) .selected-users {
    background: var(--surface-800);
    border-color: var(--surface-600);
}

:global(.dark) :deep(.p-tree .p-tree-container .p-treenode .p-treenode-content:hover) {
    background: var(--surface-700);
}

</style>

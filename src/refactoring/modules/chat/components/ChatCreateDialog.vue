<template>
    <Dialog
        :visible="visible"
        header="Создать чат"
        :modal="true"
        :style="{ width: '600px', maxHeight: '90vh' }"
        :appendTo="'body'"
        :baseZIndex="9995"
        class="sliding-chat-modal"
        @update:visible="$emit('update:visible', $event)"
    >
        <div class="space-y-6 max-h-[70vh] overflow-y-auto">
            <!-- Тип чата -->
            <div>
                <div class="label">Тип чата</div>
                <div class="flex items-center gap-3">
                    <Button
                        :severity="chatType === 'group' ? 'primary' : 'secondary'"
                        :text="chatType !== 'group'"
                        @click="chatType = 'group'"
                        class="flex-1"
                    >
                        <i class="pi pi-users mr-2" />
                        <div class="text-left">
                            <div class="font-semibold">Группа</div>
                            <div class="text-xs opacity-75">Для командной работы и обсуждений</div>
                        </div>
                    </Button>
                    <Button
                        :severity="chatType === 'channel' ? 'primary' : 'secondary'"
                        :text="chatType !== 'channel'"
                        @click="chatType = 'channel'"
                        class="flex-1"
                    >
                        <i class="pi pi-megaphone mr-2" />
                        <div class="text-left">
                            <div class="font-semibold">Канал</div>
                            <div class="text-xs opacity-75">Для объявлений и новостей</div>
                        </div>
                    </Button>
                </div>
            </div>

            <!-- Название -->
            <div>
                <div class="label">
                    Название
                    <span class="text-red-500">*</span>
                </div>
                <app-inputtext
                    v-model="chatTitle"
                    :placeholder="chatType === 'group' ? 'Название группы' : 'Название канала'"
                    class="w-full"
                    :class="{ 'p-invalid': shouldShowTitleError }"
                    @blur="onTitleBlur"
                />
                <small
                    v-if="shouldShowTitleError"
                    class="p-error text-[#ff5252] mt-2 ml-2 inline-block"
                    >{{ titleError }}</small
                >
            </div>

            <!-- Описание -->
            <div>
                <div class="label">Описание</div>
                <textarea
                    v-model="chatDescription"
                    rows="3"
                    class="p-inputtext p-inputtextarea w-full"
                    :placeholder="
                        chatType === 'group' ? 'Краткое описание группы' : 'Краткое описание канала'
                    "
                ></textarea>
            </div>

            <!-- Иконка -->
            <div>
                <div class="label">Иконка</div>
                <div class="flex items-start gap-3">
                    <div v-if="iconPreview" class="icon-preview">
                        <img :src="iconPreview" alt="icon" />
                        <Button
                            icon="pi pi-times"
                            size="small"
                            severity="danger"
                            text
                            rounded
                            class="remove-icon-btn"
                            @click="removeIcon"
                            v-tooltip.top="'Удалить иконку'"
                        />
                    </div>

                    <div class="flex flex-col gap-2">
                        <Button
                            icon="pi pi-upload"
                            label="Выбрать файл"
                            severity="secondary"
                            outlined
                            size="small"
                            @click="fileInput?.click()"
                        />
                        <small class="text-surface-500 text-xs">
                            Поддерживаются: JPG, PNG, GIF (макс. 5 МБ)
                        </small>
                    </div>

                    <input
                        ref="fileInput"
                        type="file"
                        accept="image/*"
                        class="hidden"
                        @change="onIconSelect"
                    />
                </div>
            </div>

            <!-- Дополнительные настройки -->
            <div class="bg-surface-50 dark:bg-surface-800 p-3 rounded-md">
                <div class="flex items-center justify-between mb-2">
                    <label class="font-medium text-sm">Дополнительные настройки</label>
                </div>

                <!-- Добавить участников сразу -->
                <div class="flex items-center gap-2 mb-2">
                    <Checkbox v-model="addMembersImmediately" binary />
                    <label
                        class="text-sm cursor-pointer"
                        @click="addMembersImmediately = !addMembersImmediately"
                    >
                        Добавить участников сейчас
                    </label>
                </div>

                <small class="text-surface-500 text-xs">
                    Если включено, можно выбрать участников прямо при создании
                    {{ chatType === 'group' ? 'группы' : 'канала' }}.
                </small>
            </div>

            <!-- Секция выбора участников -->
            <div v-if="addMembersImmediately" class="member-selection-section">
                <div class="flex items-center justify-between mb-2">
                    <div class="label">Участники</div>
                    <div v-if="selectedUsers.length > 0" class="text-sm text-surface-600">
                        Выбrano: {{ selectedUsers.length }}
                    </div>
                </div>

                <!-- Поиск пользователей -->
                <div class="mb-3">
                    <app-inputtext
                        v-model="searchQuery"
                        placeholder="Введите 2 или более символа для поиска"
                        class="w-full"
                        ref="searchInputRef"
                    />
                </div>

                <!-- Дерево сотрудников -->
                <div class="employee-tree-container">
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
                            <div
                                class="employee-node-wrapper flex items-center justify-between w-full"
                            >
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
                                        :disabled="isSearching"
                                        size="small"
                                        v-tooltip.left="'Выбрать всех'"
                                    />
                                    <Button
                                        icon="pi pi-minus-circle"
                                        class="p-button-rounded p-button-text p-button-sm group-deselect-btn"
                                        @click="deselectAllInGroup(node, $event)"
                                        :disabled="isSearching"
                                        size="small"
                                        v-tooltip.left="'Снять выбор со всех'"
                                    />
                                </div>
                            </div>
                        </template>
                    </Tree>
                </div>

                <!-- Выбранные участники -->
                <div v-if="selectedUsers.length > 0" class="selected-users mt-2">
                    <div class="flex items-center justify-between mb-2">
                        <div class="label-small">
                            Выбранные участники ({{ selectedUsers.length }})
                        </div>
                        <div class="flex gap-2">
                            <!-- <Button
                                icon="pi pi-check-square"
                                label="Выбрать всех"
                                size="small"
                                severity="success"
                                outlined
                                @click="selectAllEmployees"
                                :disabled="isSearching"
                                v-tooltip.top="'Выбрать всех сотрудников'"
                            /> -->
                            <Button
                                icon="pi pi-times-circle"
                                label="Очистить"
                                size="small"
                                severity="danger"
                                outlined
                                @click="clearAllSelection"
                                :disabled="isSearching"
                                v-tooltip.top="'Очистить выбор'"
                            />
                        </div>
                    </div>
                    <div class="selected-users-list">
                        <div
                            v-for="user in selectedUsers"
                            :key="user.id"
                            class="selected-user-chip"
                        >
                            <span>{{ user.full_name }}</span>
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

            <!-- Кнопки -->
            <div class="flex justify-end gap-2 pt-2">
                <Button
                    label="Отмена"
                    severity="secondary"
                    text
                    @click="closeDialog"
                    :disabled="isCreating"
                />
                <Button
                    :label="createButtonLabel"
                    :disabled="!canSave || isCreating"
                    :loading="isCreating"
                    @click="createChat"
                />
            </div>
        </div>
    </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick, onUnmounted } from 'vue'
import { debounce } from 'lodash-es'
import { useApiStore } from '@/refactoring/modules/apiStore/stores/apiStore'
import type { IEmployee } from '@/refactoring/modules/apiStore/types/employees/IEmployee'
import { ITreeNode } from '@/refactoring/modules/apiStore/types/ITreeNode'

interface Props {
    visible: boolean
}

interface Emits {
    (e: 'update:visible', visible: boolean): void
    (
        e: 'create',
        payload: {
            type: 'group' | 'channel'
            title: string
            description: string
            icon: File | null
            addMembersImmediately: boolean
            selectedUsers: Array<{
                id: string
                full_name: string
                position: string | null
                department: { id: string; name: string } | null
            }>
        },
    ): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Хранилище
const apiStore = useApiStore()

// Ссылки на элементы
const fileInput = ref<HTMLInputElement | null>(null)
const searchInputRef = ref<HTMLInputElement | { $el?: HTMLElement } | null>(null)

// Состояние формы
const chatType = ref<'group' | 'channel'>('group')
const chatTitle = ref('')
const chatDescription = ref('')
const iconFile = ref<File | null>(null)
const iconPreview = ref<string | null>(null)
const addMembersImmediately = ref(false)
const isCreating = ref(false)

// Состояние валидации
const titleTouched = ref(false)
const submitAttempted = ref(false)

// Состояние выбора пользователей - обновлено для работы с деревом
const searchQuery = ref('')
const searchQueryDebounced = ref('') // Фактический запрос для поиска (с дебаунсом)
const treeNodes = ref<any[]>([]) // Узлы дерева сотрудников
const selectedKeys = ref<Record<string, boolean>>({}) // Выбранные ключи в дереве
const selectedUsers = ref<
    Array<{
        id: string
        full_name: string
        position: string | null
        department: { id: string; name: string } | null
    }>
>([])
const isSearching = ref(false)
const expandedKeys = ref<Record<string, boolean>>({})

// Таймер для дебаунса
let searchTimeout: number | null = null
let cleanupFocusHandlers: (() => void) | null = null

// Валидация
const titleError = computed(() => {
    if (!chatTitle.value.trim()) {
        return 'Название обязательно для заполнения'
    }
    if (chatTitle.value.trim().length < 2) {
        return 'Название должно содержать минимум 2 символа'
    }
    if (chatTitle.value.trim().length > 100) {
        return 'Название не может быть длиннее 100 символов'
    }
    return null
})

// Показывать ошибку только при blur или попытке отправки
const shouldShowTitleError = computed(() => {
    return (titleTouched.value || submitAttempted.value) && titleError.value !== null
})

const canSave = computed(() => {
    return !!chatTitle.value.trim() && !titleError.value && !isCreating.value
})

const createButtonLabel = computed(() => {
    if (isCreating.value) {
        return chatType.value === 'group' ? 'Создание группы...' : 'Создание канала...'
    }
    return chatType.value === 'group' ? 'Создать группу' : 'Создать канал'
})

// Вычисляемые свойства для работы с деревом пользователей
const filteredTree = computed(() => {
    // Всегда показываем полное дерево, если поиск пустой или менее 2 символов
    if (!searchQueryDebounced.value || searchQueryDebounced.value.length < 2) return treeNodes.value
    const lower = searchQueryDebounced.value.toLowerCase()

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

const isUserSelected = (user: { id: string }) => {
    return selectedUsers.value.some((selected) => selected.id === user.id)
}

// Функции для групповых операций
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
    // Вызываем onSelectionChange для синхронизации состояния
    onSelectionChange({})
}

// Обработчики событий
const onTitleBlur = () => {
    titleTouched.value = true
}

const onIconSelect = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0] || null

    if (file) {
        // Проверяем размер файла (5 МБ)
        if (file.size > 5 * 1024 * 1024) {
            alert('Размер файла не должен превышать 5 МБ')
            return
        }

        // Проверяем тип файла
        if (!file.type.startsWith('image/')) {
            alert('Можно загружать только изображения')
            return
        }

        iconFile.value = file

        // Создаем превью
        const reader = new FileReader()
        reader.onload = () => {
            iconPreview.value = String(reader.result || '')
        }
        reader.readAsDataURL(file)
    } else {
        removeIcon()
    }

    // Очищаем input
    if (fileInput.value) {
        fileInput.value.value = ''
    }
}

const removeIcon = () => {
    iconFile.value = null
    iconPreview.value = null
    if (fileInput.value) {
        fileInput.value.value = ''
    }
}

const createChat = async () => {
    // Устанавливаем флаг попытки отправки - это покажет все ошибки
    submitAttempted.value = true

    // Проверяем валидность после установки флага
    if (!canSave.value) return

    isCreating.value = true

    try {
        emit('create', {
            type: chatType.value,
            title: chatTitle.value.trim(),
            description: chatDescription.value.trim(),
            icon: iconFile.value,
            addMembersImmediately: addMembersImmediately.value,
            selectedUsers: selectedUsers.value,
        })

        closeDialog()
    } catch (error) {
        // Ошибка обрабатывается в родительском компоненте
    } finally {
        isCreating.value = false
    }
}

const closeDialog = () => {
    emit('update:visible', false)
    resetForm()
}

const resetForm = () => {
    chatType.value = 'group'
    chatTitle.value = ''
    chatDescription.value = ''
    iconFile.value = null
    iconPreview.value = null
    addMembersImmediately.value = false
    isCreating.value = false

    // Сброс состояния валидации
    titleTouched.value = false
    submitAttempted.value = false

    // Сброс выбора пользователей
    searchQuery.value = ''
    searchQueryDebounced.value = ''
    selectedKeys.value = {}
    selectedUsers.value = []
    isSearching.value = false
    expandedKeys.value = {}
    // Не сбрасываем treeNodes.value, так как они нужны для отображения дерева
}

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

// Функции для работы с выбором пользователей

const removeUserFromSelection = (user: { id: string }) => {
    const index = selectedUsers.value.findIndex((selected) => selected.id === user.id)
    if (index >= 0) {
        selectedUsers.value.splice(index, 1)

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

// Tree node management functions
const onSelectionChange = (val: Record<string, boolean>) => {
    // Обрабатываем изменения выбора в дереве с чекбоксами
    const newSelectedUsers: Array<{
        id: string
        full_name: string
        position: string | null
        department: { id: string; name: string } | null
    }> = []

    // Рекурсивно обходим дерево и находим выбранных сотрудников
    const processNode = (node: any) => {
        if (node.isLeaf && node.data && val[node.key]) {
            const employee = node.data as IEmployee
            newSelectedUsers.push({
                id: employee.id,
                full_name:
                    `${employee.last_name} ${employee.first_name} ${employee.middle_name || ''}`.trim(),
                position: employee.position?.name || null,
                department: employee.department
                    ? {
                          id: employee.department.id,
                          name: employee.department.name,
                      }
                    : null,
            })
        }

        if (node.children) {
            node.children.forEach(processNode)
        }
    }

    // Обрабатываем все узлы дерева
    treeNodes.value.forEach(processNode)

    // Обновляем список выбранных пользователей
    selectedUsers.value = newSelectedUsers
}

const handleNodeLabelClick = (node: any, event: MouseEvent) => {
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
const onNodeExpand = (node: any) => {
    if (node?.key) {
        expandedKeys.value = { ...expandedKeys.value, [node.key]: true }
    }
}

const onNodeCollapse = (node: any) => {
    if (node?.key) {
        const newKeys = { ...expandedKeys.value }
        delete newKeys[node.key]
        expandedKeys.value = newKeys
    }
}

// Возвращает исходный текст без подсветки
const highlightMatch = (label: string = '', q: string = '') => {
    return label
}

// Строит объект expandedKeys на основе дерева
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

// Focus management
const startFocusEnforcer = (input: HTMLInputElement, durationMs = 1200) => {
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

const focusSearch = () => {
    nextTick(() => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const dialog = document.querySelector('.sliding-chat-modal') as HTMLElement | null
                if (!dialog) return

                const input = dialog.querySelector(
                    'input[type="text"].p-inputtext',
                ) as HTMLInputElement | null
                if (!input) return

                // Убираем перехват фокуса у крестика
                const closeBtn = dialog.querySelector(
                    '.p-dialog-header-close',
                ) as HTMLButtonElement | null
                closeBtn?.removeAttribute('autofocus')
                closeBtn?.setAttribute('tabindex', '-1')

                // Возврат фокуса при любых фокус-событиях внутри диалога
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

                // Упорный цикл до стабилизации
                const stopEnforce = startFocusEnforcer(input, 1200)

                // Начальный фокус
                focusBack()

                // Очистка
                cleanupFocusHandlers = () => {
                    dialog.removeEventListener('focusin', onFocusIn, true)
                    stopEnforce()
                }
            })
        })
    })
}

// Следим за изменением списка сотрудников и обновляем дерево
watch(
    () => apiStore.employees,
    (val) => {
        treeNodes.value = buildEmployeeTree(val)
    },
    { immediate: true },
)

// Реакция на ввод в поле поиска с дебаунсом и минимальной длиной
watch(searchQuery, (val) => {
    const q = (val || '').toLowerCase().trim()
    const roots = treeNodes.value as ITreeNode[]

    // Очищаем предыдущий таймаут
    if (searchTimeout) {
        clearTimeout(searchTimeout)
        searchTimeout = null
    }

    // Если поиск пустой - сразу сбрасываем
    if (!q) {
        searchQueryDebounced.value = ''
        expandedKeys.value = buildExpandedState(roots, {})
        return
    }

    // Если меньше 2 символов - не выполняем поиск, но сбрасываем предыдущие результаты
    if (q.length < 2) {
        searchQueryDebounced.value = ''
        expandedKeys.value = buildExpandedState(roots, {})
        return
    }

    // Для 2+ символов - устанавливаем таймаут дебаунса
    searchTimeout = setTimeout(() => {
        searchQueryDebounced.value = q

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

// Сброс формы при закрытии диалога
watch(
    () => props.visible,
    (visible) => {
        if (visible && addMembersImmediately.value) {
            focusSearch()
        } else if (!visible) {
            searchQuery.value = ''
            expandedKeys.value = buildExpandedState(treeNodes.value, {})
            cleanupFocusHandlers?.()
            cleanupFocusHandlers = null
            resetForm()
        }
    },
)

// Очистка при размонтировании компонента
onUnmounted(() => {
    if (searchTimeout) {
        clearTimeout(searchTimeout)
    }
    cleanupFocusHandlers?.()
})
</script>

<style scoped>
.icon-preview {
    position: relative;
    width: 64px;
    height: 64px;
    border-radius: 8px;
    overflow: hidden;
    border: 2px solid var(--p-content-border-color);
    flex-shrink: 0;
}

.icon-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.remove-icon-btn {
    position: absolute;
    top: -8px;
    right: -8px;
    width: 24px !important;
    height: 24px !important;
    min-width: 24px !important;
}

.icon-placeholder {
    width: 64px;
    height: 64px;
    border: 2px dashed var(--p-surface-300);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--p-surface-100);
    flex-shrink: 0;
}

.space-y-4 > * + * {
    margin-top: 1rem;
}

.label {
    font-weight: 600;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
}

:global(.dark) .label {
    color: var(--p-surface-0);
}

:global(.dark) .icon-placeholder {
    background: var(--p-surface-800);
    border-color: var(--p-surface-600);
}

/* Улучшенные стили для кнопок выбора типа */
.flex.items-center.gap-3 .p-button {
    padding: 1rem;
    border-radius: 8px;
    text-align: left;
    justify-content: flex-start;
    min-height: 80px;
    transition: all 0.2s ease;
}

.flex.items-center.gap-3 .p-button:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.flex.items-center.gap-3 .p-button.p-button-primary {
    background: var(--p-primary-color);
    border-color: var(--p-primary-color);
}

.flex.items-center.gap-3 .p-button .pi {
    font-size: 1.25rem;
}

/* Стили для дерева сотрудников */
.employee-tree-container {
    border: 1px solid var(--surface-border);
    border-radius: 0.5rem;
    background: var(--surface-0);
    height: 200px;
    overflow-y: auto;
}

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



/* Стили для секции выбора участников */
.member-selection-section {
    border: 1px solid var(--surface-border);
    border-radius: 0.5rem;
    padding: 1rem;
    background: var(--surface-50);
}

.member-search-results {
    border: 1px solid var(--surface-border);
    border-radius: 0.5rem;
    background: var(--surface-0);
}

.search-results-container {
    height: 200px;
    display: flex;
    flex-direction: column;
}

.user-list {
    flex: 1;
    overflow-y: auto;
    padding: 0.25rem 0;
}

.user-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    cursor: pointer;
    border-radius: 0.5rem;
    transition: all 0.2s;
    border-bottom: 1px solid var(--surface-border);
}

.user-item:hover {
    background-color: var(--surface-100);
}


.user-item--selected {
    background-color: var(--primary-50);
    border-color: var(--primary-200);
}

.user-item:last-child {
    border-bottom: none;
}

.user-avatar {
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    background-color: var(--surface-200);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-color-secondary);
    flex-shrink: 0;
}

.user-name {
    font-weight: 500;
    color: var(--text-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.user-info {
    font-size: 0.875rem;
    color: var(--text-color-secondary);
    display: flex;
    gap: 0.5rem;
}

.position,
.department {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.selected-users-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
}

.selected-user-chip {
    display: flex;
    align-items: center;
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
}

.label-small {
    font-weight: 600;
    color: var(--surface-900);
    margin-bottom: 0.5rem;
    font-size: 0.75rem;
}

:global(.dark) .label-small {
    color: var(--surface-0);
}

/* Стили для темной темы */
:global(.dark) .employee-tree-container {
    border-color: var(--surface-600);
    background: var(--surface-900);
}

:global(.dark) :deep(.p-tree .p-tree-container .p-treenode .p-treenode-content:hover) {
    background: var(--surface-700);
}


:global(.dark) .member-selection-section {
    background: var(--surface-800);
    border-color: var(--surface-600);
}

:global(.dark) .user-item--selected {
    background-color: var(--primary-900);
    border-color: var(--primary-700);
}

/* Адаптивные стили */
@media (max-width: 640px) {
    .flex.items-center.gap-3 {
        flex-direction: column;
        gap: 0.75rem;
    }

    .flex.items-center.gap-3 .p-button {
        width: 100%;
        min-height: 60px;
        padding: 0.75rem;
    }

    .icon-preview,
    .icon-placeholder {
        width: 48px;
        height: 48px;
    }

    .search-results-container {
        height: 150px;
    }

    .user-avatar {
        width: 1.75rem;
        height: 1.75rem;
    }
}
</style>

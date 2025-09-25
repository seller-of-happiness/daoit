<template>
    <!-- Диалог фильтров документов -->
    <Dialog
        v-model:visible="visible"
        header="Фильтры документов"
        :modal="true"
        :style="{ width: '700px', minHeight: '500px' }"
        class="document-filters-modal"
    >
        <div class="space-y-6">
            <!-- Фильтр по создателям -->
            <div class="filter-section">
                <h4 class="filter-title">Создатели документов</h4>
                <div class="mb-4">
                    <InputText
                        v-model="creatorSearch"
                        placeholder="Введите 2 или более символов для поиска"
                        class="w-full"
                    />
                </div>

                <!-- Дерево создателей -->
                <div class="employee-tree-container">
                    <Tree
                        :value="filteredCreatorTree"
                        selectionMode="checkbox"
                        v-model:selectionKeys="selectedCreatorKeys"
                        @update:selectionKeys="onCreatorSelectionChange"
                        class="w-full employee-tree"
                        :filter="false"
                        filterMode="str"
                        :expandedKeys="expandedCreatorKeys"
                        @node-expand="onCreatorNodeExpand"
                        @node-collapse="onCreatorNodeCollapse"
                        :metaKeySelection="false"
                    >
                        <template #default="{ node }">
                            <div class="employee-node-wrapper flex items-center justify-between w-full">
                                <span
                                    class="employee-tree-label flex-1"
                                    @click="handleCreatorNodeLabelClick(node, $event)"
                                >
                                    <span v-html="highlightMatch(node.label, creatorSearchQuery)"></span>
                                </span>
                                <!-- Кнопки для групповых операций с отделами и должностями -->
                                <div v-if="!node.isLeaf && node.children" class="flex gap-1">
                                    <Button
                                        icon="pi pi-check-square"
                                        class="p-button-rounded p-button-text p-button-sm group-select-btn"
                                        @click="selectAllInGroup(node, $event)"
                                        size="small"
                                        v-tooltip.left="'Выбрать всех'"
                                    />
                                    <Button
                                        icon="pi pi-minus-circle"
                                        class="p-button-rounded p-button-text p-button-sm group-deselect-btn"
                                        @click="deselectAllInGroup(node, $event)"
                                        size="small"
                                        v-tooltip.left="'Снять выбор со всех'"
                                    />
                                </div>
                                <!-- Кнопка добавления для сотрудников (листьев дерева) -->
                                <Button
                                    v-if="node.isLeaf"
                                    icon="pi pi-plus"
                                    class="p-button-rounded p-button-text p-button-sm employee-add-btn"
                                    @click="addCreator(node, $event)"
                                    :disabled="isCreatorSelected(node.data?.id)"
                                    size="small"
                                    v-tooltip.left="'Добавить создателя'"
                                />
                            </div>
                        </template>
                    </Tree>
                </div>

                <!-- Управление выбором -->
                <div class="mt-3">
                    <div class="flex items-center justify-between mb-2">
                        <div class="text-sm text-surface-600 dark:text-surface-400">
                            Выбрано: {{ selectedCreators.length }}
                        </div>
                        <div class="flex gap-2">
                            <Button
                                icon="pi pi-check-square"
                                label="Выбрать всех"
                                size="small"
                                severity="success"
                                outlined
                                @click="selectAllCreators"
                                v-tooltip.top="'Выбрать всех сотрудников'"
                            />
                            <Button
                                icon="pi pi-times-circle"
                                label="Очистить"
                                size="small"
                                severity="danger"
                                outlined
                                @click="clearAllCreators"
                                :disabled="selectedCreators.length === 0"
                                v-tooltip.top="'Очистить выбор'"
                            />
                        </div>
                    </div>
                </div>

                <!-- Выбранные создатели -->
                <div v-if="selectedCreators.length > 0" class="mt-2">
                    <div class="text-sm font-medium mb-2">Выбранные создатели:</div>
                    <div class="flex flex-wrap gap-2 max-h-[100px] overflow-y-auto">
                        <Chip
                            v-for="creator in selectedCreators"
                            :key="creator.id"
                            :label="getCreatorDisplayName(creator)"
                            removable
                            @remove="removeCreator(creator.id)"
                            class="text-sm"
                        />
                    </div>
                </div>
            </div>

            <!-- Фильтр по типам документов -->
            <div class="filter-section">
                <h4 class="filter-title">Типы документов</h4>
                <div class="types-list max-h-[200px] overflow-y-auto border border-surface-200 dark:border-surface-700 rounded-lg p-3">
                    <div
                        v-for="type in documentTypes"
                        :key="type.id"
                        class="type-item flex items-center justify-between p-2 hover:bg-surface-50 dark:hover:bg-surface-800 rounded transition-colors cursor-pointer"
                        @click="toggleDocumentType(type.id)"
                    >
                        <div class="flex items-center gap-3">
                            <Checkbox
                                :modelValue="isTypeSelected(type.id)"
                                @update:modelValue="toggleDocumentType(type.id)"
                                :binary="true"
                            />
                            <span class="type-name">{{ type.name }}</span>
                        </div>
                    </div>

                    <!-- Пустое состояние -->
                    <div
                        v-if="documentTypes.length === 0"
                        class="text-center py-8 text-surface-500"
                    >
                        <i class="pi pi-file text-4xl mb-4 block"></i>
                        <div>Типы документов не найдены</div>
                    </div>
                </div>

                <!-- Выбранные типы -->
                <div v-if="selectedTypes.length > 0" class="mt-4">
                    <div class="text-sm font-medium mb-2">Выбранные типы:</div>
                    <div class="flex flex-wrap gap-2">
                        <Chip
                            v-for="typeId in selectedTypes"
                            :key="typeId"
                            :label="getTypeName(typeId)"
                            removable
                            @remove="removeType(typeId)"
                            class="text-sm"
                        />
                    </div>
                </div>
            </div>
        </div>

        <!-- Кнопки действий -->
        <template #footer>
            <div class="flex justify-between items-center gap-3">
                <!-- Счетчик активных фильтров -->
                <div class="text-sm text-surface-600 dark:text-surface-400">
                    Активных фильтров: {{ activeFiltersCount }}
                </div>
                
                <div class="flex gap-2">
                    <!-- Кнопка очистки всех фильтров -->
                    <Button
                        label="Очистить все"
                        icon="pi pi-refresh"
                        text
                        @click="clearAllFilters"
                        :disabled="activeFiltersCount === 0"
                    />
                    
                    <!-- Кнопка отмены -->
                    <Button
                        label="Отмена"
                        icon="pi pi-times"
                        text
                        @click="closeDialog"
                    />

                    <!-- Кнопка применения фильтров -->
                    <Button
                        label="Применить"
                        icon="pi pi-check"
                        @click="applyFilters"
                    />
                </div>
            </div>
        </template>
    </Dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed, nextTick, onUnmounted } from 'vue'
import { useApiStore } from '@/refactoring/modules/apiStore/stores/apiStore'
import { storeToRefs } from 'pinia'
import type { IEmployee } from '@/refactoring/modules/apiStore/types/employees/IEmployee'
import { ITreeNode } from '@/refactoring/modules/apiStore/types/ITreeNode'
import type { IDocumentType } from '@/refactoring/modules/documents/types/IDocument'

// Определение пропсов и событий компонента
const props = defineProps<{
    visible: boolean
    documentTypes: IDocumentType[]
    initialCreators?: string[]
    initialTypes?: number[]
}>()

// Определение событий компонента
const emit = defineEmits(['update:visible', 'apply-filters'])

// Модель видимости модального окна
const visible = defineModel<boolean>('visible')

// Инициализация хранилищ и утилит
const apiStore = useApiStore()
const { employees } = storeToRefs(apiStore)

// Реактивные переменные для фильтра по создателям
const creatorTreeNodes = ref<any[]>([])
const creatorSearch = ref('')
const creatorSearchQuery = ref('')
const selectedCreatorKeys = ref<Record<string, boolean>>({})
const selectedCreators = ref<IEmployee[]>([])
const expandedCreatorKeys = ref<Record<string, boolean>>({})

// Реактивные переменные для фильтра по типам
const selectedTypes = ref<number[]>([])

// Таймер для дебаунса поиска создателей
let creatorSearchTimeout: number | null = null

// Вычисляемые свойства
const selectedCreatorIds = computed(() => selectedCreators.value.map(c => c.id))

const activeFiltersCount = computed(() => {
    return selectedCreators.value.length + selectedTypes.value.length
})

/**
 * Строит иерархическое дерево сотрудников по отделам и должностям
 */
function buildCreatorTree(employeesList: IEmployee[]) {
    const depMap: Record<string, any> = {}
    const noDepMap: Record<string, IEmployee[]> = {}

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

// Следим за изменением списка сотрудников и обновляем дерево
watch(
    () => employees.value,
    val => {
        creatorTreeNodes.value = buildCreatorTree(val)
    },
    { immediate: true }
)

// Фильтрация дерева создателей по поисковому запросу
const filteredCreatorTree = computed(() => {
    if (!creatorSearchQuery.value || creatorSearchQuery.value.length < 2) return creatorTreeNodes.value
    const lower = creatorSearchQuery.value.toLowerCase()

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

    return filterTree(creatorTreeNodes.value)
})

// Функции для работы с создателями
const isCreatorSelected = (creatorId?: string): boolean => {
    return creatorId ? selectedCreatorIds.value.includes(creatorId) : false
}

const getCreatorDisplayName = (creator: IEmployee): string => {
    const { first_name, last_name, middle_name } = creator
    return [first_name, middle_name, last_name].filter(Boolean).join(' ') || 'Пользователь'
}

const addCreator = (node: any, event: MouseEvent) => {
    event.stopPropagation()
    
    if (!node.isLeaf || !node.data) return
    
    const creator = node.data as IEmployee
    
    if (selectedCreatorIds.value.includes(creator.id)) {
        return
    }
    
    selectedCreators.value.push(creator)
    
    // Также выделяем соответствующий узел в дереве
    selectedCreatorKeys.value = {
        ...selectedCreatorKeys.value,
        [node.key]: true
    }
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
    const newSelectedKeys = { ...selectedCreatorKeys.value }
    
    employees.forEach(emp => {
        if (!isCreatorSelected(emp.data.id)) {
            newSelectedKeys[emp.key] = true
        }
    })
    
    selectedCreatorKeys.value = newSelectedKeys
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
    const newSelectedKeys = { ...selectedCreatorKeys.value }
    
    employees.forEach(emp => {
        delete newSelectedKeys[emp.key]
    })
    
    selectedCreatorKeys.value = newSelectedKeys
}

const removeCreator = (creatorId: string, event?: MouseEvent) => {
    if (event) {
        event.stopPropagation()
    }
    selectedCreators.value = selectedCreators.value.filter(c => c.id !== creatorId)
    
    // Также снимаем выделение с соответствующего узла в дереве
    const findAndDeselectNode = (nodes: any[]): boolean => {
        for (const node of nodes) {
            if (node.isLeaf && node.data && node.data.id === creatorId) {
                // Снимаем выделение с узла
                const newSelectedKeys = { ...selectedCreatorKeys.value }
                delete newSelectedKeys[node.key]
                selectedCreatorKeys.value = newSelectedKeys
                return true
            }
            if (node.children && findAndDeselectNode(node.children)) {
                return true
            }
        }
        return false
    }
    
    findAndDeselectNode(creatorTreeNodes.value)
}

// Глобальные функции выбора
const selectAllCreators = () => {
    const newSelectedKeys: Record<string, boolean> = {}
    
    const collectAllEmployees = (nodes: any[]) => {
        nodes.forEach(node => {
            if (node.isLeaf && node.data) {
                newSelectedKeys[node.key] = true
            }
            if (node.children) {
                collectAllEmployees(node.children)
            }
        })
    }
    
    collectAllEmployees(filteredCreatorTree.value.length ? filteredCreatorTree.value : creatorTreeNodes.value)
    selectedCreatorKeys.value = newSelectedKeys
}

const clearAllCreators = () => {
    selectedCreatorKeys.value = {}
    selectedCreators.value = []
}

const onCreatorSelectionChange = (val: Record<string, boolean>) => {
    // Обрабатываем изменения выбора в дереве с чекбоксами
    const newSelectedCreators: IEmployee[] = []

    // Рекурсивно обходим дерево и находим выбранных создателей
    const processNode = (node: any) => {
        if (node.isLeaf && node.data && val[node.key]) {
            const employee = node.data as IEmployee
            newSelectedCreators.push(employee)
        }
        
        if (node.children) {
            node.children.forEach(processNode)
        }
    }

    // Обрабатываем все узлы дерева
    creatorTreeNodes.value.forEach(processNode)
    
    // Обновляем список выбранных создателей
    selectedCreators.value = newSelectedCreators
}

const handleCreatorNodeLabelClick = (node: any, event: MouseEvent) => {
    if (node?.children && node?.key) {
        event.stopPropagation()
        expandedCreatorKeys.value = {
            ...expandedCreatorKeys.value,
            [node.key]: !expandedCreatorKeys.value[node.key]
        }
        return
    }
}

const onCreatorNodeExpand = (node: any) => {
    if (node?.key) {
        expandedCreatorKeys.value = { ...expandedCreatorKeys.value, [node.key]: true }
    }
}

const onCreatorNodeCollapse = (node: any) => {
    if (node?.key) {
        const newKeys = { ...expandedCreatorKeys.value }
        delete newKeys[node.key]
        expandedCreatorKeys.value = newKeys
    }
}

// Функции для работы с типами документов
const isTypeSelected = (typeId: number): boolean => {
    return selectedTypes.value.includes(typeId)
}

const toggleDocumentType = (typeId: number) => {
    if (selectedTypes.value.includes(typeId)) {
        selectedTypes.value = selectedTypes.value.filter(id => id !== typeId)
    } else {
        selectedTypes.value.push(typeId)
    }
}

const removeType = (typeId: number) => {
    selectedTypes.value = selectedTypes.value.filter(id => id !== typeId)
}

const getTypeName = (typeId: number): string => {
    const type = props.documentTypes.find(t => t.id === typeId)
    return type?.name || `Тип ${typeId}`
}

// Основные функции диалога
const applyFilters = () => {
    emit('apply-filters', {
        created_by: selectedCreatorIds.value,
        types: selectedTypes.value
    })
    visible.value = false
}

const clearAllFilters = () => {
    clearAllCreators()
    selectedTypes.value = []
    creatorSearch.value = ''
    creatorSearchQuery.value = ''
}

const closeDialog = () => {
    visible.value = false
}

// Подсветка совпадений поиска
const highlightMatch = (label: string = '', q: string = '') => {
    if (!q) return label
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return label.replace(new RegExp(`(${safe})`, 'ig'), '<mark>$1</mark>')
}

// Поиск создателей с дебаунсом
watch(creatorSearch, (val) => {
    const q = (val || '').toLowerCase().trim()

    if (creatorSearchTimeout) {
        clearTimeout(creatorSearchTimeout)
        creatorSearchTimeout = null
    }

    if (!q) {
        creatorSearchQuery.value = ''
        expandedCreatorKeys.value = {}
        return
    }

    if (q.length < 2) {
        creatorSearchQuery.value = ''
        expandedCreatorKeys.value = {}
        return
    }

    creatorSearchTimeout = setTimeout(() => {
        creatorSearchQuery.value = q
        
        // Автоматически раскрываем узлы с найденными совпадениями
        const toExpand: Record<string, boolean> = {}
        const dfs = (node: ITreeNode, parents: string[]) => {
            const label = (node.label || '').toLowerCase()
            if (label.includes(q)) parents.forEach(k => { toExpand[k] = true })
            node.children?.forEach((ch) => dfs(ch, [...parents, node.key]))
        }
        creatorTreeNodes.value.forEach((n) => dfs(n, []))
        expandedCreatorKeys.value = toExpand
        
        creatorSearchTimeout = null
    }, 300)
})

// Инициализация с начальными значениями
watch(
    () => props.initialCreators,
    (newCreators) => {
        if (newCreators && newCreators.length > 0) {
            selectedCreators.value = employees.value.filter(emp => 
                newCreators.includes(emp.id)
            )
        }
    },
    { immediate: true }
)

watch(
    () => props.initialTypes,
    (newTypes) => {
        if (newTypes && newTypes.length > 0) {
            selectedTypes.value = [...newTypes]
        }
    },
    { immediate: true }
)

// Сброс при открытии/закрытии
watch(visible, (v) => {
    if (!v) {
        creatorSearch.value = ''
        creatorSearchQuery.value = ''
        expandedCreatorKeys.value = {}
    }
})

// Очистка при размонтировании
onUnmounted(() => {
    if (creatorSearchTimeout) {
        clearTimeout(creatorSearchTimeout)
    }
})
</script>

<style scoped lang="scss">
.filter-section {
    @apply border border-surface-200 dark:border-surface-700 rounded-lg p-4;
}

.filter-title {
    @apply text-lg font-semibold mb-3 text-surface-900 dark:text-surface-0;
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

:deep(.p-tree .p-tree-container .p-treenode .p-treenode-content .p-tree-toggler) {
    width: 1.5rem;
    height: 1.5rem;
    margin-right: 0.5rem;
}

/* Показываем чекбоксы только для листьев (сотрудников) */
:deep(.p-tree .p-tree-container .p-treenode .p-treenode-content .p-checkbox) {
    margin-right: 0.5rem;
}

/* Скрываем чекбоксы для не-листьев (отделов и должностей) */
:deep(.p-tree .p-tree-container .p-treenode:not(.p-treenode-leaf) .p-treenode-content .p-checkbox) {
    display: none;
}

/* Стили для wrapper узла с кнопкой */
.employee-node-wrapper {
    width: 100%;
    align-items: center;
}

/* Стили для кнопки добавления сотрудника */
.employee-add-btn {
    margin-left: 8px;
    opacity: 0;
    transition: opacity 0.2s ease;
    min-width: 2rem !important;
    height: 2rem !important;
    padding: 0 !important;
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
:deep(.p-treenode-content:hover) .employee-add-btn,
:deep(.p-treenode-content:hover) .group-select-btn,
:deep(.p-treenode-content:hover) .group-deselect-btn {
    opacity: 1;
}

/* Всегда показываем кнопки при фокусе */
.employee-add-btn:focus,
.group-select-btn:focus,
.group-deselect-btn:focus {
    opacity: 1;
}

/* Стили для типов документов */
.type-item {
    @apply border-b border-surface-100 dark:border-surface-700 last:border-b-0;
}

.type-name {
    @apply text-sm font-medium;
}

/* Подсветка совпадений поиска */
:deep(mark) {
    background-color: var(--yellow-200);
    color: var(--text-color);
    padding: 0;
    border-radius: 2px;
}

/* Стили для темной темы */
:global(.dark) .employee-tree-container {
    border-color: var(--surface-600);
    background: var(--surface-900);
}

:global(.dark) :deep(.p-tree .p-tree-container .p-treenode .p-treenode-content:hover) {
    background: var(--surface-700);
}

:global(.dark) :deep(mark) {
    background-color: var(--yellow-600);
    color: var(--surface-0);
}

/* Утилитарные классы */
.space-y-6 > * + * {
    margin-top: 1.5rem;
}
</style>
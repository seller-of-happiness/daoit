<script setup lang="ts">
/*
* Компонент TreeSelect для иерархического выбора значений с расширенными возможностями
*
* Функционал:
* - Поддержка древовидных структур данных
* - Единичный/множественный выбор элементов
* - Встроенный фильтр PrimeVue
* - Фолбэк: перехватываем ввод фильтра, чтобы:
*     • автоматически раскрывать родителей найденных узлов
*     • подсвечивать совпадения в label
* - Полная синхронизация с v-model
*/

import { ref, watch, onMounted, onUnmounted } from 'vue'
import type { ITreeSelectProps } from '@/refactoring/types/ITreeSelectProps'
import type { ITreeNode } from '@/refactoring/modules/apiStore/types/ITreeNode'
import type { IVModelTreeSelect } from '@/refactoring/types/IVModelTreeSelect'

// Расширение базового интерфейса узла для контроля состояния раскрытия
interface TreeNodeWithExpanded extends ITreeNode {
    expanded?: boolean
}

// Получение пропсов с типизацией
const props = defineProps<ITreeSelectProps>()

// Определение генерируемых событий
const emit = defineEmits(['update:modelValue', 'change'])

// Модель для двустороннего связывания (обязательная)
const treeModel = defineModel<IVModelTreeSelect | null>({ required: true })

// Ссылка на компонент TreeSelect
const treeSelect = ref()

// Внутреннее состояние значения
const internalValue = ref<IVModelTreeSelect | null>(null)

// Состояние раскрытых узлов (ключ: значение)
const expandedKeys = ref<Record<string, boolean>>({})

// Флаг видимости панели выбора
const panelVisible = ref(false)

// Локальное значение фильтра (заполняется ТОЛЬКО через фолбэк)
const filterValue = ref('')

// Инициализация состояния раскрытия (все родительские узлы — свёрнуты)
onMounted(() => {
    if (props.options) {
        expandedKeys.value = props.options.reduce((acc, node) => {
            if (node.children?.length) acc[node.key] = false
            return acc
        }, {} as Record<string, boolean>)
    }
})

/**
 * Обработчик клика по узлу дерева
 *
 * Для узлов с дочерними элементами:
 * - Останавливает всплытие события
 * - Предотвращает стандартное поведение
 * - Переключает состояние раскрытия
 * - Принудительно показывает панель выбора
 *
 * Для конечных узлов:
 * - Позволяет стандартную обработку клика
 */
const handleNodeClick = (node: TreeNodeWithExpanded, event: MouseEvent) => {
    if (node.children?.length) {
        event.stopPropagation()
        event.preventDefault()
        expandedKeys.value = {
            ...expandedKeys.value,
            [node.key]: !expandedKeys.value[node.key]
        }
        panelVisible.value = true
        return false
    }
    return true
}

/**
 * Обработчик изменения значения
 *
 * 1. Генерирует событие change с новым значением
 * 2. Вызывает внешний обработчик changeHandler, если он передан
 * 3. Закрывает панель, если доступен метод hide()
 */
const onChange = (value: IVModelTreeSelect | null) => {
    emit('change', value)
    if (props.changeHandler) {
        props.changeHandler(value)
    }
    if (treeSelect.value && typeof (treeSelect.value as any).hide === 'function') {
        ;(treeSelect.value as any).hide()
    }
}

// Синхронизация внешнего значения с внутренним состоянием
watch(treeModel, (newVal) => {
    if (JSON.stringify(internalValue.value) !== JSON.stringify(newVal)) {
        internalValue.value = newVal
    }
}, { immediate: true, deep: true })

// Синхронизация внутреннего значения с внешней моделью
watch(internalValue, (newVal) => {
    treeModel.value = newVal
    emit('update:modelValue', newVal)
})

/* ===================== ПОДСВЕТКА + АВТО-РАСКРЫТИЕ ЧЕРЕЗ ФОЛБЭК ===================== */

/**
 * Подсветка совпадений во время поиска
 */
const highlightMatch = (label: string, search: string) => {
    if (!search) return label
    const safe = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return (label ?? '').replace(new RegExp(`(${safe})`, 'ig'), '<mark>$1</mark>')
}

/**
 * Собирает карту expanded только по родительским ключам
 * (предпочтительно держать строго boolean — без undefined)
 */
const buildExpandedState = (nodes: ITreeNode[] = [], openMap: Record<string, boolean> = {}) => {
    const res: Record<string, boolean> = {}
    const walk = (n: ITreeNode) => {
        if (n.children?.length) {
            // упрощено для линтера: "Can be simplified to openMap[n.key]"
            res[n.key] = openMap[n.key] as boolean
            n.children.forEach(walk)
        }
    }
    nodes.forEach(walk)
    return res
}

/**
 * Реакция на изменение filterValue — раскрываем предков найденных узлов
 */
watch(filterValue, (val) => {
    const q = (val || '').toLowerCase().trim()
    const roots = props.options ?? []

    if (!q) {
        // очищен поиск — свернуть все родительские ключи
        expandedKeys.value = buildExpandedState(roots, {})
        return
    }

    const toExpand: Record<string, boolean> = {}
    const dfs = (node: ITreeNode, parents: string[]) => {
        const label = (node.label || '').toLowerCase()
        if (label.includes(q)) {
            parents.forEach(k => { toExpand[k] = true })
        }
        node.children?.forEach(ch => dfs(ch, [...parents, node.key]))
    }
    roots.forEach(n => dfs(n, []))

    expandedKeys.value = buildExpandedState(roots, toExpand)
})

/**
 * ФОЛБЭК: слушаем появление overlay и вешаем input-обработчик на встроенный фильтр
 * (нужно для версий PrimeVue без v-model:filterValue у TreeSelect)
 */
let mo: MutationObserver | null = null
const boundInputs = new WeakSet<HTMLInputElement>()

const tryBindFilterInput = () => {
    const panels = Array.from(document.querySelectorAll('.p-treeselect-panel, .p-treeselect-overlay')) as HTMLElement[]
    for (const panel of panels) {
        const input = panel.querySelector('input.p-tree-filter-input') as HTMLInputElement | null
        if (input && !boundInputs.has(input)) {
            boundInputs.add(input)
            input.addEventListener('input', (e) => {
                filterValue.value = (e.target as HTMLInputElement).value || ''
            }, { passive: true })
        }
    }
}

onMounted(() => {
    mo = new MutationObserver(() => tryBindFilterInput())
    mo.observe(document.body, { childList: true, subtree: true })
    // если панель уже есть в DOM — сразу привяжемся
    tryBindFilterInput()
})

onUnmounted(() => {
    mo?.disconnect()
    mo = null
})
/* ===================== /ФОЛБЭК ===================== */

// Экспорт ссылки на компонент
defineExpose({ treeSelect })
</script>

<template>
    <!--
      Основной компонент TreeSelect:
      - Включен встроенный фильтр (strict)
      - Состояния, опции и события — как в исходном компоненте
    -->
    <TreeSelect
        :filter="true"
        filter-mode="strict"
        :class="className"
        :name="name"
        v-model="internalValue"
        show-clear
        :selection-mode="selectionMode"
        :max-selected-labels="1"
        :disabled="loading"
        :placeholder="placeholder"
        :loading="loading"
        :options="options"
        :expanded-keys="expandedKeys"
        :panelVisible="panelVisible"
        @panel-hide="panelVisible = false"
        ref="treeSelect"
        style="min-height: 33px"
        @update:modelValue="onChange"
    >
        <!-- Кастомный рендеринг: подсветка совпавшей части метки во время поиска -->
        <template #option="{ node }">
            <div
                class="node-wrapper"
                @click="handleNodeClick(node, $event)"
                @mousedown="node.children?.length ? $event.preventDefault() : null"
                @mouseup="node.children?.length ? $event.preventDefault() : null"
            >
                <div class="node-content">
                    <span v-html="highlightMatch(node.label, filterValue)"></span>
                </div>
                <div class="node-fill-area"></div>
            </div>
        </template>
    </TreeSelect>
</template>

<style scoped>
/*
  Стили для кастомного отображения узлов
*/
.node-wrapper {
    display: flex;
    align-items: center;
    width: 100%;
    height: 100%;
    position: relative;
}
.node-content {
    flex: 0 1 auto;
    cursor: pointer;
}
.node-fill-area {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: -1;
}
</style>

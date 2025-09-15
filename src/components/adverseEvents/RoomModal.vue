<script setup lang="ts">
/*
* Компонент модального окна для выбора локации (территории/помещения/этажа/корпуса/больницы).
*
* Основные функции:
* - Отображает иерархию больницы (Hospital -> Block -> Floor -> Room)
* - Позволяет выбрать конкретную локацию
* - Записывает выбранные данные в currentAdverseEvent (по умолчанию) или currentSupportService (если передан пропс support)
* - Поддерживает фильтрацию и поиск по дереву
* - Позволяет указать место вручную через дополнительное модальное окно
*
* Новый функционал:
* - При передаче пропса support="true" компонент работает с хранилищем supportService вместо adverseEvents
*/

import {computed, nextTick, ref, watch, watchEffect} from 'vue'
import { storeToRefs } from 'pinia'
// Store с данными структуры больницы и текущего инцидента
import { useApiStore } from '@/refactoring/modules/apiStore/stores/apiStore'
import { useSupportService } from '@/refactoring/modules/supportService/stores/supportService'
import { useCalendarStore } from "@/refactoring/modules/calendar/stores/calendarStore"
import { useFeedbackStore } from "@/refactoring/modules/feedback/stores/feedbackStore"

// Типы для структуры больницы
import type { IHospitalSkeleton } from '@/refactoring/modules/apiStore/types/hospital-skeleton/IHospitalSkeleton'
import type { IBlock } from '@/refactoring/modules/apiStore/types/hospital-skeleton/IBlock'
import type { IFloor } from '@/refactoring/modules/apiStore/types/hospital-skeleton/IFloor'
import type { IRoom } from '@/refactoring/modules/apiStore/types/hospital-skeleton/IRoom'
import type { ITreeNode } from '@/refactoring/modules/apiStore/types/ITreeNode'
import type {ITargetStore} from "@/refactoring/types/ITargetStore";

import CommentModal from '@/components/adverseEvents/CommentModal.vue'

// Инициализация хранилищ
const apiStore = useApiStore()
const supportService = useSupportService()
const calendarStore = useCalendarStore()
const feedbackStore = useFeedbackStore()

// Реактивные данные из хранилища
const { hospitalSkeleton } = storeToRefs(apiStore)
const { currentAdverseEvent } = storeToRefs(apiStore)
const { currentSupportService } = storeToRefs(supportService)
const { currentCalendarEvent } = storeToRefs(calendarStore)

// Пропсы компонента
const props = defineProps<ITargetStore>()

// Управление видимостью основного модального окна
const visible = defineModel<boolean>('visible')

// Локальное состояние для дерева и выбранных элементов
const nodes = ref<ITreeNode[]>([]) // Список нод для дерева
const selectedKeys = ref<Record<string, boolean>>({}) // Отмеченные ключи (одновременно selection и expanded)
const expandedKeys = ref<Record<string, boolean>>({}) // Развёрнутые ключи
const selectedItemsString = ref<string>('') // Текстовое представление выбранного пути
const selectedCache = ref<ITreeNode[]>([]) // Кэш выбранных узлов
const showOtherLocationModal = ref(false) // Видимость модалки для ручного ввода локации

const targetField = computed(() => props.targetStore)

const current = computed(() => {
  switch (targetField.value) {
    case 'apiStore':
      return currentAdverseEvent.value
    case 'supportService':
      return currentSupportService.value
    case 'calendarStore':
      return currentCalendarEvent.value
    default:
      return null
  }
})

const defaultComment = computed(() => {
  switch (targetField.value) {
    case 'apiStore':
      return typeof currentAdverseEvent.value.location === 'string' ? currentAdverseEvent.value.location : ''
    case 'supportService':
      return typeof currentSupportService.value.location === 'string' ? currentSupportService.value.location : ''
    case 'calendarStore':
      return typeof currentCalendarEvent.value.location === 'string' ? currentCalendarEvent.value.location : ''
    default:
      return ''
  }
})

const computedTargetField = computed(() => {
  switch (targetField.value) {
    case 'apiStore':
      return 'apiStoreLocation'
    case 'supportService':
      return 'supportStoreLocation'
    case 'calendarStore':
      return 'calendarStoreLocation'
    default:
      return undefined
  }
})

/**
 * Преобразует структуру больницы в формат дерева для компонента Tree.
 * @param data Массив структур больниц (обычно 1 элемент)
 * @returns Массив узлов дерева ITreeNode[]
 */
function transformToTree(data: IHospitalSkeleton[]): ITreeNode[] {
    return data.map((hospital: IHospitalSkeleton) => ({
        key: String(hospital.id),
        label: `Больница ${hospital.name}`,
        data: { name: 'Больница', position: 1, selfId: hospital.id },
        icon: 'pi pi-fw pi-building-columns',
        children: hospital.blocks.map((block: IBlock) => ({
            key: `${hospital.id}-${block.id}`,
            label: `${block.name}`,
            data: { name: 'Корпус', position: 2, selfId: block.id },
            icon: 'pi pi-fw pi-th-large',
            children: block.floors.map((floor: IFloor) => ({
                key: `${hospital.id}-${block.id}-${floor.id}`,
                label: `Этаж ${floor.number}`,
                data: { name: 'Этаж', position: 3, selfId: floor.id },
                icon: 'pi pi-fw pi-building',
                children: floor.rooms.map((room: IRoom) => ({
                    key: `${hospital.id}-${block.id}-${floor.id}-${room.id}`,
                    label: room.name,
                    data: { name: 'Помещение', position: 4, selfId: room.id },
                    icon: 'pi pi-fw pi-box',
                    children: [],
                })),
            })),
        })),
    }))
}

/**
 * Генерирует ключи для подсветки ВСЕГО пути до узла.
 *
 * Формат key в дереве: "<hospitalUUID>-<blockUUID>-<floorUUID>-<roomUUID>"
 * Каждый UUID — стандартный и содержит 5 частей, разделённых дефисами.
 * Мы режем общий key по '-', затем собираем:
 *  - [0..5)   → hospital
 *  - [5..10)  → hospital-block
 *  - [10..15) → hospital-block-floor
 *  - [15..20) → hospital-block-floor-room
 *
 * @param input Полный ключ выбранного узла
 * @returns Массив ключей-родителей от корня до выбранного узла
 *          (hospital, hospital-block, hospital-block-floor, hospital-block-floor-room)
 */
function createSelectedKeys(input: string): string[] {
    const parts = input.split('-')
    const res: string[] = []
    if (parts.length >= 5) res.push(parts.slice(0, 5).join('-'))   // hospital
    if (parts.length >= 10) res.push(parts.slice(0, 10).join('-')) // hospital-block
    if (parts.length >= 15) res.push(parts.slice(0, 15).join('-')) // hospital-block-floor
    if (parts.length >= 20) res.push(parts.slice(0, 20).join('-')) // hospital-block-floor-room
    return res
}

/**
 * Находит текстовые метки для отображения выбранного пути
 * @param data - массив всех узлов дерева
 * @param keys - массив ключей для поиска
 * @returns Массив меток узлов
 */
function findLabelsByKeys(data: ITreeNode[], keys: string[]): string[] {
    const labels: string[] = []

    function search(node: ITreeNode, currentPath: string[] = []) {
        // Собираем текущий путь в формате "hospitalId-blockId-floorId-roomId"
        const nodePath = [...currentPath, node.data.selfId].join('-')

        // Если текущий узел есть в массиве ключей
        if (keys.includes(nodePath)) {
            labels.push(node.label)
        }

        // Рекурсивно ищем в дочерних узлах
        if (node.children) {
            node.children.forEach((child: ITreeNode) => search(child, [...currentPath, node.data.selfId]))
        }
    }

    data.forEach((item) => search(item))
    return labels
}

/**
 * При инициализации редактирования помещения:
 * - Если ранее был выбран блок/этаж/комната — разворачивает дерево до нужного уровня
 * - Активирует соответствующие ключи и заполняет selectedItemsString
 * - Иначе вызывает expandTreeOnInit() для стандартного разворота
 */
function expandEditedTreeOnInit() {
    const { block, floor, room } = current.value || {};

    nextTick(() => {
        if (!block?.id && !floor?.id && !room?.id) {
            expandTreeOnInit();
            return;
        }

        // Формируем ключ из всех доступных ID
        const keyParts = [hospitalSkeleton.value[0]?.id]; // hospital ID
        if (block?.id) keyParts.push(block.id);
        if (floor?.id) keyParts.push(floor.id);
        if (room?.id) keyParts.push(room.id);

        const keyString = keyParts.join('-');
        const createdKeys = createSelectedKeys(keyString);

        const newItem: Record<string, boolean> = {};
        createdKeys.forEach((item) => (newItem[item] = true));

        selectedKeys.value = newItem;
        expandedKeys.value = newItem;

        const labels = findLabelsByKeys(nodes.value, createdKeys);
        selectedItemsString.value = labels.length ? labels.join(', ') : "Ничего не выбрано";
    });
}

/**
 * Разворачивает дерево по умолчанию (только корневые узлы)
 */
function expandTreeOnInit() {
    const newExpandedKeys: Record<string, boolean> = {}
    for (const hospital of nodes.value) {
        newExpandedKeys[hospital.key] = true
    }
    expandedKeys.value = newExpandedKeys
    selectedItemsString.value = "Ничего не выбрано"
}

function resetCurrentFields() {
  switch (targetField.value) {
    case 'apiStore':
      currentAdverseEvent.value.location = ''
      currentAdverseEvent.value.block = null
      currentAdverseEvent.value.floor = null
      currentAdverseEvent.value.room = null
      selectedItemsString.value = ''
      break
    case 'supportService':
      currentSupportService.value.location = ''
      currentSupportService.value.block = null
      currentSupportService.value.floor = null
      currentSupportService.value.room = null
      selectedItemsString.value = ''
      break
    case 'calendarStore':
      currentCalendarEvent.value.location = ''
      currentCalendarEvent.value.block = null
      currentCalendarEvent.value.floor = null
      currentCalendarEvent.value.room = null
      selectedItemsString.value = ''
      break
  }
    selectedItemsString.value = 'Ничего не выбрано'
}

/**
 * Из актуально выделенного пути (selectedKeys) извлекает UUID-ы
 * и сохраняет их в current.* (block/floor/room).
 *
 * ВАЖНО: selectedKeys мы формируем в onSelectionKeysUpdate так,
 * чтобы ключи шли в порядке: hospital → block → floor → room.
 * Поэтому "последний" ключ — самый глубокий выбор.
 *
 * Шаги:
 *  1) Сбросить текущие значения (resetCurrentFields)
 *  2) Взять самый глубокий ключ
 *  3) Нарезать его по 5 сегментов на каждый UUID
 *  4) Записать найденные id в current.value.{block,floor,room}
 */
function locationTypeParts() {
    const keysArray = Object.keys(selectedKeys.value)
    const lastKey = keysArray[keysArray.length - 1]

    resetCurrentFields()

    if (lastKey && current.value) {
        const parts = lastKey.split('-')

        const hospitalId = parts.slice(0, 5).join('-')
        const blockId    = parts.slice(5, 10).join('-')
        const floorId    = parts.slice(10, 15).join('-')
        const roomId     = parts.slice(15, 20).join('-')

        if (blockId) current.value.block = { id: blockId }
        if (floorId) current.value.floor = { id: floorId }
        if (roomId)  current.value.room  = { id: roomId }

        console.log('Saved full IDs:', { hospital: hospitalId, block: blockId, floor: floorId, room: roomId })
    }
}

/**
 * Обработчик сохранения ручного ввода локации
 * Показывает разный текст в "Выбрано" в зависимости от пропса
 */
function handleOtherLocationSaved(comment: string) {
  // Закрываем оба окна сразу
  showOtherLocationModal.value = false
  visible.value = false

  // Обновляем данные в зависимости от целевого хранилища
  switch (targetField.value) {
    case 'apiStore':
      currentAdverseEvent.value.location = comment
      currentAdverseEvent.value.block = null
      currentAdverseEvent.value.floor = null
      currentAdverseEvent.value.room = null
      selectedItemsString.value = 'Место происшествия указано вручную'
      break
    case 'supportService':
      currentSupportService.value.location = comment
      currentSupportService.value.block = null
      currentSupportService.value.floor = null
      currentSupportService.value.room = null
      selectedItemsString.value = 'Описано вручную'
      break
    case 'calendarStore':
      currentCalendarEvent.value.location = comment
      currentCalendarEvent.value.block = null
      currentCalendarEvent.value.floor = null
      currentCalendarEvent.value.room = null
      selectedItemsString.value = 'Описано вручную'
      break
  }
}


/**
 * Сохраняет выбранные значения и закрывает модальное окно
 */
function setData() {
  const keysArray = Object.keys(selectedKeys.value);
  const hasOnlyHospital = keysArray.length === 1 && keysArray[0].split('-').length === 1;

  if (hasOnlyHospital) {
    feedbackStore.showToast({
      type: 'error',
      title: 'Выберите конкретное место',
      message: 'Пожалуйста, выберите корпус, этаж или помещение. Либо укажите место вручную через "Описать другое место"',
      time: 10000,
    });
    return; // Прерываем выполнение, не сохраняем и не закрываем модалку
  }
    locationTypeParts() // Сохраняет блок/этаж/комнату
    visible.value = false // Закрываем модалку
    selectedCache.value = []
}

// Наблюдатели:

/**
 * Следит за изменением hospitalSkeleton и всегда пересобирает дерево для Tree
 */
watchEffect(() => {
    nodes.value = transformToTree(hospitalSkeleton.value ?? [])
})

/**
 * Следит за изменением структуры дерева и текущим выбором, инициализирует дерево (разворачивает узлы и выделяет выбранные)
 * Работает с currentAdverseEvent или currentSupportService в зависимости от пропса support
 */
watch(
    [nodes, current],
    ([nodeVal, curr]) => {
      if (nodeVal.length) {
        selectedKeys.value = {}
        expandedKeys.value = {}

        if (!curr) return

        const parts = curr.block || curr.floor || curr.room

        if (parts) {
          expandEditedTreeOnInit()
        } else {
          expandTreeOnInit()
        }
      }
    },
    { deep: true, immediate: true }
)

/**
 * Применяет выбор по конкретному ключу узла.
 * Делает три вещи:
 *  1) Собирает весь путь через createSelectedKeys(key)
 *  2) Принудительно выделяет все ключи пути (selectedKeys) и разворачивает родителей (expandedKeys)
 *  3) Пересчитывает текст "Выбран: ..." по label-ам узлов
 */
function applyPathForKey(key: string) {
    const newItem: Record<string, boolean> = {}
    const createdKeys = createSelectedKeys(key)
    createdKeys.forEach(k => (newItem[k] = true))
    selectedKeys.value = newItem
    expandedKeys.value = newItem
    const labels = findLabelsByKeys(nodes.value, createdKeys)
    selectedItemsString.value = labels.join(', ')
}


/**
 * Повторный клик по уже выделенному узлу.
 * PrimeVue присылает node-unselect: мы мгновенно восстанавливаем путь
 * (чтобы визуально подсветка не пропала) и подтверждаем выбор как по кнопке "Выбрать".
 */
function onNodeUnselect(event: { key: string }) {
    // вернуть визуально тот же выбор
    applyPathForKey(event.key)
    // подтвердить выбор и закрыть модалку
    setData()
}

/**
 * Главный дифф-хендлер изменения selectionKeys от Tree.
 *
 * Идея:
 *  - Определяем "pivot" — ключ, который пользователь фактически кликнул.
 *    Если обнаружить добавленный ключ не удалось (сложные кейсы), берём самый глубокий из текущих.
 *  - По pivot строим полный путь родительских ключей (createSelectedKeys)
 *  - Насильно выставляем selection (весь путь) и expand (родители)
 *  - Обновляем подпись selectedItemsString
 *
 * @param next Актуальное состояние selectionKeys, пришедшее от Tree
 */
function onSelectionKeysUpdate(next: Record<string, boolean>) {
    const prev = selectedKeys.value || {}
    const nextKeys = Object.keys(next || {})
    const prevKeys = Object.keys(prev || {})

    // Ключ, который добавился именно этим кликом
    const added = nextKeys.find(k => !prevKeys.includes(k))

    let pivot: string | null = null
    if (added) {
        pivot = added
    } else if (nextKeys.length) {
        // если ничего не "добавилось" (например, тык по родителю/снятие),
        // берём самый глубокий из текущих
        pivot = nextKeys.reduce((a, b) =>
            b.split('-').length > a.split('-').length ? b : a
        )
    }

    if (!pivot) {
        selectedKeys.value = {}
        selectedItemsString.value = 'Ничего не выбрано'
        return
    }

    // Построить полный путь (hospital / block / floor / room)
    const path = createSelectedKeys(pivot)

    // Принудительно подсветить весь путь
    const sel: Record<string, boolean> = {}
    path.forEach(k => (sel[k] = true))
    selectedKeys.value = sel

    // Развернуть родителей
    const exp = { ...expandedKeys.value }
    path.forEach(k => (exp[k] = true))
    expandedKeys.value = exp

    // Обновить подпись
    selectedItemsString.value = findLabelsByKeys(nodes.value, path).join(', ')
}

/**
 * (Необязательный) прокси для v-model:selectionKeys.
 *
 * Если подключишь в шаблоне вместо selectedKeys:
 *   v-model:selectionKeys="selectionKeysProxy"
 *
 * Тогда ЛЮБОЕ внешнее изменение selection автоматически будет
 * прогоняться через логику "подсветить весь путь + развернуть родителей".
 *
 * Сейчас это не используется напрямую в шаблоне — оставлено как
 * готовая замена, если захочешь убрать @update:selectionKeys.
 */
const selectionKeysProxy = computed<Record<string, boolean>>({
    get: () => selectedKeys.value,
    set: (next) => {
        const keys = Object.keys(next || {})
        if (!keys.length) {
            selectedKeys.value = {}
            selectedItemsString.value = 'Ничего не выбрано'
            return
        }
        // самый глубокий ключ (больше всего '-')
        const deepest = keys.reduce((a, b) =>
            b.split('-').length > a.split('-').length ? b : a
        )

        const path = createSelectedKeys(deepest)

        // принудительно выделяем весь путь
        const obj: Record<string, boolean> = {}
        path.forEach(k => (obj[k] = true))
        selectedKeys.value = obj

        // разворачиваем родителей
        const exp = { ...expandedKeys.value }
        path.forEach(k => (exp[k] = true))
        expandedKeys.value = exp

        // подпись
        selectedItemsString.value = findLabelsByKeys(nodes.value, path).join(', ')
    }
})

/* ===================== ПОИСК: подсветка, авто-раскрытие, автофокус ===================== */

/**
 * Текущее значение поисковой строки Tree (снимаем его из встроенного инпута).
 * Используем для подсветки и авто-раскрытия родителей.
 */
const filterQuery = ref('')

/** Ссылка на корневой элемент Tree, чтобы найти внутри него input фильтра. */
const tree = ref<any>(null)

/**
Храним функцию для снятия подписок, навешанных при открытии диалога.
 Почему так: внутри bindAndFocusTreeFilter() мы добавляем обработчики (focusin и т.п.).
 Когда диалог закроется, нужно их снять, иначе будет течь память/фокус будет «жить своей жизнью».
 */
let cleanupFocusHandlers: (() => void) | null = null

/** Подсветка совпадений в label. */
function highlightMatch(label?: string, search?: string): string {
    const s = (search ?? '').trim()
    if (!s) return label ?? ''
    const safe = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return (label ?? '').replace(new RegExp(`(${safe})`, 'ig'), '<mark>$1</mark>')
}

/**
 * Построить expandedKeys так, чтобы были раскрыты ВСЕ родители узлов, чьи label
 * содержат поисковую строку (без учёта регистра).
 */
function expandParentsForQuery(nodes: ITreeNode[], query: string) {
    const q = query.trim().toLowerCase()
    if (!q) {
        // когда поиск очищен — вернём дефолтное раскрытие
        expandTreeOnInit()
        return
    }

    const toExpand: Record<string, boolean> = {}

    const walk = (node: ITreeNode, parents: string[]) => {
        const hit = (node.label || '').toLowerCase().includes(q)
        node.children?.forEach(ch => walk(ch, [...parents, node.key]))
        if (hit) parents.forEach(k => (toExpand[k] = true))
    }

    nodes.forEach(n => walk(n, []))
    expandedKeys.value = toExpand
}

/** Следим за поиском: раскрываем родителей совпавших узлов. */
watch(filterQuery, (q) => {
    expandParentsForQuery(nodes.value ?? [], q)
})

/**
 * Навешивает обработчики на встроенный инпут фильтра Tree и принудительно переводит на него фокус.
 * Делает три вещи:
 *  1) Ищет input.p-tree-filter-input внутри текущего Tree
 *  2) Снимает autofocus с кнопки закрытия (PrimeVue любит перехватывать фокус туда)
 *  3) Вешает исправляющий обработчик focusin: если фокус уехал на крестик — возвращаем его в инпут
 * Дополнительно:
 *  - синхронизируем filterQuery по input событию
 *  - откладываем фокус через rAF, чтобы переждать внутренний focus-trap PrimeVue
 *  - регистрируем функцию очистки в cleanupFocusHandlers
 */
function bindAndFocusTreeFilter() {
    nextTick(() => {
        const treeRoot: HTMLElement | null =
            (tree.value?.$el as HTMLElement) ?? (tree.value?.$?.vnode?.el as HTMLElement) ?? null
        if (!treeRoot) return

        const input = treeRoot.querySelector('input.p-tree-filter-input') as HTMLInputElement | null
        if (!input) return

        // 1) Снять autofocus у крестика текущего диалога
        const dialogEl = treeRoot.closest('.p-dialog') as HTMLElement | null
        const closeBtn = dialogEl?.querySelector('.p-dialog-close-button') as HTMLButtonElement | null
        closeBtn?.removeAttribute('autofocus')

        // 2) Если фокус утащит focus-trap на крестик — вернём его в инпут
        const focusInput = () => {
            input.focus({ preventScroll: true })
            input.select()
        }
        const onFocusIn = (e: Event) => {
            const t = e.target as HTMLElement
            if (t?.classList.contains('p-dialog-close-button')) {
                focusInput()
            }
        }
        dialogEl?.addEventListener('focusin', onFocusIn)

        // 3) Синхронизация поиска (как было)
        const onInput = (e: Event) => {
            filterQuery.value = (e.target as HTMLInputElement).value || ''
        }
        if (!(input as any)._roomModalBound) {
            input.addEventListener('input', onInput, { passive: true })
            ;(input as any)._roomModalBound = true
        }

        // 4) Поздний фокус — пережидаем внутренний focus-trap PrimeVue
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                focusInput()
                setTimeout(focusInput, 0)
            })
        })

        // 5) Очистка подписок при закрытии диалога
        cleanupFocusHandlers = () => {
            dialogEl?.removeEventListener('focusin', onFocusIn)
        }
    })
}

// Следим за открытием/закрытием модалки:
// - при открытии навешиваем обработчики и фокусируем инпут
// - при закрытии чистим обработчики и сбрасываем строку поиска
watch(visible, (v) => {
    if (v) {
        bindAndFocusTreeFilter()
    } else {
        filterQuery.value = ''
        cleanupFocusHandlers?.()
        cleanupFocusHandlers = null
    }
})
/* ===================== /ПОИСК ===================== */
</script>

<template>
    <Dialog
        v-model:visible="visible"
        header="Выбор помещения или территории"
        :modal="true"
        class="location-modal"
    >
        <!-- Прокручиваемое содержимое -->
        <div class="location-modal__body max-h-[50vh] overflow-y-auto pb-4">
            <div class="flex w-full mb-6">
                <Tree
                    v-model:selectionKeys="selectionKeysProxy"
                    v-model:expandedKeys="expandedKeys"
                    :value="nodes"
                    selectionMode="multiple"
                    :metaKeySelection="false"
                    :filter="true"
                    filterMode="strict"
                    ref="tree"
                    class="w-full"
                    @node-unselect="onNodeUnselect"
                    @update:selectionKeys="onSelectionKeysUpdate"
                >
                    <!-- Подсветка совпадений -->
                    <template #default="{ node }">
                        <span v-html="highlightMatch(node.label, filterQuery)"></span>
                    </template>
                </Tree>
            </div>

        </div>

        <!-- Фиксированная панель действий (всегда внизу) -->

            <p class="m-0">Выбран: {{ selectedItemsString || 'Ничего не выбрано' }}</p>

        <div class="location-modal__actions sticky bottom-0 z-10 flex flex-wrap gap-4 pt-4 pb-3 border-t">
            <Button
                label="Очистить выбор"
                icon="pi pi-trash"
                severity="danger"
                outlined
                @click="resetCurrentFields"
                class="mr-auto"
            />
            <!-- Кнопка ручного ввода показывается только в режиме adverseEvent -->
            <Button
                label="Описать другое место"
                icon="pi pi-map-marker"
                severity="info"
                outlined
                @click="showOtherLocationModal = true"
            />
            <Button
                label="Отменить"
                icon="pi pi-times"
                text
                @click="visible = false"
            />
            <Button
                label="Выбрать"
                icon="pi pi-check"
                @click="setData"
            />
        </div>

        <!-- Модалка ручного ввода показывается только в режиме adverseEvent -->
        <CommentModal
            v-model:visible="showOtherLocationModal"
            :targetField="computedTargetField"
            :defaultComment="defaultComment"
            @closeModal="showOtherLocationModal = false"
            @onSaved="handleOtherLocationSaved"
        />
    </Dialog>
</template>

<style scoped>
:deep(mark){
    background: rgba(255,235,0,.6);
    padding: 0 1px;
    border-radius: 2px;
}
</style>

<script setup lang="ts">
/*
* Компонент DashboardWidgets для отображения ключевых метрик на дашборде
*
* Функционал:
* - Отображение активных Нежелательных Событий (НС)
* - Отображение активных заявок во вспомогательные службы
* - Показ динамики изменений по месяцам
* - Переход на соответствующие разделы при клике
* - Адаптивный интерфейс для разных размеров экранов
*
* Особенности:
* - Разные виджеты для рядовых пользователей и руководителей
* - Индикаторы роста/снижения показателей
* - Подсчет процентных изменений
* - Интеграция с API через stores
*/

import router from '@/router'
import { storeToRefs } from 'pinia'
import { useApiStore } from '@/refactoring/modules/apiStore/stores/apiStore'
import { useUserStore } from '@/refactoring/modules/user/stores/userStore'
import { useTicketsStore } from '@/refactoring/modules/tickets/stores/ticketsStore'
import { computed, onMounted } from 'vue'
import { ERouteNames } from '@/router/ERouteNames'

// ======================
// Инициализация хранилищ
// ======================
const apiStore = useApiStore()
const userStore = useUserStore()
const ticketsStore = useTicketsStore()

// ======================
// Реактивные состояния
// ======================
const { statsDashboard } = storeToRefs(apiStore)

// ======================
// Жизненный цикл компонента
// ======================

/**
 * Загрузка данных дашборда при монтировании компонента
 *
 * Вызывает метод загрузки статистики для дашборда из API store
 */
onMounted(async () => {
    await apiStore.loadDashboardStats()
})

// ======================
// Вычисляемые свойства для Нежелательных Событий (НС)
// ======================

/**
 * Количество активных Нежелательных Событий текущего пользователя
 *
 * @returns {number} Количество активных НС или 0, если данных нет
 */
const myActiveNSCount = computed(() => {
    return statsDashboard.value?.adverse_events?.active ?? 0
})

/**
 * Количество активных Нежелательных Событий в отделе (для руководителей)
 *
 * @returns {number} Количество активных НС в отделе или 0, если данных нет
 */
const departmentActiveNSCount = computed(() => {
    return statsDashboard.value?.adverse_events?.department_active ?? 0
})

/**
 * Количество Нежелательных Событий за текущий месяц
 *
 * @returns {number} Количество НС за текущий месяц или 0, если данных нет
 */
const currentMonthNS = computed(() => {
    return statsDashboard.value?.adverse_events?.current_month ?? 0
})

/**
 * Количество Нежелательных Событий за предыдущий месяц
 *
 * @returns {number} Количество НС за предыдущий месяц или 0, если данных нет
 */
const prevMonthNS = computed(() => {
    return statsDashboard.value?.adverse_events?.prev_month ?? 0
})

// ======================
// Вычисляемые свойства для вспомогательных служб
// ======================

/**
 * Количество активных заявок во вспомогательные службы текущего пользователя
 *
 * @returns {number} Количество активных заявок или 0, если данных нет
 */
const myActiveSupportCount = computed(() => {
    return statsDashboard.value?.tickets?.active ?? 0
})

/**
 * Количество активных заявок во вспомогательные службы в отделе (для руководителей)
 *
 * @returns {number} Количество активных заявок в отделе или 0, если данных нет
 */
const departmentActiveSupportCount = computed(() => {
    return statsDashboard.value?.tickets?.department_active ?? 0
})

/**
 * Количество заявок во вспомогательные службы за текущий месяц
 *
 * @returns {number} Количество заявок за текущий месяц или 0, если данных нет
 */
const currentMonthSupport = computed(() => {
    return statsDashboard.value?.tickets?.current_month ?? 0
})

/**
 * Количество заявок во вспомогательные службы за предыдущий месяц
 *
 * @returns {number} Количество заявок за предыдущий месяц или 0, если данных нет
 */
const prevMonthSupport = computed(() => {
    return statsDashboard.value?.tickets?.prev_month ?? 0
})

// ======================
// Общие вычисляемые свойства
// ======================

/**
 * Вычисляет разницу между текущим и предыдущим месяцем
 *
 * @param {number} current - Значение за текущий месяц
 * @param {number} prev - Значение за предыдущий месяц
 * @returns {number} Разница между месяцами
 */
const calculateTrend = (current: number, prev: number) => current - prev

/**
 * Вычисляет процентное изменение между месяцами
 *
 * @param {number} trend - Разница между месяцами
 * @param {number} prev - Значение за предыдущий месяц
 * @returns {number|null} Процент изменения или null, если нельзя вычислить
 */
const calculatePercentChange = (trend: number, prev: number) => {
    if (!prev) return null
    return Math.round((trend / prev) * 100)
}

/**
 * Формирует текстовую метку для отображения тренда
 *
 * @param {number} trend - Разница между месяцами
 * @param {number} prev - Значение за предыдущий месяц
 * @returns {string} Текстовая метка тренда
 */
const getTrendLabel = (trend: number, prev: number) => {
    if (!prev) return trend === 0 ? 'Без изменений' : `${trend}`
    if (trend > 0) return `+${trend}`
    if (trend < 0) return `${trend}`
    return 'Без изменений'
}

/**
 * Формирует текстовую метку процентного изменения
 *
 * @param {number} trend - Разница между месяцами
 * @param {number|null} percentChange - Процент изменения
 * @returns {string} Текстовая метка процентов
 */
const getPercentLabel = (trend: number, percentChange: number | null) => {
    if (percentChange === null || trend === 0) return ''
    if (trend > 0) return `на ${percentChange}% больше`
    if (trend < 0) return `на ${Math.abs(percentChange)}% меньше`
    return ''
}

/**
 * Определяет класс для стилизации процентного изменения
 *
 * @param {number} trend - Разница между месяцами
 * @param {number|null} percentChange - Процент изменения
 * @param {number} prev - Значение за предыдущий месяц
 * @returns {string} CSS класс для стилизации
 */
const getPercentClass = (trend: number, percentChange: number | null, prev: number) => {
    if (!prev || trend === 0 || percentChange === null) return 'text-muted-color'
    if (trend > 0) return 'text-red-500'
    if (trend < 0) return 'text-green-500'
    return 'text-muted-color'
}

// ======================
// Вычисления для Нежелательных Событий
// ======================
const trendNS = computed(() => calculateTrend(currentMonthNS.value, prevMonthNS.value))
const percentChangeNS = computed(() => calculatePercentChange(trendNS.value, prevMonthNS.value))
const trendLabelNS = computed(() => getTrendLabel(trendNS.value, prevMonthNS.value))
const percentLabelNS = computed(() => getPercentLabel(trendNS.value, percentChangeNS.value))
const percentClassNS = computed(() => getPercentClass(trendNS.value, percentChangeNS.value, prevMonthNS.value))

// ======================
// Вычисления для вспомогательных служб
// ======================
const trendSupport = computed(() => calculateTrend(currentMonthSupport.value, prevMonthSupport.value))
const percentChangeSupport = computed(() => calculatePercentChange(trendSupport.value, prevMonthSupport.value))
const trendLabelSupport = computed(() => getTrendLabel(trendSupport.value, prevMonthSupport.value))
const percentLabelSupport = computed(() => getPercentLabel(trendSupport.value, percentChangeSupport.value))
const percentClassSupport = computed(() => getPercentClass(trendSupport.value, percentChangeSupport.value, prevMonthSupport.value))

// ======================
// Обработчики событий
// ======================

/**
 * Обработчик клика по виджету Нежелательных Событий
 *
 * Перенаправляет на страницу НС с применением фильтра по активным событиям
 */
const handleMyNSClick = async () => {
    apiStore.resetFilters()
    apiStore.filters.is_active = true
    await router.push({ name: ERouteNames.ADVERSE_EVENTS })
}

/**
 * Обработчик клика по виджету вспомогательных служб
 *
 * Перенаправляет на страницу заявок с применением фильтра по активным заявкам
 */
const handleSupportClick = async () => {
    ticketsStore.resetFilters()
    ticketsStore.filters.is_active = true
    await router.push({ name: ERouteNames.TICKETS })
}
</script>

<template>
    <!-- Виджет: Мои активные Нежелательные События -->
    <div
        v-if="myActiveNSCount > 0"
        class="col-span-12 lg:col-span-6 xl:col-span-3 cursor-pointer"
        @click="handleMyNSClick"
    >
        <div class="card mb-0 min-h-[158px] flex flex-col justify-between h-full">
            <div class="flex justify-between mb-4">
                <div>
                    <span class="block text-muted-color font-medium mb-4">Мои активные НС</span>
                    <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">
                        {{ myActiveNSCount }}
                    </div>
                </div>
                <div
                    class="flex items-center justify-center bg-cyan-100 dark:bg-cyan-400/10 rounded-border"
                    style="width: 2.5rem; height: 2.5rem"
                >
                    <i class="pi pi-exclamation-triangle text-cyan-500 !text-xl"></i>
                </div>
            </div>
            <div class="mt-auto">
                <span class="text-primary font-medium">Вы ответственны </span>
                <span class="text-muted-color">за эти события</span>
            </div>
        </div>
    </div>

    <!-- Виджет: Мои активные заявки во вспомогательные службы -->
    <div
        v-if="myActiveSupportCount > 0"
        class="col-span-12 lg:col-span-6 xl:col-span-3 cursor-pointer"
        @click="handleSupportClick"
    >
        <div class="card mb-0 min-h-[158px] flex flex-col justify-between h-full">
            <div class="flex justify-between mb-4">
                <div>
                    <span class="block text-muted-color font-medium mb-4">Мои активные заявки</span>
                    <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">
                        {{ myActiveSupportCount }}
                    </div>
                </div>
                <div
                    class="flex items-center justify-center bg-purple-100 dark:bg-purple-400/10 rounded-border"
                    style="width: 2.5rem; height: 2.5rem"
                >
                    <i class="pi pi-wrench text-purple-500 !text-xl"></i>
                </div>
            </div>
            <div class="mt-auto">
                <span class="text-primary font-medium">Ваши заявки </span>
                <span class="text-muted-color">во вспомогательные службы</span>
            </div>
        </div>
    </div>

    <!-- Виджет: Руководитель отдела (Нежелательные События) -->
    <div
        v-if="userStore.user?.is_manager"
        class="col-span-12 lg:col-span-6 xl:col-span-3"
    >
        <div class="card mb-0 min-h-[158px]">
            <div class="flex justify-between mb-4">
                <div>
                    <span class="block text-muted-color font-medium mb-4">Активные НС в отделе</span>
                    <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">
                        {{ departmentActiveNSCount }}
                    </div>
                </div>
                <div
                    class="flex items-center justify-center bg-orange-100 dark:bg-orange-400/10 rounded-border"
                    style="width: 2.5rem; height: 2.5rem"
                >
                    <i class="pi pi-briefcase text-orange-500 !text-xl"></i>
                </div>
            </div>
            <span
                class="text-primary font-medium"
                :class="{
                    'text-red-500': trendNS > 0,
                    'text-green-500': trendNS < 0,
                    'text-muted-color': trendNS === 0
                }"
            >
                {{ trendLabelNS }}
            </span>
            <span class="text-muted-color">&nbsp;в сравнении с прошлым месяцем</span>
            <br />
            <span
                v-if="percentLabelNS"
                :class="['text-xs', percentClassNS, 'mt-2', 'inline-block']"
            >
                {{ percentLabelNS }}
            </span>
            <span
                v-else-if="!prevMonthNS && trendNS !== 0"
                class="text-muted-color text-xs mt-1 inline-block"
            >
                Нет данных для сравнения
            </span>
        </div>
    </div>

    <!-- Виджет: Руководитель отдела (Вспомогательные службы) -->
    <div
        v-if="userStore.user?.is_manager"
        class="col-span-12 lg:col-span-6 xl:col-span-3"
    >
        <div class="card mb-0 min-h-[158px]">
            <div class="flex justify-between mb-4">
                <div>
                    <span class="block text-muted-color font-medium mb-4">Активные заявки в отделе</span>
                    <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">
                        {{ departmentActiveSupportCount }}
                    </div>
                </div>
                <div
                    class="flex items-center justify-center bg-blue-100 dark:bg-blue-400/10 rounded-border"
                    style="width: 2.5rem; height: 2.5rem"
                >
                    <i class="pi pi-users text-blue-500 !text-xl"></i>
                </div>
            </div>
            <span
                class="text-primary font-medium"
                :class="{
                    'text-red-500': trendSupport > 0,
                    'text-green-500': trendSupport < 0,
                    'text-muted-color': trendSupport === 0
                }"
            >
                {{ trendLabelSupport }}
            </span>
            <span class="text-muted-color">&nbsp;в сравнении с прошлым месяцем</span>
            <br />
            <span
                v-if="percentLabelSupport"
                :class="['text-xs', percentClassSupport, 'mt-2', 'inline-block']"
            >
                {{ percentLabelSupport }}
            </span>
            <span
                v-else-if="!prevMonthSupport && trendSupport !== 0"
                class="text-muted-color text-xs mt-1 inline-block"
            >
                Нет данных для сравнения
            </span>
        </div>
    </div>
</template>

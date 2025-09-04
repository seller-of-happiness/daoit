<script setup lang="ts">
/*
 * Компонент AdverseEventsChartsWidget для отображения графиков нежелательных событий
 *
 * Функционал:
 * - Левый график: Doughnut с данными по отделениям
 * - Правый график: Stacked Bar Chart с данными по рискам и месяцам
 * - Фильтрация по датам (от и до)
 * - Исключение отделений из статистики при клике на легенду
 * - Автоматический пересчет правого графика при изменении фильтров
 *
 * Особенности:
 * - Использует Chart.js для рендеринга графиков
 * - Интеграция с API через adverseCharts
 * - Адаптивный дизайн
 * - Клик на легенду левого графика исключает/включает отделение
 */

import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { Chart, registerables } from 'chart.js'
import { useAdverseChartsStore } from '@/stores/adverseCharts/adverseChartsStore'
import type { IAdverseEvent } from '@/types/adverseCharts/IAdverseEvent'

// Регистрируем все компоненты Chart.js
Chart.register(...registerables)

// Инициализация хранилища
const adverseCharts = useAdverseChartsStore()

// Локальные состояния
const isLoading = ref(false)
const rawData = ref<IAdverseEvent[]>([])
const dateFrom = ref<Date | null>(null)
const dateTo = ref<Date | null>(null)
const excludedDepartments = ref<Set<string>>(new Set())

// Refs для графиков
const doughnutChart = ref<Chart<'doughnut'> | null>(null)
const barChart = ref<Chart | null>(null)
const doughnutCanvasRef = ref<HTMLCanvasElement | null>(null)
const barCanvasRef = ref<HTMLCanvasElement | null>(null)

// Цвета для графиков
const colors = [
    '#FF6384',
    '#36A2EB',
    '#FFCE56',
    '#4BC0C0',
    '#9966FF',
    '#FF9F40',
    '#FF6384',
    '#C9CBCF',
    '#4BC0C0',
    '#FF6384',
]

// Загрузка данных с API
const fetchChartData = async () => {
    isLoading.value = true
    try {
        const response = await adverseCharts.api.get('/api/adverse/adverse-event/', {
            params: {
                is_active: false,
                is_high_risk: false,
                limit: 1000,
            },
        })
        rawData.value = response.data.results || []
    } catch (error) {
        console.error('Error fetching chart data:', error)
        rawData.value = []
    } finally {
        isLoading.value = false
    }
}

// Фильтрация данных по датам
const filteredByDate = computed(() => {
    if (!dateFrom.value && !dateTo.value) {
        return rawData.value
    }

    return rawData.value.filter((event) => {
        const eventDate = new Date(event.date_time)

        if (dateFrom.value && eventDate < dateFrom.value) {
            return false
        }

        if (dateTo.value) {
            // Устанавливаем время dateTo на конец дня
            const endDate = new Date(dateTo.value)
            endDate.setHours(23, 59, 59, 999)
            if (eventDate > endDate) {
                return false
            }
        }

        return true
    })
})

// Данные по отделениям для левого графика
const departmentsData = computed(() => {
    const deptCounts: Record<string, { name: string; count: number }> = {}

    filteredByDate.value.forEach((event) => {
        const deptId = event.department?.id || 'unknown'
        const deptName = event.department?.name || 'Не указано'

        if (!deptCounts[deptId]) {
            deptCounts[deptId] = { name: deptName, count: 0 }
        }
        deptCounts[deptId].count++
    })

    return Object.entries(deptCounts)
        .map(([id, data]) => ({
            id,
            name: data.name,
            count: data.count,
            excluded: excludedDepartments.value.has(id),
        }))
        .sort((a, b) => b.count - a.count)
})

// Данные для Doughnut графика
const doughnutChartData = computed(() => {
    const visibleDepts = departmentsData.value.filter((d) => !d.excluded)

    return {
        labels: visibleDepts.map((d) => d.name),
        datasets: [
            {
                data: visibleDepts.map((d) => d.count),
                backgroundColor: visibleDepts.map((_, index) => colors[index % colors.length]),
                borderWidth: 2,
                borderColor: '#fff',
            },
        ],
    }
})

// Данные для Bar графика (по месяцам и рискам)
const stackedBarChartData = computed(() => {
    // Фильтруем по исключенным отделениям
    const dataForRisks = filteredByDate.value.filter((event) => {
        const deptId = String(event.department?.id || 'unknown')
        return !excludedDepartments.value.has(deptId)
    })

    // Группируем по месяцам
    const monthlyRisks: Record<string, { low: number; middle: number; high: number }> = {}

    dataForRisks.forEach((event) => {
        const date = new Date(event.date_time)
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

        if (!monthlyRisks[monthKey]) {
            monthlyRisks[monthKey] = { low: 0, middle: 0, high: 0 }
        }

        const risk = event.risk || 'low'
        monthlyRisks[monthKey][risk]++
    })

    // Сортируем месяцы
    const sortedMonths = Object.entries(monthlyRisks).sort((a, b) => a[0].localeCompare(b[0]))

    return {
        labels: sortedMonths.map(([month]) => {
            const [year, monthNum] = month.split('-')
            return `${monthNum}.${year}`
        }),
        datasets: [
            {
                label: 'Низкий риск',
                data: sortedMonths.map(([, risks]) => risks.low),
                backgroundColor: '#36A2EB',
                stack: 'Stack 0',
            },
            {
                label: 'Средний риск',
                data: sortedMonths.map(([, risks]) => risks.middle),
                backgroundColor: '#FFCE56',
                stack: 'Stack 0',
            },
            {
                label: 'Высокий риск',
                data: sortedMonths.map(([, risks]) => risks.high),
                backgroundColor: '#FF6384',
                stack: 'Stack 0',
            },
        ],
    }
})

// Создание/обновление Doughnut графика
const createOrUpdateDoughnutChart = () => {
    if (!doughnutCanvasRef.value) return

    // Уничтожаем существующий график
    if (doughnutChart.value) {
        doughnutChart.value.destroy()
        doughnutChart.value = null
    }

    // Проверяем наличие данных
    if (departmentsData.value.length === 0) return

    const ctx = doughnutCanvasRef.value.getContext('2d')
    if (!ctx) return

    doughnutChart.value = new Chart(ctx, {
        type: 'doughnut',
        data: doughnutChartData.value,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true,
                        font: {
                            size: 12,
                        },
                        generateLabels: (chart) => {
                            const data = chart.data
                            if (!data.labels || !data.datasets.length) return []

                            return data.labels.map((label, i) => {
                                const meta = chart.getDatasetMeta(0)
                                const style = meta.controller.getStyle(i, false)
                                const dept = departmentsData.value[i]

                                return {
                                    text: label as string,
                                    fillStyle: style.backgroundColor as string,
                                    strokeStyle: style.borderColor as string,
                                    lineWidth: style.borderWidth as number,
                                    hidden: dept?.excluded || false,
                                    index: i,
                                }
                            })
                        },
                    },
                    onClick: (e, legendItem, legend) => {
                        const index = legendItem.index
                        if (index !== undefined) {
                            const visibleDepts = departmentsData.value.filter((d) => !d.excluded)
                            const dept = visibleDepts[index]
                            if (dept) {
                                // Переключаем исключение отделения
                                if (excludedDepartments.value.has(dept.id)) {
                                    excludedDepartments.value.delete(dept.id)
                                } else {
                                    excludedDepartments.value.add(dept.id)
                                }
                                // Принудительно обновляем реактивность
                                excludedDepartments.value = new Set(excludedDepartments.value)
                            }
                        }
                    },
                },
                title: {
                    display: true,
                    text: 'Распределение НС по отделениям',
                    font: {
                        size: 16,
                    },
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const label = context.label || ''
                            const value = context.parsed || 0
                            const total = context.dataset.data.reduce(
                                (a: number, b: number) => a + b,
                                0,
                            )
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0'
                            return `${label}: ${value} (${percentage}%)`
                        },
                        afterLabel: () => {
                            return 'Кликните на легенду для исключения/включения'
                        },
                    },
                },
            },
        },
    })
}

// Создание/обновление Bar графика
const createOrUpdateBarChart = () => {
    if (!barCanvasRef.value) return

    // Уничтожаем существующий график
    if (barChart.value) {
        barChart.value.destroy()
        barChart.value = null
    }

    // Проверяем наличие данных
    if (stackedBarChartData.value.labels.length === 0) return

    const ctx = barCanvasRef.value.getContext('2d')
    if (!ctx) return

    barChart.value = new Chart(ctx, {
        type: 'bar',
        data: stackedBarChartData.value,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    stacked: true,
                    title: {
                        display: true,
                        text: 'Месяц',
                    },
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Количество случаев',
                    },
                    ticks: {
                        stepSize: 1,
                    },
                },
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        font: {
                            size: 12,
                        },
                    },
                },
                title: {
                    display: true,
                    text: 'Распределение НС по рискам и месяцам',
                    font: {
                        size: 16,
                    },
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        footer: (tooltipItems) => {
                            let sum = 0
                            tooltipItems.forEach((item) => {
                                sum += item.parsed.y
                            })
                            return `Всего: ${sum}`
                        },
                    },
                },
            },
        },
    })
}

// Обновление графиков
const updateCharts = async () => {
    await nextTick()
    createOrUpdateDoughnutChart()
    createOrUpdateBarChart()
}

// Сброс фильтров
const resetFilters = () => {
    dateFrom.value = null
    dateTo.value = null
    excludedDepartments.value.clear()
    excludedDepartments.value = new Set()
}

// Установка предустановленного диапазона дат
const setDateRange = (range: 'month' | 'quarter' | 'year') => {
    const now = new Date()
    dateTo.value = new Date(now)
    const from = new Date(now)

    switch (range) {
        case 'month':
            from.setMonth(from.getMonth() - 1)
            break
        case 'quarter':
            from.setMonth(from.getMonth() - 3)
            break
        case 'year':
            from.setFullYear(from.getFullYear() - 1)
            break
    }

    dateFrom.value = from
}

// Отслеживание изменений данных
watch(
    [doughnutChartData, stackedBarChartData],
    () => {
        updateCharts()
    },
    { deep: true },
)

// Загрузка данных при монтировании
onMounted(async () => {
    await fetchChartData()
    await updateCharts()
})

// Очистка при размонтировании
onUnmounted(() => {
    if (doughnutChart.value) {
        doughnutChart.value.destroy()
        doughnutChart.value = null
    }
    if (barChart.value) {
        barChart.value.destroy()
        barChart.value = null
    }
})

// Информация об исключенных отделениях
const excludedInfo = computed(() => {
    if (excludedDepartments.value.size === 0) return ''
    return `Скрыто отделений: ${excludedDepartments.value.size}`
})

// Проверка наличия данных
const hasData = computed(() => departmentsData.value.length > 0)
</script>

<template>
    <div class="col-span-12">
        <div class="card">
            <!-- Заголовок -->
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-xl font-semibold text-surface-900 dark:text-surface-0">
                    Аналитика нежелательных событий
                </h3>
                <div class="flex gap-2">
                    <Button
                        label="Месяц"
                        size="small"
                        severity="secondary"
                        outlined
                        @click="setDateRange('month')"
                    />
                    <Button
                        label="Квартал"
                        size="small"
                        severity="secondary"
                        outlined
                        @click="setDateRange('quarter')"
                    />
                    <Button
                        label="Год"
                        size="small"
                        severity="secondary"
                        outlined
                        @click="setDateRange('year')"
                    />
                    <Button
                        label="Сбросить"
                        icon="pi pi-refresh"
                        size="small"
                        severity="secondary"
                        outlined
                        @click="resetFilters"
                    />
                </div>
            </div>

            <!-- Фильтры по датам -->
            <div class="mb-6 flex flex-col sm:flex-row gap-4">
                <div class="flex-1">
                    <label for="date-from" class="block text-sm font-medium mb-2"> Дата от </label>
                    <DatePicker
                        id="date-from"
                        v-model="dateFrom"
                        :disabled="isLoading"
                        dateFormat="dd.mm.yy"
                        showIcon
                        showButtonBar
                        :maxDate="dateTo || undefined"
                        class="w-full"
                    />
                </div>
                <div class="flex-1">
                    <label for="date-to" class="block text-sm font-medium mb-2"> Дата до </label>
                    <DatePicker
                        id="date-to"
                        v-model="dateTo"
                        :disabled="isLoading"
                        dateFormat="dd.mm.yy"
                        showIcon
                        showButtonBar
                        :minDate="dateFrom || undefined"
                        class="w-full"
                    />
                </div>
            </div>

            <!-- Информация о фильтрах -->
            <div v-if="excludedInfo" class="mb-4">
                <Tag :value="excludedInfo" severity="info" icon="pi pi-info-circle" />
            </div>

            <!-- Графики -->
            <div class="grid grid-cols-12 gap-6">
                <!-- Левый график - Doughnut -->
                <div class="col-span-12 lg:col-span-6">
                    <div class="relative h-96">
                        <div v-if="isLoading" class="flex items-center justify-center h-full">
                            <ProgressSpinner style="width: 50px; height: 50px" strokeWidth="4" />
                        </div>

                        <canvas v-show="!isLoading && hasData" ref="doughnutCanvasRef"></canvas>

                        <div
                            v-if="!isLoading && !hasData"
                            class="flex items-center justify-center h-full text-surface-500"
                        >
                            <div class="text-center">
                                <i class="pi pi-chart-pie text-4xl mb-2"></i>
                                <p>Нет данных для отображения</p>
                            </div>
                        </div>
                    </div>

                    <p class="text-sm text-surface-500 mt-2 text-center">
                        Кликните на легенду для исключения отделения
                    </p>
                </div>

                <!-- Правый график - Stacked Bar -->
                <div class="col-span-12 lg:col-span-6">
                    <div class="relative h-96">
                        <div v-if="isLoading" class="flex items-center justify-center h-full">
                            <ProgressSpinner style="width: 50px; height: 50px" strokeWidth="4" />
                        </div>

                        <canvas v-show="!isLoading && hasData" ref="barCanvasRef"></canvas>

                        <div
                            v-if="!isLoading && !hasData"
                            class="flex items-center justify-center h-full text-surface-500"
                        >
                            <div class="text-center">
                                <i class="pi pi-chart-bar text-4xl mb-2"></i>
                                <p>Нет данных для отображения</p>
                            </div>
                        </div>
                    </div>

                    <p class="text-sm text-surface-500 mt-2 text-center">
                        График обновляется при изменении фильтров
                    </p>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
canvas {
    max-height: 100%;
    max-width: 100%;
}
</style>

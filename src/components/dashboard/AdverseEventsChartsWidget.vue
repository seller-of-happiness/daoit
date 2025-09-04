<script setup lang="ts">
/*
 * Компонент AdverseEventsChartsWidget
 * - UI слой для отображения графиков
 * - Работает только со store (Pinia)
 */

import { ref, watch, onMounted, onUnmounted, nextTick, computed } from 'vue'
import { Chart, registerables } from 'chart.js'
import { useAdverseChartsStore } from '@/stores/adverseCharts/adverseChartsStore'

Chart.register(...registerables)

const adverseCharts = useAdverseChartsStore()

// refs для chart.js
const doughnutChart = ref<Chart<'doughnut'> | null>(null)
const barChart = ref<Chart | null>(null)
const doughnutCanvasRef = ref<HTMLCanvasElement | null>(null)
const barCanvasRef = ref<HTMLCanvasElement | null>(null)

// Создание/обновление Doughnut графика
const createOrUpdateDoughnutChart = () => {
    if (!doughnutCanvasRef.value) return

    if (doughnutChart.value) {
        doughnutChart.value.destroy()
        doughnutChart.value = null
    }

    if (!adverseCharts.doughnutChartData.labels.length) return

    const ctx = doughnutCanvasRef.value.getContext('2d')
    if (!ctx) return

    doughnutChart.value = new Chart(ctx, {
        type: 'doughnut',
        data: adverseCharts.doughnutChartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        font: { size: 12 },
                    },
                    onClick: (_, legendItem) => {
                        const index = legendItem.datasetIndex
                        if (index !== undefined) {
                            const deptId = adverseCharts.departmentsChartData[index]?.id
                            if (deptId) adverseCharts.toggleDepartment(deptId)
                        }
                    },
                },
                title: {
                    display: true,
                    text: 'Распределение НС по отделениям',
                    font: { size: 16 },
                },
            },
        },
    })
}

// Создание/обновление Bar графика
const createOrUpdateBarChart = () => {
    if (!barCanvasRef.value) return

    if (barChart.value) {
        barChart.value.destroy()
        barChart.value = null
    }

    if (!adverseCharts.stackedBarChartData.labels.length) return

    const ctx = barCanvasRef.value.getContext('2d')
    if (!ctx) return

    barChart.value = new Chart(ctx, {
        type: 'bar',
        data: adverseCharts.stackedBarChartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { stacked: true, title: { display: true, text: 'Месяц' } },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    title: { display: true, text: 'Количество случаев' },
                },
            },
            plugins: {
                legend: { position: 'top', labels: { usePointStyle: true, font: { size: 12 } } },
                title: {
                    display: true,
                    text: 'Распределение НС по рискам и месяцам',
                    font: { size: 16 },
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

// Управление датами
const setDateRange = (range: 'month' | 'quarter' | 'year') => {
    const now = new Date()
    const to = new Date(now)
    const from = new Date(now)

    if (range === 'month') from.setMonth(from.getMonth() - 1)
    if (range === 'quarter') from.setMonth(from.getMonth() - 3)
    if (range === 'year') from.setFullYear(from.getFullYear() - 1)

    adverseCharts.setDateFilter(from, to)
}

// Отслеживание изменений данных
watch(
    [() => adverseCharts.doughnutChartData, () => adverseCharts.stackedBarChartData],
    () => updateCharts(),
    { deep: true },
)

// Загрузка данных при монтировании
onMounted(async () => {
    await adverseCharts.fetchChartData()
    await updateCharts()
})

// Очистка при размонтировании
onUnmounted(() => {
    if (doughnutChart.value) doughnutChart.value.destroy()
    if (barChart.value) barChart.value.destroy()
})

// Информация об исключенных отделениях
const excludedInfo = computed(() => {
    const count = adverseCharts.filters.excluded_departments.length
    return count ? `Скрыто отделений: ${count}` : ''
})

// Проверка наличия данных
const hasData = computed(() => adverseCharts.departmentsChartData.length > 0)
</script>

<template>
    <div class="col-span-12">
        <div class="card">
            <!-- Заголовок -->
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-xl font-semibold">Аналитика нежелательных событий</h3>
                <div class="flex gap-2">
                    <Button label="Месяц" size="small" outlined @click="setDateRange('month')" />
                    <Button
                        label="Квартал"
                        size="small"
                        outlined
                        @click="setDateRange('quarter')"
                    />
                    <Button label="Год" size="small" outlined @click="setDateRange('year')" />
                    <Button
                        label="Сбросить"
                        icon="pi pi-refresh"
                        size="small"
                        outlined
                        @click="adverseCharts.resetFilters()"
                    />
                </div>
            </div>

            <!-- Информация о фильтрах -->
            <div v-if="excludedInfo" class="mb-4">
                <Tag :value="excludedInfo" severity="info" icon="pi pi-info-circle" />
            </div>

            <!-- Графики -->
            <div class="grid grid-cols-12 gap-6">
                <!-- Doughnut -->
                <div class="col-span-12 lg:col-span-6">
                    <div class="relative h-96">
                        <div
                            v-if="adverseCharts.isLoading"
                            class="flex items-center justify-center h-full"
                        >
                            <ProgressSpinner style="width: 50px; height: 50px" strokeWidth="4" />
                        </div>
                        <canvas
                            v-show="!adverseCharts.isLoading && hasData"
                            ref="doughnutCanvasRef"
                        ></canvas>
                        <div
                            v-if="!adverseCharts.isLoading && !hasData"
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

                <!-- Bar -->
                <div class="col-span-12 lg:col-span-6">
                    <div class="relative h-96">
                        <div
                            v-if="adverseCharts.isLoading"
                            class="flex items-center justify-center h-full"
                        >
                            <ProgressSpinner style="width: 50px; height: 50px" strokeWidth="4" />
                        </div>
                        <canvas
                            v-show="!adverseCharts.isLoading && hasData"
                            ref="barCanvasRef"
                        ></canvas>
                        <div
                            v-if="!adverseCharts.isLoading && !hasData"
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

<script setup lang="ts">
/*
 * Компонент AdverseEventsChartsWidget
 * - UI слой для отображения графиков
 * - Работает только со store (Pinia)
 */

import { ref, watch, onMounted, onUnmounted, nextTick, computed } from 'vue'
import { useAdverseChartsStore } from '@/stores/adverseCharts/adverseChartsStore'
import DateRangePicker from '@/components/tableFilters/DateRangePicker.vue'

const adverseCharts = useAdverseChartsStore()

// Информация об исключенных отделениях
const excludedInfo = computed(() => {
    const count = adverseCharts.filters.excluded_departments.length
    return count ? `Скрыто отделений: ${count}` : ''
})

const doughnutOptions = computed(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            position: 'bottom',
            onHover: 'handleHover',
            onLeave: 'handleLeave',
            onClick: (event: any, legendItem: any, legend: any) => {
                const index =
                    legendItem.datasetIndex !== undefined
                        ? legendItem.datasetIndex
                        : legendItem.index
                const chart = legend.chart

                if (!legend?.chart?.data?.labels || index === undefined || index < 0) {
                    console.warn('Chart object or required methods are not available')
                    return
                }

                // Получаем название отделения
                const departmentName = legend.chart.data.labels[index]
                if (!departmentName) return
                // Находим соответствующий ID отделения
                const department = adverseCharts.departmentsChartData.find(
                    (d) => d.name === departmentName,
                )
                if (!department) return
                // Обновляем store - это автоматически обновит оба графика
                adverseCharts.toggleDepartment(department.id)

                // Предотвращаем стандартное поведение Chart.js, так как мы управляем данными через store
                event.preventDefault?.()
                return false
            },
            labels: {
                usePointStyle: true,
                font: { size: 12 },
            },
        },
        title: {
            display: true,
            text: 'Распределение НС по отделениям',
            font: { size: 16 },
        },
    },
}))

const barOptions = computed(() => ({
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
}))

onMounted(async () => {
    await adverseCharts.fetchChartData()
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
                    <DateRangePicker
                        :store="adverseCharts"
                        :loading="adverseCharts.isLoading"
                        afterKey="date_from"
                        beforeKey="date_to"
                        @change="adverseCharts.fetchChartData()"
                    />
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
                        <Chart
                            v-show="!adverseCharts.isLoading && hasData"
                            type="doughnut"
                            :data="adverseCharts.doughnutChartData"
                            :options="doughnutOptions"
                            class="h-full"
                        />
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
                        <Chart
                            v-show="!adverseCharts.isLoading && hasData"
                            type="bar"
                            :data="adverseCharts.stackedBarChartData"
                            :options="barOptions"
                            class="h-full"
                        />
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

// src/refactoring/modules/adverseCharts/stores/adverseChartsStore.ts

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/refactoring/modules/apiStore/apiConfig'
import type { IAdverseEvent } from '@/refactoring/modules/apiStore/types/adverse-events/IAdverseEvent'

interface IChartFilters {
    date_from: Date | null
    date_to: Date | null
    excluded_departments: string[]
}

interface IDepartmentData {
    id: string
    name: string
    count: number
}

interface IRiskData {
    date: string
    low: number
    middle: number
    high: number
}

export const useAdverseChartsStore = defineStore('adverseCharts', () => {
    // State
    const rawData = ref<IAdverseEvent[]>([])
    const isLoading = ref(false)
    const filters = ref<IChartFilters>({
        date_from: null,
        date_to: null,
        excluded_departments: [],
    })

    // Computed - отфильтрованные данные по датам
    const filteredByDateData = computed(() => {
        if (!filters.value.date_from && !filters.value.date_to) {
            return rawData.value
        }

        return rawData.value.filter((event) => {
            const eventDate = new Date(event.date_time)

            if (filters.value.date_from && eventDate < filters.value.date_from) {
                return false
            }

            if (filters.value.date_to && eventDate > filters.value.date_to) {
                return false
            }

            return true
        })
    })

    // Computed - данные для Doughnut графика (по отделениям)
    const departmentsChartData = computed((): IDepartmentData[] => {
        const departmentCounts: Record<string, { name: string; count: number }> = {}

        filteredByDateData.value.forEach((event) => {
            const deptId = event.department?.id || 'unknown'
            const deptName = event.department?.name || 'Не указано'

            if (!departmentCounts[deptId]) {
                departmentCounts[deptId] = { name: deptName, count: 0 }
            }
            departmentCounts[deptId].count++
        })

        return Object.entries(departmentCounts)
            .map(([id, data]) => ({
                id,
                name: data.name,
                count: data.count,
            }))
            .filter((dept) => !filters.value.excluded_departments.includes(dept.id))
            .sort((a, b) => b.count - a.count)
    })

    // Computed - данные для Bar графика (по рискам и датам)
    const risksChartData = computed((): IRiskData[] => {
        // Фильтруем данные по исключенным отделениям
        const dataForRisks = filteredByDateData.value.filter((event) => {
            const deptId = event.department?.id || 'unknown'
            return !filters.value.excluded_departments.includes(String(deptId))
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
            if (risk === 'low') monthlyRisks[monthKey].low++
            else if (risk === 'middle') monthlyRisks[monthKey].middle++
            else if (risk === 'high') monthlyRisks[monthKey].high++
        })

        // Преобразуем в массив и сортируем по дате
        return Object.entries(monthlyRisks)
            .map(([date, risks]) => ({
                date,
                ...risks,
            }))
            .sort((a, b) => a.date.localeCompare(b.date))
    })

    // Computed - данные для Chart.js Doughnut
    const doughnutChartData = computed(() => {
        const departments = departmentsChartData.value

        return {
            labels: departments.map((d) => d.name),
            datasets: [
                {
                    data: departments.map((d) => d.count),
                    backgroundColor: [
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
                    ],
                    borderWidth: 1,
                },
            ],
        }
    })

    // Computed - данные для Chart.js Stacked Bar
    const stackedBarChartData = computed(() => {
        const risks = risksChartData.value

        return {
            labels: risks.map((r) => {
                const [year, month] = r.date.split('-')
                return `${month}.${year}`
            }),
            datasets: [
                {
                    label: 'Низкий риск',
                    data: risks.map((r) => r.low),
                    backgroundColor: '#4BC0C0',
                    stack: 'Stack 0',
                },
                {
                    label: 'Средний риск',
                    data: risks.map((r) => r.middle),
                    backgroundColor: '#FFCE56',
                    stack: 'Stack 0',
                },
                {
                    label: 'Высокий риск',
                    data: risks.map((r) => r.high),
                    backgroundColor: '#FF6384',
                    stack: 'Stack 0',
                },
            ],
        }
    })

    // Actions
    async function fetchChartData() {
        isLoading.value = true
        try {
            const response = await api.get('/api/adverse/adverse-event/', {
                params: {
                    is_active: false,
                    is_high_risk: false,
                    limit: 1000, // Загружаем больше данных для графиков
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

    function setDateFilter(from: Date | null, to: Date | null) {
        filters.value.date_from = from
        filters.value.date_to = to
    }

    function toggleDepartment(departmentId: string) {
        const index = filters.value.excluded_departments.indexOf(departmentId)
        if (index > -1) {
            filters.value.excluded_departments.splice(index, 1)
        } else {
            filters.value.excluded_departments.push(departmentId)
        }
    }

    function resetFilters() {
        filters.value = {
            date_from: null,
            date_to: null,
            excluded_departments: [],
        }
    }

    return {
        // State
        rawData,
        isLoading,
        filters,

        // Computed
        filteredByDateData,
        departmentsChartData,
        risksChartData,
        doughnutChartData,
        stackedBarChartData,

        // Actions
        fetchChartData,
        setDateFilter,
        toggleDepartment,
        resetFilters,
    }
})

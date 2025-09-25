import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { BASE_URL, FILTRATION_TYPE } from '@/refactoring/environment/environment'
import axios from 'axios'
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
    const rawData = ref<IAdverseEvent[]>([])
    const isLoading = ref(false)
    const filters = ref<IChartFilters>({
        date_from: null,
        date_to: null,
        excluded_departments: [],
    })

    // Данные, отфильтрованные по датам
    const filteredByDateData = computed(() => {
        if (!filters.value.date_from && !filters.value.date_to) return rawData.value

        return rawData.value.filter((event) => {
            const eventDate = new Date(event.date_time)
            if (filters.value.date_from && eventDate < filters.value.date_from) return false
            if (filters.value.date_to && eventDate > filters.value.date_to) return false
            return true
        })
    })

    // Данные для графика отделений
    const departmentsChartData = computed((): IDepartmentData[] => {
        const counts: Record<string, { name: string; count: number }> = {}
        filteredByDateData.value.forEach((event) => {
            const id = event.department?.id || 'unknown'
            const name = event.department?.name || 'Не указано'
            if (!counts[id]) counts[id] = { name, count: 0 }
            counts[id].count++
        })
        return Object.entries(counts)
            .map(([id, data]) => ({ id, name: data.name, count: data.count }))
            .filter((d) => !filters.value.excluded_departments.includes(d.id))
            .sort((a, b) => b.count - a.count)
    })

    // Данные для графика рисков
    const risksChartData = computed((): IRiskData[] => {
        // Фильтруем данные по датам И по исключенным отделениям
        const filtered = filteredByDateData.value.filter((e) => {
            const id = e.department?.id || 'unknown'
            return !filters.value.excluded_departments.includes(String(id))
        })

        const monthly: Record<string, { low: number; middle: number; high: number }> = {}
        filtered.forEach((e) => {
            const date = new Date(e.date_time)
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
            if (!monthly[key]) monthly[key] = { low: 0, middle: 0, high: 0 }
            const risk = e.risk || 'low'
            if (risk === 'low') monthly[key].low++
            else if (risk === 'medium') monthly[key].middle++
            else if (risk === 'high') monthly[key].high++
        })

        const result = Object.entries(monthly)
            .map(([date, risks]) => ({ date, ...risks }))
            .sort((a, b) => a.date.localeCompare(b.date))

        return result
    })

    // Chart.js формат
    const doughnutChartData = computed(() => {
        const chartData = {
            labels: departmentsChartData.value.map((d) => d.name),
            datasets: [
                {
                    data: departmentsChartData.value.map((d) => d.count),
                    backgroundColor: [
                        '#FF6384',
                        '#36A2EB',
                        '#FFCE56',
                        '#4BC0C0',
                        '#9966FF',
                        '#FF9F40',
                        '#C9CBCF',
                    ],
                    borderWidth: 1,
                },
            ],
        }
        return chartData
    })

    const stackedBarChartData = computed(() => ({
        labels: risksChartData.value.map((r) => {
            const [year, month] = r.date.split('-')
            return `${month}.${year}`
        }),
        datasets: [
            {
                label: 'Низкий риск',
                data: risksChartData.value.map((r) => r.low),
                backgroundColor: '#4BC0C0',
                stack: 'Stack 0',
            },
            {
                label: 'Средний риск',
                data: risksChartData.value.map((r) => r.middle),
                backgroundColor: '#FFCE56',
                stack: 'Stack 0',
            },
            {
                label: 'Высокий риск',
                data: risksChartData.value.map((r) => r.high),
                backgroundColor: '#FF6384',
                stack: 'Stack 0',
            },
        ],
    }))

    // Actions
    async function fetchChartData() {
        isLoading.value = true
        try {
            const params: any = { is_active: false, is_high_risk: false, limit: 1000 }

            // Добавляем фильтры по датам если они установлены
            if (filters.value.date_from) {
                params.date_from = filters.value.date_from.toISOString()
            }
            if (filters.value.date_to) {
                params.date_to = filters.value.date_to.toISOString()
            }

            const res = await axios.get(`${BASE_URL}/api/adverse/adverse-event/`, { params })
            rawData.value = res.data.results || []
        } catch (err) {
            console.error('Error fetching chart data:', err)
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
        const idx = filters.value.excluded_departments.indexOf(departmentId)
        if (idx > -1) filters.value.excluded_departments.splice(idx, 1)
        else filters.value.excluded_departments.push(departmentId)
    }

    function resetFilters() {
        filters.value = { date_from: null, date_to: null, excluded_departments: [] }
    }

    return {
        rawData,
        isLoading,
        filters,
        departmentsChartData,
        risksChartData,
        doughnutChartData,
        stackedBarChartData,
        fetchChartData,
        setDateFilter,
        toggleDepartment,
        resetFilters,
    }
})

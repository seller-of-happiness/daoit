<script setup lang="ts">
/*
* Компонент отображения статистики по отделениям и уровням риска.
*
* Основные функции:
* - Показывает количество событий по отделениям
* - Визуализирует распределение по уровням риска (низкий, средний, высокий)
* - Поддерживает раскрытие/сворачивание списка отделений
* - Позволяет фильтровать события по выбранным отделениям
* - Отображает общее количество нежелательных событий
* - Адаптивный дизайн для разных размеров экрана
*/

// Импорт необходимых функций Vue и хранилищ
import { computed, ref, watchEffect } from 'vue'
import { useApiStore } from '@/refactoring/modules/apiStore/stores/apiStore'
import { useFeedbackStore } from '@/refactoring/modules/feedback/stores/feedbackStore'

// Инициализация хранилищ:
// apiStore - для работы с данными и фильтрами
// feedbackStore - для управления состоянием загрузки
const apiStore = useApiStore()
const feedbackStore = useFeedbackStore()

// Реактивное состояние для управления раскрытием списка отделений
const expanded = ref(false)
// Максимальное количество отображаемых отделений в свернутом состоянии
const maxVisibleItems = 3

// Вычисляемое свойство: статистика по отделениям
const departmentsStats = computed(() => apiStore.adverseEventsStats?.departments || [])

// Вычисляемое свойство: видимые отделения (зависит от expanded)
const visibleDepartments = computed(() => {
    return expanded.value
        ? departmentsStats.value // Показываем все если expanded
        : departmentsStats.value.slice(0, maxVisibleItems) // Иначе только первые maxVisibleItems
})

// Данные для отображения статистики рисков
const statsData = ref([
    { label: 'Низкий риск', value: 0, color: '#475569' }, // Данные для низкого риска
    { label: 'Средний риск', value: 0, color: 'rgb(251, 191, 36)' }, // Данные для среднего риска
    { label: 'Высокий риск', value: 0, color: '#ef4444' } // Данные для высокого риска
])

// Эффект для обновления статистики рисков при изменении данных
watchEffect(() => {
    const risk = apiStore.adverseEventsStats?.risk
    if (risk) {
        // Рассчитываем общее количество событий
        const total = risk.high + risk.middle + risk.low
        // Обновляем проценты для каждого уровня риска
        statsData.value[0].value = total ? (risk.low / total) * 100 : 0 // Низкий риск
        statsData.value[1].value = total ? (risk.middle / total) * 100 : 0 // Средний риск
        statsData.value[2].value = total ? (risk.high / total) * 100 : 0 // Высокий риск
    }
})

// Обработчик клика по отделению
const handleDepartmentClick = (dept: { id: string | null }) => {
    const id = dept.id
    if (id === null) {
        // Сброс фильтра по отделениям
        apiStore.filters.department = []
    } else {
        // Текущие выбранные отделения
        const current = apiStore.filters.department
        // Добавляем или удаляем отделение из фильтра
        apiStore.filters.department = current.includes(id)
            ? current.filter(x => x !== id) // Удаляем если уже есть
            : [...current, id] // Добавляем если нет
    }
    // При серверной фильтрации загружаем данные заново
    if (apiStore.filtrationType === 'server') {
        apiStore.loadAdverseEvents()
    }
}
</script>

<template>
    <!-- Основной контейнер (адаптивный) -->
    <div class="flex flex-col md:flex-row col-span-full">
        <!-- Блок с отделениями (занимает 7/12 на десктопе) -->
        <div v-if="departmentsStats.length > 0"  class="w-full md:w-7/12 flex flex-col">
            <!-- Панель со списком отделений -->
            <Panel header="Отделения">
                <!-- Состояние загрузки -->
                <div v-if="feedbackStore.isGlobalLoading" class="grid grid-cols-auto-fill-230 gap-2 min-h-[44px]">
                    <Button variant="text" raised><Skeleton /></Button>
                    <Button variant="text" raised><Skeleton /></Button>
                </div>
                <!-- Основное состояние -->
                <div v-else class="grid grid-cols-auto-fill-230 gap-2">
                    <!-- Кнопки отделений -->
                    <Button
                        v-for="(dept, index) in visibleDepartments"
                        :key="dept.id ?? index"
                        :severity="dept.id ? 'info' : 'secondary'"
                        :label="dept.name ?? 'Не выбрано'"
                        :badge="String(dept.count)"
                        variant="outlined"
                        @click="handleDepartmentClick(dept)"
                    />
                </div>
            </Panel>
            <!-- Кнопка раскрытия/сворачивания списка -->
            <div v-if="departmentsStats.length > maxVisibleItems" class="w-full text-center">
                <Button
                    class="w-full"
                    severity="info"
                    :label="expanded ? 'Свернуть' : 'Раскрыть список'"
                    @click="expanded = !expanded"
                    text
                    :icon="expanded ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
                    :icon-pos="expanded ? 'top' : 'bottom'"
                />
            </div>
        </div>
        <!-- Вертикальный разделитель (только на десктопе) -->
        <div v-if="departmentsStats.length > 0 && apiStore.adverseEventsStats?.count"  class="w-full md:w-1/12">
            <Divider layout="vertical" class="!hidden md:!flex" />
        </div>
        <!-- Блок со статистикой рисков (занимает 4/12 на десктопе) -->
        <div v-if="apiStore.adverseEventsStats?.count" class="w-full h-full md:w-4/12 flex flex-col">
            <Panel class="min-h-[98px]">
                <!-- Заголовок с общим количеством событий -->
                <template #header>
                    <span>Количество нежелательных событий - {{ apiStore.adverseEventsStats?.count ?? 0 }}</span>
                </template>
                <!-- График статистики рисков -->
                <MeterGroup :value="statsData" />
            </Panel>
        </div>
    </div>
</template>

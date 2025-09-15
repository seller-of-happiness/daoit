<script setup lang="ts">
/*
* Компонент AdverseEventsLayout - основной лейаут для работы с нежелательными явлениями
*
* Функционал:
* - Загрузка и управление данными о нежелательных явлениях
* - Интеграция с API через apiStore
* - Управление состоянием загрузки через feedbackStore
* - Серверная фильтрация данных
* - Композиция дочерних компонентов:
*   * Панель отделений и статистики
*   * Фильтры таблицы инцидентов
*   * Таблица инцидентов
*
* Особенности:
* - Автоматическая загрузка данных при монтировании
* - Реакция на изменение фильтров (в server-режиме)
* - Централизованное управление состоянием через хранилища
*/

import { useApiStore } from '@/refactoring/modules/apiStore/stores/apiStore'
import { useFeedbackStore } from '@/refactoring/modules/feedback/stores/feedbackStore'
import { useCentrifugeStore } from '@/refactoring/modules/centrifuge/stores/centrifugeStore'
import { onMounted, onBeforeUnmount } from 'vue'
import { useCentrifugeHelper } from '@/refactoring/utils/subscribeHelpers'


// Импорты компонентов
import DepartmentsAndStatisticsPanel from '@/components/adverseEvents/DepartmentsAndStatisticsPanel.vue'
import IncidentsTable from '@/components/adverseEvents/IncidentsTable.vue'
import IncidentsTableFilters from '@/components/tableFilters/IncidentsTableFilters.vue'

// Импорты типов
import type { IAdverseEvent } from '@/refactoring/modules/apiStore/types/adverse-events/IAdverseEvent'



// Инициализация хранилищ
const apiStore = useApiStore() // Хранилище API-запросов и данных
const feedbackStore = useFeedbackStore() // Хранилище состояния UI (загрузки и т.д.)
const centrifugeStore = useCentrifugeStore() // Подписка на канал

const { subscribeToList } = useCentrifugeHelper()

let adverseEventsChannel: string | null = null


/**
 * Хук монтирования компонента
 *
 * Выполняет:
 * 1. Устанавливает флаг загрузки
 * 2. Загружает все необходимые данные:
 *    - Список отделений
 *    - Категории нежелательных явлений
 *    - Сотрудников
 *    - Структуру больницы
 *    - Данные о нежелательных явлениях
 * 3. Снимает флаг загрузки
 */
onMounted(async () => {
    feedbackStore.isGlobalLoading = true
    if (!apiStore.departments?.length) {
        await apiStore.fetchAllDepartments()
    }
    await apiStore.fetchAllAdverseEventCategories()
    if (!apiStore.employees?.length) {
        await apiStore.fetchAllEmployees()
    }
    if (!apiStore.hospitalSkeleton?.length) {
        await apiStore.fetchHospitalSkeleton()
    }
    await apiStore.loadAdverseEvents()

    await subscribeToList<IAdverseEvent>('adverseevent', async (data) => {
        await apiStore.applyAdverseEventRealtime(data)
    })

    feedbackStore.isGlobalLoading = false
})


/**
 * Хук размонтирования
 * [CHANGED] Отписывается от персонального канала, если был создан
 */
onBeforeUnmount(() => {
    if (adverseEventsChannel) {
        centrifugeStore.centrifugeUnsubscribe(adverseEventsChannel) // [ADD] корректная отписка
    }
})
</script>

<template>
    <!--
      Основной лейаут для работы с нежелательными явлениями

      Структура:
      - 12-колоночная сетка с промежутками 8px
      - Компоненты:
        1. DepartmentsAndStatisticsPanel - панель отделений и статистики
        2. IncidentsTableFilters - фильтры таблицы инцидентов
        3. IncidentsTable - таблица инцидентов
        4. router-view - для вложенных маршрутов

      Классы компонентов:
      - AdverseEventStatistics - панель статистики
      - IncidentsTableFilters - блок фильтров
      - IncidentsTable - таблица инцидентов
    -->
    <div class="grid grid-cols-12 gap-8">
        <DepartmentsAndStatisticsPanel class="AdverseEventStatistics"/>
        <IncidentsTableFilters class="IncidentsTableFilters"/>
        <IncidentsTable class="IncidentsTable"/>
        <router-view></router-view>
    </div>
</template>

<style>
/*
  Стили компонента:
  - Базовые стили наследуются из системы дизайна
  - Используется CSS Grid для расположения элементов
  - Отступы между элементами: 8px (gap-8)

  Примечание:
  - Специфические стили вынесены в дочерние компоненты
  - Основной layout управляется утилитарными классами Tailwind
*/
</style>

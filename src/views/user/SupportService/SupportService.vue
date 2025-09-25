<script setup lang="ts">
/*
 * Компонент страницы сервиса вспомогательных служб
 *
 * Основные функции:
 * - Инициализация данных для работы сервиса поддержки
 * - Компоновка дочерних компонентов (фильтры, статистика, таблица)
 * - Централизованная загрузка необходимых данных при монтировании
 *
 * Особенности:
 * - Выступает контейнером для основных компонентов сервиса поддержки
 * - Управляет глобальным состоянием загрузки
 * - Не содержит собственной логики отображения, только компоновка
 *
 * Используемые хранилища:
 * - supportServiceStore: управление данными заявок и категорий
 * - apiStore: доступ к данным сотрудников, отделов и структуры зданий
 * - feedbackStore: управление состоянием загрузки
 *
 * Подключенные компоненты:
 * - SupportServiceFilters: компонент фильтрации заявок
 * - SupportServiceStatistics: компонент отображения статистики
 * - SupportServiceTable: компонент таблицы с заявками
 */

// Импорты Vue
import { onMounted } from 'vue'

// Импорты хранилищ
import { useApiStore } from '@/refactoring/modules/apiStore/stores/apiStore'
import { useSupportService } from '@/refactoring/modules/supportService/stores/supportService'
import { useFeedbackStore } from '@/refactoring/modules/feedback/stores/feedbackStore'
import { useCentrifugeStore } from '@/refactoring/modules/centrifuge/stores/centrifugeStore'
import { useUserStore } from '@/refactoring/modules/user/stores/userStore'

// Импорты компонентов
import SupportServiceFilters from '@/components/SupportService/SupportServiceFilters.vue'
import SupportServiceStatistics from '@/components/SupportService/SupportServiceStatistics.vue'
import SupportServiceTable from '@/components/SupportService/SupportServiceTable.vue'

// Импорты типов
import type { IRealtimePayload } from '@/refactoring/modules/centrifuge/types/IRealtimePayload'
import type { ISupportServiceItem } from '@/refactoring/modules/supportService/types/ISupportServiceItem'

// Инициализация хранилищ
const supportServiceStore = useSupportService()
const apiStore = useApiStore()
const feedbackStore = useFeedbackStore()
const centrifugeStore = useCentrifugeStore()
const userStore = useUserStore()

/**
 * Хук жизненного цикла - монтирование компонента
 * Загружает все необходимые данные для работы сервиса поддержки:
 * - Категории сервиса поддержки
 * - Группы сервиса поддержки
 * - Список всех сотрудников
 * - Список всех отделов
 * - Структуру зданий
 * Управляет состоянием глобальной загрузки во время выполнения запросов
 */
onMounted(async () => {
    feedbackStore.isGlobalLoading = true
    await supportServiceStore.fetchSupportServiceCategories()
    await supportServiceStore.fetchSupportServiceGroups()
    if (!apiStore.employees?.length) {
        await apiStore.fetchAllEmployees()
    }
    if (!apiStore.departments?.length) {
        await apiStore.fetchAllDepartments()
    }
    if (!apiStore.hospitalSkeleton?.length) {
        await apiStore.fetchHospitalSkeleton()
    }
    // Подписка на обновления заявок ВС

    const uuid = String(userStore.user?.id)
    if (uuid) {
        const channel = `tables:support_service#${uuid}`
        await centrifugeStore.subscribe(channel, async (data: IRealtimePayload<ISupportServiceItem>) => {
            if (!data?.event_type || !data?.data) return
            await supportServiceStore.applySupportServiceRealtime(data)
        })
    }
    feedbackStore.isGlobalLoading = false
})
</script>

<template>
    <div class="grid grid-cols-12 gap-8">
        <SupportServiceStatistics />
        <SupportServiceFilters />
        <SupportServiceTable />
        <router-view></router-view>
    </div>
</template>

<style>
</style>

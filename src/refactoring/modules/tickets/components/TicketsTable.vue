<script setup lang="ts">
/*
 * Компонент: TicketsTable — список тикетов с фильтрацией и действиями
 *
 * Основные функции:
 * - Отображает таблицу тикетов с пагинацией и сортировкой
 * - Поддерживает кликабельные строки для перехода к деталям тикета
 * - Обновляет данные по кнопке или через подписку Centrifugo (realtime)
 * - Отображает статусы, приоритеты и категории тикетов в удобочитаемом виде
 * - Предоставляет возможность создания нового тикета
 *
 * Используемые сторы и утилиты:
 * - ticketsStore: загрузка, хранение и realtime-обновление тикетов
 * - feedbackStore: глобальное состояние загрузки и уведомления
 * - apiStore: справочники (статусы, категории)
 * - useCentrifugeHelper: подписка на обновления тикетов
 *
 * Основные состояния:
 * - tickets.tickets — список тикетов для таблицы
 * - feedbackStore.isGlobalLoading — отображение состояния загрузки
 */

import { onMounted } from 'vue'
import { useTicketsStore } from '@/refactoring/modules/tickets/stores/ticketsStore'
import { useFeedbackStore } from '@/refactoring/modules/feedback/stores/feedbackStore'
import { useRouter } from 'vue-router'
import { formatResponsibilityDate } from '@/refactoring/utils/formatters'
import { useApiStore } from '@/refactoring/modules/apiStore/stores/apiStore'
import { useCentrifugeHelper } from '@/refactoring/utils/subscribeHelpers'

import { ERouteNames } from '@/router/ERouteNames'

import TicketsFilters from '@/refactoring/modules/tickets/components/TicketsFilters.vue'

import type { ITicketListItem } from '@/refactoring/modules/tickets/types/ITicketListItem'
import { ITicketDetail } from '@/refactoring/modules/tickets/types/ITicketDetail'

const feedbackStore = useFeedbackStore()
const tickets = useTicketsStore()
const router = useRouter()
const apiStore = useApiStore()

const { subscribeToList } = useCentrifugeHelper()

/**
 * Возвращает читаемое название статуса тикета
 *
 * @param status string — ключ статуса из API
 * @returns string — человекочитаемый текст или "----", если статус пустой
 *
 * Использует:
 * - apiStore.responsibilityEntriesStatuses
 */
function getStatusLabel(status: string) {
    if (!status) return '----'
    const statuses = apiStore.responsibilityEntriesStatuses
    return (statuses as Record<string, string>)[status] || status
}

/**
 * Обработчик создания нового тикета
 *
 * Действия:
 * - Сбрасывает текущий тикет в null
 * - Переводит пользователя на маршрут создания тикета
 */
function createTicket() {
    tickets.currentTicket = null
    router.push({ name: ERouteNames.CREATE_TICKET })
}


/**
 * Обработчик клика по строке таблицы
 *
 * @param event any — событие DataTable
 *
 * Действия:
 * - Берёт item из event.data
 * - Переводит пользователя на страницу деталей тикета
 */
const handleRowClick = async (event: any) => {
    const item = event.data as ITicketListItem;
    await router.push({
        name: ERouteNames.TICKET_DETAIL,
        params: { id: item.id }
    });
};

/**
 * Возвращает CSS-класс для индикатора приоритета
 *
 * @param priority number — числовое значение приоритета
 * @returns string — класс для цветной точки (low | medium | high | critical)
 */
const priorityClass = (priority: number): string => {
    switch (priority) {
        case 0: return 'low'
        case 1: return 'medium'
        case 2: return 'high'
        case 3: return 'critical'
        default: return ''
    }
}

/**
 * При монтировании:
 * - Загружает категории тикетов (если ещё не загружены)
 * - Загружает список тикетов
 * - Подписывается на realtime-обновления тикетов через Centrifugo
 */
onMounted(async () => {
    if (!tickets.categories.length) await tickets.fetchCategories()
    await tickets.fetchTickets()
    await subscribeToList<ITicketDetail>('ticket', async (data) => {
        await tickets.applyTicketRealtime(data)
    })
})
</script>

<template>
    <div class="grid grid-cols-12 gap-8">
        <div class="col-span-12">
            <tickets-filters />
        </div>
        <div class="card col-span-12 p-4">
        <Toolbar class="mb-6">
            <template #start>
                <Button label="Сообщить о проблеме" icon="pi pi-plus" severity="info" class="mr-2" @click="createTicket" />
            </template>
            <template #end>
                <Button icon="pi pi-refresh" rounded severity="secondary" label="Обновить" class="mr-2" @click="tickets.fetchTickets()" />
            </template>
        </Toolbar>

        <DataTable
            :value="tickets.tickets"
            :paginator="true"
            :rows="10"
            :rowsPerPageOptions="[10, 15, 25]"
            dataKey="id"
            class="no-row-gaps"
            @row-click="handleRowClick"
        >
            <template #empty>
                <div class="flex justify-center italic">Данные отсутствуют</div>
            </template>

            <Column field="number">
                <template #header>
                    <p class="font-bold mb-0">№</p>
                </template>
            </Column>
            <Column field="title">
                <template #header>
                    <p class="font-bold mb-0">Заголовок</p>
                </template>
            </Column>
            <Column field="category.name">
                <template #header>
                    <p class="font-bold mb-0">Категория</p>
                </template>
                <template #body="{ data }">
                    {{ data.category?.name }}
                </template>
            </Column>
            <Column field="priority">
                <template #header>
                    <p class="font-bold mb-0">Приоритет</p>
                </template>
                <template #body="{ data }">
                    <div class="flex items-center gap-2">
            <span
                v-if="data.priority !== null && data.priority !== undefined"
                class="priority-dot"
                :class="priorityClass(data.priority)"
            ></span>
                        {{
                            tickets.priorityOptions.find(opt => opt.value === data.priority)?.label
                            || '—'
                        }}
                    </div>
                </template>
            </Column>
            <Column field="status">
                <template #header>
                    <p class="font-bold mb-0">Статус</p>
                </template>
                <template #body="{ data }">
                    <Skeleton v-if="feedbackStore.isGlobalLoading"></Skeleton>
                    <div v-else class="status-badge" :class="data.status">
                        {{ getStatusLabel(data.status) }}
                    </div>
                </template>
            </Column>
            <Column field="created_at">
                <template #header>
                    <p class="font-bold mb-0">Создан</p>
                </template>
                <template #body="{ data }">
                    {{ formatResponsibilityDate(data.created_at) }}
                </template>
            </Column>
        </DataTable>
        </div>
        <router-view />
    </div>
</template>

<style scoped>
:deep(.p-datatable .p-datatable-tbody > tr:hover) {
    background-color: var(--table-row-hover) !important;
    cursor: pointer;
}

.priority-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    display: inline-block;
}

.priority-dot.low { background: var(--p-green-400); }
.priority-dot.medium { background: var(--p-orange-400); }
.priority-dot.high { background: var(--p-yellow-400); }
.priority-dot.critical { background: var(--p-red-400); }
</style>



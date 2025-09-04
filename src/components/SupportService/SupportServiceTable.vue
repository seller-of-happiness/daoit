<script setup lang="ts">
/*
 * Компонент таблицы заявок сервиса поддержки
 *
 * Основные функции:
 * - Отображение списка заявок в табличном виде
 * - Управление заявками (просмотр, редактирование, удаление)
 * - Фильтрация и форматирование данных для отображения
 * - Интеграция с глобальным подтверждением действий
 *
 * Особенности:
 * - Поддерживает экспорт данных таблицы
 * - Использует глобальные хранилища для доступа к данным
 * - Форматирует данные для корректного отображения
 *
 * Используемые хранилища:
 * - supportServiceStore: хранение и управление заявками
 * - apiStore: доступ к данным сотрудников
 * - feedbackStore: управление состоянием загрузки
 *
 * Подключенные утилиты:
 * - useGlobalConfirm: модальное окно подтверждения действий
 * - formatDateTime: форматирование даты и времени
 */

// Импорты Vue и сторонних библиотек
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'

// Импорты утилит и хранилищ
/*import { useGlobalConfirm } from '@/refactoring/modules/feedback/utils/useGlobalConfirm'*/
import { useSupportService } from '@/refactoring/modules/supportService/stores/supportService'
import { useFeedbackStore } from '@/refactoring/modules/feedback/stores/feedbackStore'
import { formatResponsibilityDate } from '@/refactoring/utils/formatters'

// Импорты типов
import type { ISupportServiceItem } from '@/refactoring/modules/supportService/types/ISupportServiceItem'
import { ERouteNames } from '@/router/ERouteNames'

// Инициализация роутера и утилит
const router = useRouter()
/*const confirmAction = useGlobalConfirm()*/

// Инициализация хранилищ
const supportServiceStore = useSupportService()
const feedbackStore = useFeedbackStore()

// Деструктуризация значений из хранилищ
const { supportServices, priority } = storeToRefs(supportServiceStore)
const { isGlobalLoading } = storeToRefs(feedbackStore)

// Реактивные переменные
const table = ref()  // Ссылка на компонент DataTable для управления экспортом данных

/**
 * Получение ФИО инициатора заявки
 * @param data - Объект заявки сервиса поддержки
 * @returns Отформатированная строка с ФИО или пустая строка
 */
function initiatorForFilter(data: ISupportServiceItem): string {
    const p = (data as any)?.created_by as
        | { last_name?: string; first_name?: string; middle_name?: string }
        | undefined
    return [p?.last_name, p?.first_name, p?.middle_name].filter(Boolean).join(' ') || 'Не удалось определить'
}

/**
 * Получение названия группы сервиса
 * @param data - Объект заявки сервиса поддержки
 * @returns Название группы сервиса или пустая строка
 */
function groupForFilter(data: ISupportServiceItem): string {
    return data.service_group?.name || ''
}

/**
 * Получение названия приоритета заявки
 * @param data - Объект заявки сервиса поддержки
 * @returns Название приоритета или пустая строка
 */
function priorityForFilter(data: ISupportServiceItem): string {
    return priority.value?.find((item) => item.value === data.priority)?.label || ''
}

/**
 * Форматирование даты и времени создания заявки
 * @param data - Объект заявки сервиса поддержки
 * @returns Отформатированная строка с датой и временем
 */
function dateTimeForFilter(data: ISupportServiceItem): string {
    return formatResponsibilityDate(data.created_at)
}

/**
 * Категория работы (service_category.name)
 */
function categoryForFilter(data: ISupportServiceItem): string {
    return (data as any).service_category?.name || ''
}

/**
 * Заглушка для поля статуса
 * @param _data - Объект заявки сервиса поддержки
 * @returns Пустая строка (поле не реализовано)
 */
function statusForFilter(_data: ISupportServiceItem): string {
    return ''
}

/**
 * Сброс фильтров заявок
 * Вызывает метод хранилища для сброса параметров фильтрации
 */
function renewData() {
    supportServiceStore.resetFilters()
}
/*
/!**
 * Удаление заявки с подтверждением
 * @param item - Объект заявки для удаления
 *!/
async function deleteAction(item: ISupportServiceItem) {
    if (!item || !item.id) return

    try {
        await confirmAction({
            message: `Удалить заявку № ${item.id}?`,
            header: 'Подтверждение действия',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Удалить',
            rejectLabel: 'Отмена',
            acceptClass: 'p-button-danger'
        })
        await supportServiceStore.deleteSupportService(item.id)
    } catch {
        // Пользователь отменил — ничего не делаем
    }
}*/
/*
/!**
 * Создание кнопок действий для таблицы
 * @param item - Объект заявки для действий
 * @returns Массив объектов-кнопок с обработчиками
 *!/
function createTableActionButtons(item: ISupportServiceItem) {
    return [
        {
            label: 'Просмотреть',
            icon: 'pi pi-map',
            command: () => {
                router.push({ name: 'view-support-service', params: { id: item.id } })
            },
        },
        {
            label: 'Редактировать',
            icon: 'pi pi-pen-to-square',
            command: () => {
                router.push({ name: 'edit-support-service', params: { id: item.id } })
            },
        },
        {
            label: 'Удалить',
            icon: 'pi pi-trash',
            command: () => {
                deleteAction(item)
            },
        },
    ]
}*/
/**
 * Обрабатывает изменение страницы в таблице
 * @param event - объект с параметрами пагинации
 */
function handlePageChange(event: { first: number; rows: number }) {
    // Если дошли до конца и есть next
    const lastIndex = event.first + event.rows
    if (
        lastIndex >= supportServiceStore.supportServices.length &&
        supportServiceStore.nextSupportServiceCursor
    ) {
        // Получение cursor параметра
        const cursorParam = new URL(supportServiceStore.nextSupportServiceCursor).searchParams.get('cursor')
        supportServiceStore.fetchFilteredSupportServices(cursorParam || undefined)
    }
}

// Добавляем обработчик клика по строке
const handleRowClick = async (event: any) => {
    const item = event.data as ISupportServiceItem;

    // Просто переход к детализации без указания режима
    await router.push({
        name: ERouteNames.SUPPORT_SERVICE_DETAIL,
        params: { id: item.id }
    });
};
</script>


<template>
    <div class="card col-span-12">
        <Toolbar class="mb-6">
            <template #start>
                <Button
                    :disabled="isGlobalLoading"
                    label="Добавить"
                    severity="info"
                    icon="pi pi-plus"
                    class="mr-2"
                    @click="router.push({ name: ERouteNames.CREATE_SUPPORT_SERVICE })"
                />
            </template>

            <template #end>
                <Button
                    icon="pi pi-refresh"
                    rounded
                    severity="secondary"
                    label="Сбросить фильтры и обновить данные"
                    :loading="isGlobalLoading"
                    :disabled="isGlobalLoading"
                    class="mr-2"
                    @click="renewData"
                />
                <Button
                    :disabled="isGlobalLoading"
                    label="Экспорт"
                    icon="pi pi-upload"
                    severity="info"
                    @click="() => table.exportCSV()"
                />
            </template>
        </Toolbar>
        <DataTable
            @page="handlePageChange"
            @row-click="handleRowClick"
            :paginator="true"
            :rowsPerPageOptions="[10, 15, 25]"
            :rows="10"
            ref="table"
            :value="supportServices"
            :globalFilterFields="[
                'number',
                initiatorForFilter,
                groupForFilter,
                categoryForFilter,
                priorityForFilter,
                dateTimeForFilter,
                statusForFilter,
            ]"
            dataKey="id"
            tableStyle="min-width: 50rem"
            class="no-row-gaps"
        >
            <template #empty>
                <div class="flex justify-center italic">Данные отсутствуют</div>
            </template>
            <Column field="number">
                <template #header>
                    <p class="font-bold mb-0">№</p>
                </template>
                <template #body="{ data }">
                    <Skeleton v-if="isGlobalLoading"></Skeleton>
                    <div v-else>{{ data.number }}</div>
                </template>
            </Column>
            <Column field="initiator">
                <template #header>
                    <p class="font-bold">Постановщик заявки</p>
                </template>
                <template #body="{ data }">
                    <Skeleton v-if="isGlobalLoading"></Skeleton>
                    <div v-else>
                        {{ initiatorForFilter(data) }}
                    </div>
                </template>
            </Column>
            <Column field="group">
                <template #header>
                    <p class="font-bold mb-0">Служба</p>
                </template>
                <template #body="{ data }">
                    <Skeleton v-if="isGlobalLoading"></Skeleton>
                    <div v-else>{{ groupForFilter(data) }}</div>
                </template>
            </Column>
<!--            <Column field="performer">
                <template #header>
                    <p class="font-bold">Исполнитель</p>
                </template>
                <template #body="{ data }">
                    <Skeleton v-if="isGlobalLoading"></Skeleton>
                    <div v-else>{{ performerForFilter(data) }}</div>
                </template>
            </Column>-->

            <Column field="category">
                <template #header>
                    <p class="font-bold mb-0">Категория работ</p>
                </template>
                <template #body="{ data }">
                    <Skeleton v-if="isGlobalLoading" />
                    <div v-else>{{ categoryForFilter(data) }}</div>
                </template>
            </Column>

            <Column field="priority">
                <template #header>
                    <p class="font-bold">Приоритет</p>
                </template>
                <template #body="{ data }">
                    <Skeleton v-if="isGlobalLoading"></Skeleton>
                    <div v-else>{{ priorityForFilter(data) }}</div>
                </template>
            </Column>
            <Column field="time" :style="{ 'min-width': '145px' }">
                <template #header>
                    <p class="font-bold">Дата и время</p>
                </template>
                <template #body="{ data }">
                    <Skeleton v-if="isGlobalLoading"></Skeleton>
                    <div v-else>{{ dateTimeForFilter(data) }}</div>
                </template>
            </Column>
            <Column field="status">
                <template #header>
                    <p class="font-bold">Статус</p>
                </template>
                <template #body="{ data }">
                    <Skeleton v-if="isGlobalLoading"></Skeleton>
                    <div v-if="data.completed" class="status-badge completed">Завершен</div>
                    <div v-else class="status-badge new">Новое</div>
                </template>
            </Column>
<!--            <Column field="action">
                <template #header>
                    <p class="font-bold">Действие</p>
                </template>
                <template #body="{ data }">
                    <SplitButton
                        label="Действие"
                        @click="() => {}"
                        :model="createTableActionButtons(data)"
                        severity="secondary"
                    />
                </template>
            </Column>-->
        </DataTable>
    </div>
</template>

<style scoped>
:deep(.p-datatable .p-datatable-tbody > tr) {
    cursor: pointer;
    transition: background-color 0.2s;
}

:deep(.p-datatable .p-datatable-tbody > tr:hover) {
    background-color: var(--table-row-hover) !important;
}

/* Отключаем выделение выбранной строки */
:deep(.p-datatable .p-datatable-tbody > tr.p-datatable-row-selected),
:deep(.p-datatable .p-datatable-tbody > tr.p-highlight) {
    background-color: inherit !important;
    color: inherit !important;
}

.status-badge {
    display: inline-flex;
    align-items: center;
    justify-content: flex-start;
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    line-height: 1.25rem;
    width: 100%;
    text-align: center;
}

.status-badge.completed {
    background-color: #dcfce7; /* зеленый */
    color: #166534;
    justify-content: center;
}

.status-badge.new {
    background-color: #e0f2fe; /* голубой */
    color: #0369a1;
    justify-content: center;
}
</style>

<script setup>
/*
 * Компонент AppMenu - главное меню приложения
 *
 * Функционал:
 * - Отображение иерархической структуры меню
 * - Динамическое переключение между обычным и админ-меню
 * - Поддержка вложенных пунктов меню
 * - Интеграция с системой маршрутизации
 *
 * Особенности:
 * - Два режима меню (обычное/админское)
 * - Автоматическое определение текущего режима по URL
 * - Поддержка иконок для пунктов меню
 * - Гибкая структура с возможностью вложенности
 */

import { computed, onMounted, ref } from 'vue'
import { useCalendarStore } from '@/refactoring/modules/calendar/stores/calendarStore'
import { useRouter } from 'vue-router'
import { ERouteNames } from '@/router/ERouteNames'

import AppMenuItem from './AppMenuItem.vue'

const router = useRouter()
const calendarStore = useCalendarStore()

// Модель данных для админского меню
const modelAdmin = ref([
    {
        label: 'Главная',
        items: [
            { label: 'Панель инструментов', icon: 'pi pi-fw pi-home', to: '/admin/dashboard' },
            { label: 'Должности', icon: 'pi pi-fw pi-home', to: '/admin/employee-position' },
            { label: 'Здания', icon: 'pi pi-fw pi-bell', to: '/admin/buildings' },
            { label: 'Отделения', icon: 'pi pi-fw pi-check-square', to: '/admin/departments' },
            {
                label: 'Помещения',
                icon: 'pi pi-fw pi-book',
                to: '/admin/rooms',
                class: 'rotated-icon',
            },
            { label: 'Сотрудники', icon: 'pi pi-fw pi-bolt', to: '/admin/employees' },
            { label: 'Типы помещений', icon: 'pi pi-fw pi-bolt', to: '/admin/room-types' },
            { label: 'Этажи', icon: 'pi pi-fw pi-bolt', to: '/admin/floors' },
            {
                label: 'Виды нежелательных событий',
                icon: 'pi pi-fw pi-bolt',
                to: '/admin/adverse-event-types',
            },
            {
                label: 'Категории событий',
                icon: 'pi pi-fw pi-bolt',
                to: '/admin/adverse-event-categories',
            },
            {
                label: 'Предложения по улучшению',
                icon: 'pi pi-fw pi-lightbulb',
                to: { name: ERouteNames.IMPROVEMENTS },
            },
        ],
    },
])

// Модель данных для обычного меню
const model = ref([
    {
        label: 'Главная',
        items: [
            {
                label: 'Актуальное',
                icon: 'pi pi-fw pi-bolt',
                to: { name: ERouteNames.ACTUAL },
            },
            {
                label: 'Дашборд',
                icon: 'pi pi-fw pi-th-large',
                to: { name: ERouteNames.HEATMAP },
            },
            {
                label: 'Мониторинг',
                icon: 'pi pi-fw pi-chart-line',
                to: { name: ERouteNames.DASHBOARD },
            },
            {
                label: 'Консультации',
                icon: 'pi pi-fw pi-comments',
                to: { name: ERouteNames.CONSULTATIONS },
            },
            {
                label: 'Закупки',
                icon: 'pi pi-fw pi-wallet',
                to: { name: ERouteNames.PURCHASES },
            },
            {
                label: 'Извещения',
                icon: 'pi pi-fw pi-envelope',
                to: { name: ERouteNames.NOTIFICATION },
            },
            {
                label: 'Полезные ссылки',
                icon: 'pi pi-fw pi-link',
                to: { name: ERouteNames.LINKS },
            },
            {
                label: 'Файлы',
                icon: 'pi pi-fw pi-folder',
                to: { name: ERouteNames.FILES },
            },
            {
                label: 'Новости',
                icon: 'pi pi-fw pi-megaphone',
                to: { name: ERouteNames.NEWS },
            },
        ],
    },
    {
        label: 'Управление',
        items: [
            {
                label: 'Нежелательные события',
                icon: 'pi pi-fw pi-exclamation-triangle',
                to: { name: ERouteNames.ADVERSE_EVENTS },
            },
/*            {
                label: 'Заявки',
                icon: 'pi pi-fw pi-wrench',
                to: { name: ERouteNames.SUPPORT_SERVICE },
            },*/
            {
                label: 'Документы',
                icon: 'pi pi-fw pi-file',
                to: { name: ERouteNames.DOCUMENTS },
            },
            {
                label: 'Заявки',
                icon: 'pi pi-fw pi-wrench',
                to: { name: ERouteNames.TICKETS },
            },
            {
                label: 'Предложения по улучшению',
                icon: 'pi pi-fw pi-lightbulb',
                to: { name: ERouteNames.IMPROVEMENTS },
            },
            {
                label: 'Календари',
                icon: 'pi pi-fw pi-calendar',
                to: { name: ERouteNames.CALENDAR },
                items: computed(() => [
                    ...calendarStore.calendars.map((calendar) => ({
                        label: calendar.name,
                        icon: 'pi pi-fw pi-calendar',
                        to: {
                            name: ERouteNames.CURRENT_CALENDAR,
                            params: { id: calendar.id },
                        },
                        badge: {
                            value: '',
                            style: {
                                backgroundColor: calendar.color,
                                width: '10px',
                                height: '10px',
                                borderRadius: '50%',
                            },
                        },
                    })),
                ]),
            },
        ],
    },
    {
        label: 'Учёт',
        icon: 'pi pi-fw pi-briefcase',
        to: '/pages',
        items: [
            {
                label: 'Кадры',
                icon: 'pi pi-fw pi-address-book',
                to: { name: ERouteNames.STAFF },
            },
            {
                label: 'Аналитика',
                icon: 'pi pi-fw pi-chart-bar',
                to: { name: ERouteNames.ANALYTICS },
            },
            {
                label: 'Журналы',
                icon: 'pi pi-fw pi-database',
                to: { name: ERouteNames.JOURNALS },
            },
        ],
    },
])

/**
 * Вычисляемая модель меню
 *
 * Определяет какую модель использовать (обычную или админскую)
 * на основе текущего маршрута
 */
const menuModel = computed(() => {
    const isAdmin = router.currentRoute.value.path.startsWith('/admin')
    return isAdmin ? modelAdmin.value : model.value
})

onMounted(async () => {
    if (!calendarStore.calendars.length) {
        await calendarStore.fetchCalendars()
    }
})
</script>

<template>
    <!--
      Основной контейнер меню:
      - Рендерит пункты меню через компонент AppMenuItem
      - Поддерживает разделители (separator)
      - Автоматически выбирает нужную модель данных
    -->
    <ul class="layout-menu">
        <template v-for="(item, i) in menuModel" :key="item">
            <!-- Рендер пункта меню (если не разделитель) -->
            <app-menu-item v-if="!item.separator" :item="item" :index="i"></app-menu-item>

            <!-- Рендер разделителя меню -->
            <li v-if="item.separator" class="menu-separator"></li>
        </template>
    </ul>
</template>

<style lang="scss" scoped>
/*
  Стили компонента меню:

  .layout-menu - основной контейнер меню

  .menu-separator - стиль разделителя пунктов меню
  (должен быть определен в глобальных стилях)
*/
</style>

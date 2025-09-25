import { createRouter, createWebHistory } from 'vue-router'
import { ERouteNames } from '@/router/ERouteNames'
import { useAuthStore } from '@/refactoring/modules/authStore/stores/authStore'
import { useUserStore } from '@/refactoring/modules/user/stores/userStore'
import AppLayout from '@/layout/AppLayout.vue'

import type { RouteLocationNormalized, NavigationGuardNext } from 'vue-router'

const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: '/login',
            name: ERouteNames.LOGIN,
            component: () => import('@/views/Login.vue'),
            meta: { requiresAuth: false, name: 'Авторизация' },
        },
        {
            path: '/',
            name: ERouteNames.HOME,
            component: AppLayout,
            meta: { requiresAuth: true },
            redirect: ERouteNames.ACTUAL,
            children: [
                {
                    path: 'dashboard',
                    name: ERouteNames.DASHBOARD,
                    component: () => import('@/views/Dashboard.vue'),
                },
                {
                    path: 'documents',
                    name: ERouteNames.DOCUMENTS,
                    component: () =>
                        import('@/refactoring/modules/documents/components/DocumentsInterface.vue'),
                    meta: { name: 'Документы' },
                },
                {
                    path: 'documents/:pathMatch(.*)*',
                    name: ERouteNames.DOCUMENTS_FOLDER,
                    component: () =>
                        import('@/refactoring/modules/documents/components/DocumentsInterface.vue'),
                    meta: { name: 'Документы' },
                    props: (route) => ({
                        path: Array.isArray(route.params.pathMatch)
                            ? route.params.pathMatch
                            : route.params.pathMatch
                              ? (route.params.pathMatch as string).split('/').filter(Boolean)
                              : [],
                    }),
                },
                {
                    path: 'tickets',
                    name: ERouteNames.TICKETS,
                    component: () =>
                        import('@/refactoring/modules/tickets/components/TicketsTable.vue'),
                    meta: { name: 'Тикеты' },
                    children: [
                        {
                            path: 'create',
                            name: ERouteNames.CREATE_TICKET,
                            component: () =>
                                import('@/refactoring/modules/tickets/components/TicketForm.vue'),
                        },
                        {
                            path: 'edit/:id',
                            name: 'edit-ticket',
                            component: () =>
                                import('@/refactoring/modules/tickets/components/TicketForm.vue'),
                            props: true,
                        },
                        {
                            path: ':id',
                            name: ERouteNames.TICKET_DETAIL,
                            component: () =>
                                import('@/refactoring/modules/tickets/components/TicketDetail.vue'),
                            props: true,
                        },
                    ],
                },
                {
                    path: 'profile',
                    name: ERouteNames.USER_PROFILE,
                    component: () =>
                        import('@/refactoring/modules/user/components/UserProfile.vue'),
                },
                {
                    path: 'operation',
                    name: ERouteNames.SURGICAL_OPERATION,
                    component: () => import('@/components/SurgicalOperation.vue'),
                },
                {
                    path: 'staff',
                    name: ERouteNames.STAFF,
                    component: () => import('@/components/StaffInterface.vue'),
                },
                {
                    path: 'analytics',
                    name: ERouteNames.ANALYTICS,
                    component: () => import('@/components/AnalyticsInterface.vue'),
                },
                {
                    path: 'journals',
                    name: ERouteNames.JOURNALS,
                    component: () => import('@/components/JournalsInterface.vue'),
                },
                {
                    path: 'consultations',
                    name: ERouteNames.CONSULTATIONS,
                    component: () => import('@/components/ConsultationsInterface.vue'),
                },
                {
                    path: 'purchases',
                    name: ERouteNames.PURCHASES,
                    component: () => import('@/components/PurchasesInterface.vue'),
                },
                {
                    path: 'notifications',
                    name: ERouteNames.NOTIFICATION,
                    component: () => import('@/components/NotificationsInterface.vue'),
                },
                {
                    path: 'links',
                    name: ERouteNames.LINKS,
                    component: () =>
                        import('@/refactoring/modules/links/components/LinksInterface.vue'),
                },
                {
                    path: 'actual',
                    name: ERouteNames.ACTUAL,
                    component: () => import('@/refactoring/modules/actual/components/ActualList.vue'),
                },
                {
                    path: 'actual/:id',
                    name: ERouteNames.ACTUAL_DETAIL,
                    component: () => import('@/refactoring/modules/actual/components/ActualDetail.vue'),
                    props: true,
                },
                {
                    path: 'actual/create',
                    name: ERouteNames.ACTUAL_CREATE,
                    component: () => import('@/refactoring/modules/actual/components/ActualForm.vue'),
                    meta: { requiresAuth: true, requiresManager: true },
                },
                {
                    path: 'actual/edit/:id',
                    name: ERouteNames.ACTUAL_EDIT,
                    component: () => import('@/refactoring/modules/actual/components/ActualForm.vue'),
                    props: true,
                    meta: { requiresAuth: true, requiresManager: true },
                },
                {
                    path: 'news',
                    name: ERouteNames.NEWS,
                    component: () => import('@/refactoring/modules/news/components/NewsList.vue'),
                },
                {
                    path: 'news/:id',
                    name: ERouteNames.NEWS_DETAIL,
                    component: () => import('@/refactoring/modules/news/components/NewsDetail.vue'),
                    props: true,
                },
                {
                    path: 'heatmap',
                    name: ERouteNames.HEATMAP,
                    component: () => import('@/components/HeatMap/DepartmentsHeatmap.vue'),
                },
                {
                    path: 'chat/:param?',
                    name: ERouteNames.CHAT,
                    component: () =>
                        import('@/refactoring/modules/chat/components/ChatInterface.vue'),
                    props: (route) => ({
                        userId: route.params.param || undefined,
                    }),
                },
                {
                    path: 'improvements',
                    name: ERouteNames.IMPROVEMENTS,
                    component: () =>
                        import(
                            '@/refactoring/modules/improvements/components/ImprovementsInterface.vue'
                            ),
                },
                {
                    path: 'files',
                    name: ERouteNames.FILES,
                    component: () =>
                        import('@/refactoring/modules/files/components/FilesInterface.vue'),
                },
                {
                    path: 'adverse-events',
                    name: ERouteNames.ADVERSE_EVENTS,
                    component: () => import('@/views/user/AdverseEvents/AdverseEvents.vue'),
                    meta: { name: 'Нежелательные события' },
                    children: [
                        {
                            path: ':id', // Унифицированный путь вместо edit/:id и view/:id
                            name: ERouteNames.ADVERSE_EVENT_DETAIL, // Новое нейтральное имя
                            component: () =>
                                import('@/views/user/AdverseEvents/FormAdverseEvent.vue'),
                        },
                        {
                            path: 'create',
                            name: ERouteNames.CREATE_ADVERSE_EVENT,
                            component: () =>
                                import('@/views/user/AdverseEvents/FormAdverseEvent.vue'),
                        },
                    ],
                },
                {
                    path: 'support-service',
                    name: ERouteNames.SUPPORT_SERVICE,
                    component: () => import('@/views/user/SupportService/SupportService.vue'),
                    meta: { name: 'Заявки в вспомогательные службы' },
                    children: [
                        {
                            path: ':id', // Унифицированный путь вместо edit/:id и view/:id
                            name: ERouteNames.SUPPORT_SERVICE_DETAIL, // Новое нейтральное имя
                            component: () =>
                                import('@/views/user/SupportService/FormSupportService.vue'),
                        },
                        {
                            path: 'create',
                            name: ERouteNames.CREATE_SUPPORT_SERVICE,
                            component: () =>
                                import('@/views/user/SupportService/FormSupportService.vue'),
                        },
                    ],
                },
                {
                    path: 'calendar',
                    name: ERouteNames.CALENDAR,
                    component: () =>
                        import('@/refactoring/modules/calendar/components/Calendar.vue'),
                    meta: { name: 'Календарь' },
                    children: [
                        {
                            path: ':id',
                            name: ERouteNames.CURRENT_CALENDAR,
                            component: () =>
                                import(
                                    '@/refactoring/modules/calendar/components/CurrentCalendar.vue'
                                    ),
                        },
                        // Добавляем новые маршруты для работы с событиями
                        {
                            path: ':calendarId/events/create',
                            name: ERouteNames.CREATE_CALENDAR_EVENT,
                            component: () =>
                                import(
                                    '@/refactoring/modules/calendar/components/FormCalendarEvent.vue'
                                    ),
                            meta: { name: 'Создание события' },
                        },
                        {
                            path: ':calendarId/events/edit/:eventId',
                            name: ERouteNames.EDIT_CALENDAR_EVENT,
                            component: () =>
                                import(
                                    '@/refactoring/modules/calendar/components/FormCalendarEvent.vue'
                                    ),
                            meta: { name: 'Редактирование события' },
                        },
                        {
                            path: ':calendarId/events/view/:eventId',
                            name: ERouteNames.VIEW_CALENDAR_EVENT,
                            component: () =>
                                import(
                                    '@/refactoring/modules/calendar/components/FormCalendarEvent.vue'
                                    ),
                            meta: { name: 'Просмотр события' },
                        },
                    ],
                },
            ],
        },
        {
            path: '/admin',
            name: ERouteNames.ADMIN,
            component: AppLayout,
            meta: { requiresAuth: true },
            redirect: '/admin/dashboard',
            children: [
                {
                    path: 'dashboard',
                    name: ERouteNames.ADMIN_DASHBOARD,
                    component: () => import('@/views/admin/Dashboard.vue'),
                },
                {
                    path: 'employee-position',
                    name: ERouteNames.ADMIN_EMPLOYEE_POSITION,
                    component: () => import('@/views/admin/EmployeePositions.vue'),
                },
                {
                    path: 'buildings',
                    name: ERouteNames.ADMIN_BUILDINGS,
                    component: () => import('@/views/admin/Buildings.vue'),
                },
                {
                    path: 'departments',
                    name: ERouteNames.ADMIN_DEPARTMENTS,
                    component: () => import('@/views/admin/Departments.vue'),
                },
                /*                {
                    path: 'rooms',
                    name: ERouteNames.ADMIN_ROOMS,
                    component: () => import('@/views/admin/Rooms.vue'),
                },*/
                {
                    path: 'employees',
                    name: ERouteNames.ADMIN_EMPLOYEES,
                    component: () => import('@/views/admin/Employees.vue'),
                },
                /*                {
                    path: 'room-types',
                    name: ERouteNames.ADMIN_ROOM_TYPES,
                    component: () => import('@/views/admin/RoomTypes.vue'),
                },*/
                {
                    path: 'floors',
                    name: ERouteNames.ADMIN_FLOORS,
                    component: () => import('@/views/admin/Floors.vue'),
                },
                {
                    path: 'adverse-event-types',
                    name: ERouteNames.ADMIN_ADVERSE_EVENT_TYPES,
                    component: () => import('@/views/admin/AdverseEventTypes.vue'),
                },
                {
                    path: 'adverse-event-categories',
                    name: ERouteNames.ADMIN_EVENT_CATEGORIES,
                    component: () => import('@/views/admin/AdverseEventCategories.vue'),
                    meta: { name: 'Категории НС' },
                    children: [
                        {
                            path: 'edit/:id',
                            name: ERouteNames.EDIT_ADMIN_ADVERSE_EVENT_CATEGORIES,
                            component: () => import('@/views/admin/FormAdverseEventCategories.vue'),
                        },
                        {
                            path: 'create',
                            name: ERouteNames.CREATE_ADMIN_ADVERSE_EVENT_CATEGORIES,
                            component: () => import('@/views/admin/FormAdverseEventCategories.vue'),
                        },
                    ],
                },
            ],
        },
    ],
})

router.beforeEach(
    (to: RouteLocationNormalized, from: RouteLocationNormalized, next: NavigationGuardNext) => {
        const authStore = useAuthStore()
        const userStore = useUserStore()
        if (to.meta.requiresAuth && !authStore.isAuthenticated) {
            next('/login')
        } else if (to.path === '/login' && authStore.isAuthenticated) {
            next('/dashboard')
        } else if (to.meta.requiresManager && !userStore.user?.is_manager) {
            next('/actual')
        } else {
            next()
        }
    },
)

export default router

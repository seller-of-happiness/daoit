<script setup lang="ts">
/*
 * Компонент AppTopbar - верхняя панель приложения
 *
 * Функционал:
 * - Навигация и управление приложением
 * - Переключение темного/светлого режима
 * - Управление пользовательским меню
 * - Выход из системы
 * - Переключение между админ/пользовательской панелью
 *
 * Особенности:
 * - Интеграция с системой аутентификации
 * - Адаптивный дизайн
 * - Динамические элементы меню
 * - Работа с пользовательскими данными
 */

// Импорты стора, утилит и зависимостей
import { useLayout } from '@/layout/composables/layout'
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/refactoring/modules/authStore/stores/authStore'
import { useApiStore } from '@/refactoring/modules/apiStore/stores/apiStore'
import { useUserStore } from '@/refactoring/modules/user/stores/userStore'
import { getInitialsFullName } from '@/refactoring/utils/formatters'
import { FAST_LOGIN } from '@/refactoring/environment/environment'
import { ERouteNames } from '@/router/ERouteNames'
import EmployeeSelectionModal from '@/components/adverseEvents/EmployeeSelectionModal.vue'

// Импорты типов
import type Menu from 'primevue/menu'

// Инициализация хранилищ и сервисов
const router = useRouter()
const authStore = useAuthStore()
const userStore = useUserStore()
const apiStore = useApiStore()
const { toggleMenu, toggleDarkMode } = useLayout()

// Получение данных пользователя
const user = computed(() => userStore.user)

// Ref для модального окна
const employeeModalVisible = ref(false)
const employeeModalRef = ref<InstanceType<typeof EmployeeSelectionModal> | null>(null)

/**
 * Обработчик открытия модалки быстрого входа
 */
const openFastLoginModal = () => {
    employeeModalVisible.value = true
}

// Ссылка на компонент меню
const userOverlayMenu = ref<InstanceType<typeof Menu> | null>(null)

/**
 * Проверка роли администратора
 *
 * Определяется по наличию группы 'admin' в профиле пользователя
 */
const isAdmin = computed(() => user.value?.groups?.includes('admin'))

/**
 * Формирование метки панели в зависимости от роли
 */
const panelLabel = computed(() => (isAdmin.value ? 'Панель администратора' : 'Панель пользователя'))

/**
 * Формирование подписи для кнопки выхода
 *
 * Использует ФИО сотрудника из профиля пользователя
 */
const exitLabel = computed(() =>
    getInitialsFullName({
        first_name: userStore.user?.first_name,
        last_name: userStore.user?.last_name,
        middle_name: userStore.user?.middle_name,
    }),
)

/**
 * Обработчик выхода из системы
 *
 * 1. Вызывает logout в хранилище аутентификации
 * 2. Перенаправляет на страницу входа
 */
const handleLogout = async () => {
    await authStore.logout()
    await router.push({ name: ERouteNames.LOGIN })
}

/**
 * Элементы пользовательского меню
 *
 * Содержит:
 * - Ссылку на профиль
 * - Переключение между панелями
 * - Переключение темы
 * - Кнопку выхода
 */
const userOverlayMenuItems = ref([
    {
        label: 'Мой профиль',
        icon: 'pi pi-user',
        command: () => router.push({ name: ERouteNames.USER_PROFILE }),
    },
    {
        label: panelLabel,
        icon: 'pi pi-user-plus',
        command: () => (isAdmin.value ? router.push('/') : router.push('/admin')),
    },
    {
        label: 'Тёмный / Светлый режим',
        icon: 'pi pi-sun',
        command: () => toggleDarkMode(),
    },
    {
        separator: true,
    },
    {
        label: `Выход ${exitLabel.value}`,
        icon: 'pi pi-sign-out',
        command: handleLogout,
    },
])

/**
 * Переключение пользовательского меню
 */
function toggleUserOverlayMenu(event: MouseEvent) {
    userOverlayMenu.value?.toggle(event)
}

// Синхронизирует label для кнопки выход при использовании fastLogin (DEV)
watch(
    exitLabel,
    (v) => {
        const i = userOverlayMenuItems.value.findIndex((i) => i.command === handleLogout)
        if (i !== -1) userOverlayMenuItems.value[i].label = `Выход ${v}`
    },
    { immediate: true },
)

// Загружает список сотрудников для модалки если он пустой
onMounted(async () => {
    if (!apiStore.employees?.length) {
        await apiStore.fetchAllEmployees()
    }
})
</script>

<template>
    <!--
      Основной контейнер верхней панели:
      - Логотип и кнопка меню (слева)
      - Действия и пользовательское меню (справа)
    -->
    <div class="layout-topbar">
        <!-- Блок с логотипом, подразделением и кнопкой меню -->
        <div class="layout-topbar-logo-container">
            <button class="layout-menu-button layout-topbar-action" @click="toggleMenu">
                <i class="pi pi-bars"></i>
            </button>
            <router-link to="/" class="layout-topbar-logo">
                <svg viewBox="0 0 4047 1173" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                        d="M546.15 301.65C548.6 337.43 556.07 374.94 562.41 410.33L589.34 561.62C606.15 661.7 619.07 764.32 639.67 863.22C663.29 894.03 694.38 875.57 701.77 849.26C731.85 742.07 767.8 634.63 796.02 527.68C818.26 590.2 846.53 629.72 918.71 628.11C966.83 627.04 1016.92 627.69 1065.17 627.63C1090.25 627.41 1115.68 627.38 1140.72 626.76L1140.82 701.66C1140.81 743.78 1144.31 788.48 1112.55 821.56C1102.72 831.79 1085.38 841.9 1071.12 843.35C1062.59 846.36 1031.31 845.62 1021.05 845.58L910.72 844.93C890.94 844.83 865.59 843.71 846.4 846.54C827.89 849.27 821.99 854.34 811.78 868.58C802.98 925.66 814.24 1006.45 809.71 1066.75C801.85 1171.25 744.22 1173.82 658.74 1171.12C581.76 1168.68 503.92 1175.07 426.821 1172.22C332.383 1166.34 330.913 1090.5 330.536 1018.52L330.958 920.29C331.718 835.37 310.23 844.63 234.258 845.31L111.918 846.88C79.6351 847.09 53.492 842.36 29.578 817.95C-2.94096 784.75 0.704049 742.77 0.885049 700.24L1.30503 629.11L193.133 628.32C218.935 628.11 254.236 626.19 278.902 627.41C314.364 629.15 331.844 698.37 368.145 706.45C388.612 712.63 412.517 699 421.233 679.92C438.119 642.96 450.129 601.5 463.368 563.04C493.25 476.22 522.58 390.44 546.15 301.65Z"
                        fill="url(#paint0_linear_15_203)"
                    />
                    <path
                        d="M1065.17 627.63C1090.25 627.41 1115.68 627.38 1140.72 626.76L1140.82 701.66C1140.81 743.78 1144.31 788.48 1112.55 821.56C1102.72 831.79 1085.38 841.9 1071.12 843.35L1072.14 840.81C1146.95 807.77 1135.72 753.6 1135.73 682.87C1135.73 668.77 1137.11 653.38 1135.36 639.64C1120.35 625.74 1007.34 640.46 984.53 634.55C1000.07 627.31 1049.3 637.57 1065.17 627.63Z"
                        fill="#1E646E"
                    />
                    <path
                        d="M1.05507 563.84C2.09107 512.82 -1.63992 452.88 3.99308 402.77C9.73308 351.7 58.0901 322.99 106.59 324.58C150.674 325.45 198.357 322.93 241.968 324.28C323.576 326.82 334.517 330.45 333.386 246.69L332.844 147.57C332.735 123.97 331.403 99.3596 334.984 75.9996C342.36 30.8296 382.76 1.81962 427.134 0.999618C515.87 -0.630382 605.59 2.60963 694.17 0.639633C816.02 -2.07037 810.77 89.0396 806.75 178.75C806.23 209.95 805.71 242.25 805.86 273.29C806 303.63 814.71 323.06 847.57 324.73C864.58 325.6 881.75 324.99 898.55 324.95L1008.7 324.64C1027.34 324.62 1049.61 323.35 1067.65 327.49C1112.19 337.73 1139.65 374.93 1139.24 420.16C1142.77 446.9 1140.31 530.2 1140.41 560.98C1118.32 560.99 1084.21 562.09 1063.11 560.79C1010.44 561.09 941.56 565.31 891.25 560.67C857.76 557.58 839.37 399.62 772.83 441.07C754 452.46 748.36 472.2 742.66 491.97C721.17 566.58 694.5 641.31 676.21 716.76C673.51 679.74 664.79 637.32 658.64 599.73C636.52 464.58 614.39 328.01 586.4 194.07C581.23 169.31 534.55 157.54 521.95 187.07C495.85 248.24 481.594 315.48 460.236 378.52C432.624 462.79 401.444 546.14 374.556 630.59C318.51 546.04 284.907 562.29 193.504 562.65L1.05507 563.84Z"
                        fill="url(#paint1_linear_15_203)"
                    />
                    <path
                        d="M1063.11 560.79C1051.3 554.15 1034.63 555.16 1017.92 549.16C1023.49 540.43 1053.96 535.98 1061.39 521.43C1065.14 514.31 1059.3 470.27 1061.49 466.9C1072.69 449.68 1104.09 393.61 1115.69 381.46L1113.52 376.54C1115.11 372.24 1114.9 372.33 1117.83 368.87L1120.08 370.11C1128.56 383.03 1135.39 414.89 1139.24 420.16C1142.77 446.9 1140.31 530.2 1140.41 560.98C1118.32 560.99 1084.21 562.09 1063.11 560.79Z"
                        fill="#1E646E"
                    />
                    <path
                        d="M1681.42 193.111C1702.16 194.007 1724.56 193.262 1745.42 193C1745.31 213.167 1745.29 231.793 1746.05 252C1724.57 251.688 1702.58 251.919 1681.05 251.909C1681.64 232.598 1681.41 212.482 1681.42 193.111Z"
                        fill="#1E646E"
                    />
                    <path
                        d="M1806.37 96.1109C1827.11 97.0069 1849.51 96.2618 1870.37 96C1870.26 116.167 1870.24 134.793 1871 155C1849.52 154.688 1827.53 154.919 1806 154.909C1806.59 135.598 1806.36 115.482 1806.37 96.1109Z"
                        fill="#1E646E"
                    />
                    <path
                        d="M1546.33 39.1109C1564.51 40.0069 1584.15 39.2618 1602.45 39C1602.35 59.1667 1602.34 77.793 1603 98C1584.16 97.6879 1564.88 97.9194 1546 97.9093C1546.52 78.5984 1546.31 58.4822 1546.33 39.1109Z"
                        fill="#1E646E"
                    />
                    <path
                        d="M1284.33 1097.11C1302.51 1098.01 1322.15 1097.26 1340.45 1097C1340.35 1117.17 1340.34 1135.79 1341 1156C1322.16 1155.69 1302.88 1155.92 1284 1155.91C1284.52 1136.6 1284.31 1116.48 1284.33 1097.11Z"
                        fill="#1E646E"
                    />
                    <path
                        d="M1603.33 864.111C1621.51 865.007 1641.15 864.262 1659.45 864C1659.35 884.167 1659.34 902.793 1660 923C1641.16 922.688 1621.88 922.919 1603 922.909C1603.52 903.598 1603.31 883.482 1603.33 864.111Z"
                        fill="#1E646E"
                    />
                    <path
                        d="M1717.33 1010.11C1735.51 1011.01 1755.15 1010.26 1773.45 1010C1773.35 1030.17 1773.34 1048.79 1774 1069C1755.16 1068.69 1735.88 1068.92 1717 1068.91C1717.52 1049.6 1717.31 1029.48 1717.33 1010.11Z"
                        fill="#1E646E"
                    />
                    <path
                        d="M977.7 165.771C992.11 166.391 1010.02 165.81 1024.68 165.73L1024.75 213.301L977.02 213.181C977.08 197.291 977.11 181.661 977.7 165.771Z"
                        fill="#183F4A"
                    />
                    <rect
                        x="1087"
                        y="188"
                        width="512"
                        height="48"
                        rx="24"
                        fill="url(#paint2_linear_15_203)"
                    />
                    <rect
                        x="1057"
                        y="986"
                        width="512"
                        height="48"
                        rx="24"
                        fill="url(#paint3_linear_15_203)"
                    />
                    <rect
                        x="1193"
                        y="280"
                        width="266"
                        height="48"
                        rx="24"
                        fill="url(#paint4_linear_15_203)"
                    />
                    <rect
                        x="1193"
                        y="96"
                        width="266"
                        height="48"
                        rx="24"
                        fill="url(#paint5_linear_15_203)"
                    />
                    <rect
                        x="1163"
                        y="894"
                        width="266"
                        height="48"
                        rx="24"
                        fill="url(#paint6_linear_15_203)"
                    />
                    <path
                        d="M1354.01 783V405H1519.25C1560.29 405 1596.29 412.92 1627.25 428.76C1658.21 444.6 1682.33 466.56 1699.61 494.64C1716.89 522.72 1725.53 555.84 1725.53 594C1725.53 631.8 1716.89 664.92 1699.61 693.36C1682.33 721.44 1658.21 743.4 1627.25 759.24C1596.29 775.08 1560.29 783 1519.25 783H1354.01ZM1424.21 723.6H1516.01C1544.45 723.6 1568.93 718.2 1589.45 707.4C1610.33 696.6 1626.35 681.48 1637.51 662.04C1649.03 642.6 1654.79 619.92 1654.79 594C1654.79 567.72 1649.03 545.04 1637.51 525.96C1626.35 506.52 1610.33 491.4 1589.45 480.6C1568.93 469.8 1544.45 464.4 1516.01 464.4H1424.21V723.6Z"
                        fill="currentColor"
                    />
                    <path
                        d="M1741.41 783L1911.51 405H1980.63L2151.27 783H2077.83L1931.49 442.26H1959.57L1813.77 783H1741.41ZM1819.71 695.52L1838.61 640.44H2042.73L2061.63 695.52H1819.71Z"
                        fill="currentColor"
                    />
                    <path
                        d="M2371.19 788.4C2341.67 788.4 2314.49 783.54 2289.65 773.82C2264.81 764.1 2243.21 750.6 2224.85 733.32C2206.49 715.68 2192.27 695.16 2182.19 671.76C2172.11 648 2167.07 622.08 2167.07 594C2167.07 565.92 2172.11 540.18 2182.19 516.78C2192.27 493.02 2206.49 472.5 2224.85 455.22C2243.21 437.58 2264.81 423.9 2289.65 414.18C2314.49 404.46 2341.49 399.6 2370.65 399.6C2400.17 399.6 2427.17 404.46 2451.65 414.18C2476.49 423.9 2498.09 437.58 2516.45 455.22C2534.81 472.5 2549.03 493.02 2559.11 516.78C2569.19 540.18 2574.23 565.92 2574.23 594C2574.23 622.08 2569.19 648 2559.11 671.76C2549.03 695.52 2534.81 716.04 2516.45 733.32C2498.09 750.6 2476.49 764.1 2451.65 773.82C2427.17 783.54 2400.35 788.4 2371.19 788.4ZM2370.65 726.84C2389.73 726.84 2407.37 723.6 2423.57 717.12C2439.77 710.64 2453.81 701.46 2465.69 689.58C2477.57 677.34 2486.75 663.3 2493.23 647.46C2500.07 631.26 2503.49 613.44 2503.49 594C2503.49 574.56 2500.07 556.92 2493.23 541.08C2486.75 524.88 2477.57 510.84 2465.69 498.96C2453.81 486.72 2439.77 477.36 2423.57 470.88C2407.37 464.4 2389.73 461.16 2370.65 461.16C2351.57 461.16 2333.93 464.4 2317.73 470.88C2301.89 477.36 2287.85 486.72 2275.61 498.96C2263.73 510.84 2254.37 524.88 2247.53 541.08C2241.05 556.92 2237.81 574.56 2237.81 594C2237.81 613.08 2241.05 630.72 2247.53 646.92C2254.37 663.12 2263.73 677.34 2275.61 689.58C2287.49 701.46 2301.53 710.64 2317.73 717.12C2333.93 723.6 2351.57 726.84 2370.65 726.84Z"
                        fill="currentColor"
                    />
                    <path
                        d="M2610 590 H2740"
                        stroke="currentColor"
                        stroke-width="40"
                        fill="currentColor"
                    />
                    <path
                        d="M2797.88 783V405H2855.66L3020.9 680.94H2990.66L3153.2 405H3210.98L3211.52 783H3145.1L3144.56 509.22H3158.6L3020.36 739.8H2989.04L2848.64 509.22H2864.84V783H2797.88Z"
                        fill="currentColor"
                    />
                    <path
                        d="M3378.42 562.14H3566.34V619.92H3378.42V562.14ZM3383.82 724.14H3597.12V783H3313.62V405H3589.56V463.86H3383.82V724.14Z"
                        fill="currentColor"
                    />
                    <path
                        d="M3675.38 783V405H3840.62C3881.66 405 3917.66 412.92 3948.62 428.76C3979.58 444.6 4003.7 466.56 4020.98 494.64C4038.26 522.72 4046.9 555.84 4046.9 594C4046.9 631.8 4038.26 664.92 4020.98 693.36C4003.7 721.44 3979.58 743.4 3948.62 759.24C3917.66 775.08 3881.66 783 3840.62 783H3675.38ZM3745.58 723.6H3837.38C3865.82 723.6 3890.3 718.2 3910.82 707.4C3931.7 696.6 3947.72 681.48 3958.88 662.04C3970.4 642.6 3976.16 619.92 3976.16 594C3976.16 567.72 3970.4 545.04 3958.88 525.96C3947.72 506.52 3931.7 491.4 3910.82 480.6C3890.3 469.8 3865.82 464.4 3837.38 464.4H3745.58V723.6Z"
                        fill="currentColor"
                    />
                    <defs>
                        <linearGradient
                            id="paint0_linear_15_203"
                            x1="984.309"
                            y1="1026.89"
                            x2="92.0728"
                            y2="501.356"
                            gradientUnits="userSpaceOnUse"
                        >
                            <stop stop-color="#1D4D5B" />
                            <stop offset="1" stop-color="#29A4AB" />
                        </linearGradient>
                        <linearGradient
                            id="paint1_linear_15_203"
                            x1="837.318"
                            y1="756.312"
                            x2="259.517"
                            y2="136.851"
                            gradientUnits="userSpaceOnUse"
                        >
                            <stop stop-color="#215F6C" />
                            <stop offset="1" stop-color="#25B4B7" />
                        </linearGradient>
                        <linearGradient
                            id="paint2_linear_15_203"
                            x1="1087"
                            y1="212"
                            x2="1599"
                            y2="212"
                            gradientUnits="userSpaceOnUse"
                        >
                            <stop stop-color="#16191C" />
                            <stop offset="1" stop-color="#309BA2" />
                        </linearGradient>
                        <linearGradient
                            id="paint3_linear_15_203"
                            x1="1057"
                            y1="1010"
                            x2="1569"
                            y2="1010"
                            gradientUnits="userSpaceOnUse"
                        >
                            <stop stop-color="#16191C" />
                            <stop offset="1" stop-color="#309BA2" />
                        </linearGradient>
                        <linearGradient
                            id="paint4_linear_15_203"
                            x1="1193"
                            y1="304"
                            x2="1459"
                            y2="304"
                            gradientUnits="userSpaceOnUse"
                        >
                            <stop stop-color="#16191C" />
                            <stop offset="1" stop-color="#309BA2" />
                        </linearGradient>
                        <linearGradient
                            id="paint5_linear_15_203"
                            x1="1193"
                            y1="120"
                            x2="1459"
                            y2="120"
                            gradientUnits="userSpaceOnUse"
                        >
                            <stop stop-color="#16191C" />
                            <stop offset="1" stop-color="#309BA2" />
                        </linearGradient>
                        <linearGradient
                            id="paint6_linear_15_203"
                            x1="1163"
                            y1="918"
                            x2="1429"
                            y2="918"
                            gradientUnits="userSpaceOnUse"
                        >
                            <stop stop-color="#16191C" />
                            <stop offset="1" stop-color="#309BA2" />
                        </linearGradient>
                    </defs>
                </svg>
            </router-link>
            <div
                class="hidden md:flex items-center gap-2 ml-4 text-sm text-surface-600 dark:text-surface-300"
            >
                <i class="pi pi-building"></i>
                <span>{{ userStore.user?.department?.name || 'Подразделение не указано' }}</span>
            </div>
        </div>

        <!-- Блок с действиями пользователя -->
        <div class="layout-topbar-actions">
            <!-- Кнопка быстрого входа (только в dev режиме) -->
            <button
                v-if="FAST_LOGIN"
                @click="openFastLoginModal"
                type="button"
                class="layout-topbar-action"
                title="Быстрый вход (DEV)"
            >
                <i class="pi pi-bolt" :style="{ color: 'var(--p-button-info-background)' }"></i>
                <span>Быстрый вход</span>
            </button>
            <div class="layout-topbar-menu hidden lg:block">
                <div class="layout-topbar-menu-content">
                    <!-- Быстрые ссылки -->
                    <router-link :to="{ name: ERouteNames.CHAT }" class="layout-topbar-action">
                        <i class="pi pi-comments"></i>
                        <span>Чаты</span>
                    </router-link>
                    <!-- Кнопка календаря -->
                    <button type="button" class="layout-topbar-action">
                        <i class="pi pi-calendar"></i>
                        <span>Calendar</span>
                    </button>

                    <!-- Кнопка сообщений -->
                    <button type="button" class="layout-topbar-action">
                        <i class="pi pi-inbox"></i>
                        <span>Messages</span>
                    </button>

                    <!-- Пользовательское меню -->
                    <div class="relative">
                        <button
                            @click="toggleUserOverlayMenu"
                            type="button"
                            class="layout-topbar-action"
                        >
                            <i class="pi pi-user"></i>
                            <span>Profile</span>
                        </button>

                        <!-- Выпадающее меню пользователя -->
                        <app-menu
                            ref="userOverlayMenu"
                            :model="userOverlayMenuItems"
                            :popup="true"
                        />
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Модальное окно выбора сотрудника для быстрого входа -->
    <EmployeeSelectionModal
        ref="employeeModalRef"
        v-model:visible="employeeModalVisible"
        :fast-login="true"
        @close-modal="employeeModalVisible = false"
    />
</template>

<style lang="scss" scoped>
/*
  Стили компонента:

  .layout-topbar - основной контейнер:
    - Фиксированное позиционирование
    - Высота и z-index
    - Фон и тень

  .layout-topbar-logo-container - контейнер логотипа:
    - Выравнивание по центру
    - Отступы

  .layout-menu-button - кнопка меню:
    - Стили иконки

  .layout-topbar-logo - стили логотипа

  .layout-topbar-actions - контейнер действий:
    - Выравнивание по правому краю

  .layout-topbar-action - стили кнопок действий:
    - Размеры, отступы
    - Эффекты при наведении

  .layout-topbar-menu - контейнер меню:
    - Адаптивное скрытие на мобильных

  .layout-topbar-menu-content - содержимое меню:
    - Расположение элементов
*/

.layout-topbar-logo-container {
    display: flex;
    align-items: center;
    fill: var(--p-surface-0);
}
.layout-topbar {
    height: 4rem;
    display: flex;
}

.layout-topbar-logo svg {
    height: 100%;
    display: block;
    fill: currentColor;
}

.layout-topbar .layout-topbar-logo svg {
    width: 10rem;
}

.app-dark {
    .layout-topbar-logo svg {
        color: white;
    }
}
</style>

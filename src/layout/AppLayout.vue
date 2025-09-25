<script setup lang="ts">
/*
 * Компонент AppLayout - основной каркас приложения
 *
 * Функционал:
 * - Управление основной структурой приложения (макетом)
 * - Обработка состояний бокового меню
 * - Интеграция с системой маршрутизации
 * - Управление overlay-эффектами
 * - Обработка кликов вне области меню
 *
 * Особенности:
 * - Поддержка разных режимов меню (overlay, static)
 * - Адаптивное поведение для мобильных устройств
 * - Интеграция с Toast-уведомлениями
 * - Динамические CSS-классы в зависимости от состояния
 */

import { useLayout } from '@/layout/composables/layout'
import { computed, watch, ref } from 'vue'

import AppSidebar from './AppSidebar.vue'
import AppTopbar from './AppTopbar.vue'
import { useRouter } from 'vue-router'
import { SlidingChat } from '@/refactoring/modules/chat/components'
import { useSlidingChatGlobal } from '@/refactoring/modules/chat/composables/useSlidingChatGlobal'

// Инициализация композаблов из модуля layout
const { layoutConfig, layoutState, isSidebarActive } = useLayout()

// Реактивная ссылка на обработчик кликов вне меню
const outsideClickListener = ref<((e: MouseEvent) => void) | null>(null)

/**
 * Наблюдатель за состоянием активности бокового меню
 *
 * При изменении состояния:
 * - Если активно - добавляет обработчик кликов вне меню
 * - Если неактивно - удаляет обработчик
 */
watch(isSidebarActive, (newVal) => {
    if (newVal) {
        bindOutsideClickListener()
    } else {
        unbindOutsideClickListener()
    }
})

/**
 * Вычисляемый объект классов для основного контейнера
 *
 * Определяет классы в зависимости от:
 * - Режима меню (overlay/static)
 * - Состояния меню на десктопе
 * - Состояния меню на мобильных устройствах
 */
const containerClass = computed(() => {
    return {
        'layout-overlay': layoutConfig.menuMode === 'overlay',
        'layout-static': layoutConfig.menuMode === 'static',
        'layout-static-inactive':
            layoutState.staticMenuDesktopInactive && layoutConfig.menuMode === 'static',
        'layout-overlay-active': layoutState.overlayMenuActive,
        'layout-mobile-active': layoutState.staticMenuMobileActive,
    }
})

/**
 * Добавление обработчика кликов вне области меню
 */
function bindOutsideClickListener() {
    if (!outsideClickListener.value) {
        outsideClickListener.value = (event: MouseEvent) => {
            if (isOutsideClicked(event)) {
                layoutState.overlayMenuActive = false
                layoutState.staticMenuMobileActive = false
                layoutState.menuHoverActive = false
            }
        }
        if (outsideClickListener.value)
            document.addEventListener('click', outsideClickListener.value)
    }
}

/**
 * Удаление обработчика кликов вне области меню
 */
function unbindOutsideClickListener() {
    if (outsideClickListener.value) {
        document.removeEventListener('click', outsideClickListener.value)
        outsideClickListener.value = null
    }
}

/**
 * Проверка, был ли клик вне области меню
 *
 * @param {Event} event - Объект события клика
 * @returns {boolean} - True если клик был вне меню или кнопки меню
 */
function isOutsideClicked(event: Event) {
    const sidebarEl = document.querySelector('.layout-sidebar')
    const topbarEl = document.querySelector('.layout-menu-button')

    if (!sidebarEl || !topbarEl || !event.target) return true

    return !(
        sidebarEl.isSameNode(event.target as Node) ||
        sidebarEl.contains(event.target as Node) ||
        topbarEl.isSameNode(event.target as Node) ||
        topbarEl.contains(event.target as Node)
    )
}

// Инициализация маршрутизатора
const router = useRouter()

// Глобальное управление скользящим чатом
const {
    isSlidingChatVisible,
    slidingChatInitialChatId,
    slidingChatInitialUserId,
    openSlidingChat,
    closeSlidingChat,
} = useSlidingChatGlobal()

//Отслеживание роута для обработки параметров чата
watch(
    () => router.currentRoute.value,
    (newRoute) => {
        if (newRoute.name === 'chat') {
            // Проверяем query параметр slide=true для открытия в скользящем чате
            if (newRoute.query.slide === 'true') {
                // Проверяем наличие параметров для чата
                if (newRoute.query.userId) {
                    // Открываем чат с пользователем
                    const userId = String(newRoute.query.userId)
                    openSlidingChat(null, userId)
                } else if (newRoute.query.chatId) {
                    // Открываем существующий чат
                    const chatId = Number(newRoute.query.chatId)
                    if (!isNaN(chatId)) {
                        openSlidingChat(chatId, null)
                    }
                } else if (newRoute.params.param) {
                    // Используем параметр из URL (для совместимости со старыми ссылками)
                    const param = String(newRoute.params.param)
                    const chatIdNumber = Number(param)

                    if (!isNaN(chatIdNumber)) {
                        // Числовой ID - открываем как chatId
                        openSlidingChat(chatIdNumber, null)
                    } else {
                        // UUID - открываем как userId
                        openSlidingChat(null, param)
                    }
                } else {
                    // Просто открываем скользящий чат без параметров
                    openSlidingChat(null, null)
                }

                // Убираем query параметры и перенаправляем на чистый /chat
                router.replace('/chat')
            }
            // Если есть только параметр в URL без slide=true, открываем в полноэкранном режиме (как обычно)
        }
    },
    { immediate: true },
)

/**
 * Обработчик открытия полного чата
 */
const handleFullChatOpen = (chatId?: number) => {
    if (typeof chatId !== 'number') return
    // Всегда переходим на /chat без параметров для полноэкранного режима
    router.push('/chat')
}

/**
 * Вычисляемое имя класса для основного контейнера контента
 *
 * Определяет специальные страницы, где нужно убрать ограничение по ширине
 */
const layoutContainerName = computed(() => {
    const containerFluidPageName = ['adverse-events']
    return containerFluidPageName.some((pageName) => pageName === router.currentRoute.value.name)
        ? ''
        : 'layout-main'
})
</script>

<template>
    <!--
      Основной контейнер приложения:
      - Динамические классы из containerClass
      - Структура:
        1. Верхняя панель (AppTopbar)
        2. Боковое меню (AppSidebar)
        3. Основной контент с роутером
        4. Подвал (AppFooter)
        5. Overlay-маска
        6. Toast-уведомления (глобальные)
    -->
    <div class="layout-wrapper" :class="containerClass">
        <!-- Верхняя панель приложения -->
        <app-topbar></app-topbar>

        <!-- Боковое меню -->
        <app-sidebar></app-sidebar>

        <!-- Основной контейнер контента -->
        <div class="layout-main-container">
            <div class="layout-main">
                <!-- Динамическое содержимое страниц -->
                <router-view></router-view>
            </div>
        </div>
        <!-- Overlay-маска для меню -->
        <div class="layout-mask animate-fadein"></div>

        <!-- Скользящий чат -->
        <SlidingChat
            v-model:visible="isSlidingChatVisible"
            :initial-chat-id="slidingChatInitialChatId"
            :initial-user-id="slidingChatInitialUserId"
            @open-full-chat="handleFullChatOpen"
        />
    </div>
    <!-- Глобальные Toast-уведомления -->
    <Toast />
</template>

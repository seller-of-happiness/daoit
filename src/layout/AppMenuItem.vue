<script setup>
/*
* Компонент AppMenuItem - элемент меню приложения
*
* Функционал:
* - Рендер пунктов меню с поддержкой вложенности
* - Обработка кликов и навигации
* - Управление активным состоянием
* - Поддержка иконок и внешних ссылок
* - Адаптация под мобильные устройства
*
* Особенности:
* - Рекурсивный рендеринг вложенных меню
* - Интеграция с системой маршрутизации
* - Поддержка различных состояний (disabled, active)
* - Анимация раскрытия подменю
*/

import { useLayout } from '@/layout/composables/layout'
import { onBeforeMount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const { layoutState, setActiveMenuItem, toggleMenu } = useLayout()

// Определение пропсов компонента
const props = defineProps({
    item: {
        type: Object,
        default: () => ({}),
    },
    index: {
        type: Number,
        default: 0,
    },
    root: {
        type: Boolean,
        default: true,
    },
    parentItemKey: {
        type: String,
        default: null,
    },
})

// Состояние активности пункта меню
const isActiveMenu = ref(false)
// Уникальный ключ пункта меню
const itemKey = ref(null)

/**
 * Инициализация компонента перед монтированием
 *
 * 1. Генерирует уникальный ключ пункта меню
 * 2. Проверяет активность пункта меню
 */
onBeforeMount(() => {
    itemKey.value = props.parentItemKey
        ? props.parentItemKey + '-' + props.index
        : String(props.index)

    const activeItem = layoutState.activeMenuItem

    isActiveMenu.value =
        activeItem === itemKey.value || activeItem
            ? activeItem.startsWith(itemKey.value + '-')
            : false
})

/**
 * Наблюдатель за изменением активного пункта меню
 *
 * Обновляет состояние isActiveMenu при изменении layoutState.activeMenuItem
 */
watch(
    () => layoutState.activeMenuItem,
    (newVal) => {
        isActiveMenu.value = newVal === itemKey.value || newVal.startsWith(itemKey.value + '-')
    },
)

/**
 * Обработчик клика по пункту меню
 *
 * @param {Event} event - Объект события
 * @param {Object} item - Данные пункта меню
 *
 * Логика:
 * 1. Проверяет disabled-состояние
 * 2. Закрывает меню на мобильных устройствах
 * 3. Вызывает command-функцию, если определена
 * 4. Устанавливает активный пункт меню
 */
function itemClick(event, item) {
    if (item.disabled) {
        event.preventDefault()
        return
    }

    if (
        (item.to || item.url) &&
        (layoutState.staticMenuMobileActive || layoutState.overlayMenuActive)
    ) {
        toggleMenu()
    }

    if (item.command) {
        item.command({ originalEvent: event, item: item })
    }

    if (isActiveMenu.value) {
        setActiveMenuItem(props.parentItemKey) // Закрываем подменю
    } else {
        setActiveMenuItem(itemKey.value) // Открываем подменю
    }
}

/**
 * Проверка активного маршрута
 *
 * @param {Object} item - Данные пункта меню
 * @returns {boolean} - True если текущий путь совпадает с путем пункта меню
 */
function checkActiveRoute(item) {
    if (typeof item.to === 'string') {
        return route.path === item.to
    }

    if (typeof item.to === 'object' && item.to.name) {
        // Проверяем имя маршрута
        if (route.name !== item.to.name) return false

        // Если есть параметры, проверяем их
        if (item.to.params && item.to.params.id) {
            return route.params.id === item.to.params.id.toString()
        }

        return true
    }

    return false
}
</script>

<template>
    <!--
      Элемент меню:
      - Корневой или вложенный (root)
      - Активный или неактивный (isActiveMenu)
    -->
    <li :class="{ 'layout-root-menuitem': root, 'active-menuitem': isActiveMenu }">
        <!-- Заголовок для корневых разделов меню -->
        <div v-if="root && item.visible !== false" class="layout-menuitem-root-text">
            {{ item.label }}
        </div>

        <!-- Ссылка для пунктов с подменю или внешних ссылок -->
        <a
            v-if="(!item.to || item.items) && item.visible !== false"
            :href="item.url"
            @click="itemClick($event, item, index)"
            :class="item.class"
            :target="item.target"
            tabindex="0"
        >
            <i :class="item.icon" class="layout-menuitem-icon"></i>
            <span class="layout-menuitem-text">{{ item.label }}</span>
            <i class="pi pi-fw pi-angle-down layout-submenu-toggler" v-if="item.items"></i>
        </a>

        <!-- Router-link для внутренних ссылок без подменю -->
        <router-link
            v-if="item.to && !item.items && item.visible !== false"
            @click="itemClick($event, item, index)"
            :class="[item.class, { 'active-route': checkActiveRoute(item) }]"
            tabindex="0"
            :to="item.to"
        >
            <i :class="item.icon" class="layout-menuitem-icon"></i>
            <span class="layout-menuitem-text">{{ item.label }}</span>
            <i class="pi pi-fw pi-angle-down layout-submenu-toggler" v-if="item.items"></i>
        </router-link>

        <!-- Вложенное меню с анимацией -->
        <Transition v-if="item.items && item.visible !== false" name="layout-submenu">
            <ul v-show="root ? true : isActiveMenu" class="layout-submenu">
                <app-menu-item
                    v-for="(child, i) in item.items"
                    :key="child"
                    :index="i"
                    :item="child"
                    :parentItemKey="itemKey"
                    :root="false"
                ></app-menu-item>
            </ul>
        </Transition>
    </li>
</template>

<style lang="scss" scoped>
/*
  Стили компонента:

  .layout-root-menuitem - стиль корневого элемента меню
  .active-menuitem - стиль активного пункта меню
  .layout-menuitem-root-text - стиль текста корневого раздела
  .layout-menuitem-icon - стиль иконки пункта меню
  .layout-menuitem-text - стиль текста пункта меню
  .layout-submenu-toggler - стиль иконки раскрытия подменю
  .active-route - стиль активного маршрута
  .layout-submenu - стиль подменю
  .layout-submenu-enter/leave-active - анимации подменю
*/
</style>

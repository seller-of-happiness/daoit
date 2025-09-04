<script setup>
/*
 * Компонент AppSidebar - боковая панель приложения
 *
 * Функционал:
 * - Обеспечивает контейнер для основного меню приложения
 * - Добавляет скроллинг для содержимого меню
 * - Интегрируется с PrimeVue ScrollPanel
 *
 * Особенности:
 * - Фиксированная структура с ScrollPanel
 * - Минималистичная реализация
 * - Полностью адаптивный дизайн
 */

import AppMenu from './AppMenu.vue'
import AppFooter from './AppFooter.vue'
import ScrollPanel from 'primevue/scrollpanel'
</script>

<template>
    <!--
      Контейнер боковой панели:
      - Содержит компонент ScrollPanel для плавного скроллинга
      - Внутри ScrollPanel рендерит основное меню приложения
    -->
    <div class="layout-sidebar flex flex-col justify-between">
        <!--
          Компонент ScrollPanel:
          - Заполняет доступное пространство между топбаром и футером
          - Обеспечивает скроллинг только для содержимого меню
        -->
        <ScrollPanel class="sidebar-scroll" style="width: 100%">
            <!-- Основное меню приложения -->
            <app-menu></app-menu>
        </ScrollPanel>
        <!-- Подвал приложения -->
        <app-footer></app-footer>
    </div>
</template>

<style lang="scss" scoped>
/*
  Стили компонента:

  .layout-sidebar - основной контейнер боковой панели:
    - Должен содержать стили для позиционирования
    - Определять фоновый цвет и тени
    - Задавать z-index для правильного отображения поверх других элементов

  Стили ScrollPanel наследуются из PrimeVue
*/
</style>

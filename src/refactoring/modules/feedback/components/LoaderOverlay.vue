<script lang="ts" setup>
/*
* Компонент глобального лоадера приложения
*
* Назначение:
* - Отображает полноэкранный индикатор загрузки
* - Используется для глобальных операций, требующих ожидания
*
* Особенности:
* - Фиксированное позиционирование поверх всего интерфейса
* - Управляется через feedbackStore (isGlobalLoading)
* - Автоматически появляется/исчезает при изменении состояния
* - Полупрозрачный фон для визуального выделения
*/

import { useFeedbackStore } from '@/refactoring/modules/feedback/stores/feedbackStore'

// Инициализация хранилища состояний
const feedbackStore = useFeedbackStore()
</script>

<template>
    <!--
      Блок глобальной загрузки:
      - Отображается только при feedbackStore.shouldShowLoader = true (с задержкой)
      - Занимает весь viewport (100vw x 100vh)
      - Содержит компонент спиннера по центру
      - Имеет высокий z-index для отображения поверх всех элементов
      - Адаптируется под темную и светлую тему
    -->
    <div v-if="feedbackStore.shouldShowLoader" class="loader_overlay">
        <app-spinner />
    </div>
</template>

<style scoped>
/*
  Стили для оверлея загрузки:

  .loader_overlay:
  - Фиксированное позиционирование (не скроллится)
  - Полноэкранное покрытие (width: 100vw, height: 100vh)
  - Высокий z-index (100000) - поверх всех элементов
  - Центрирование спиннера (flex-выравнивание)
  - Адаптивный фон в зависимости от темы
  - Плавное появление/исчезновение (transition)
*/
.loader_overlay {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 100000;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100vw;
    height: 100vh;
    /* Светлый фон для светлой темы */
    background-color: rgba(255, 255, 255, 0.9);
    transition: opacity 0.3s ease-in-out;
}

/* Темный фон для темной темы */
:global(.dark) .loader_overlay {
    background-color: rgba(31, 41, 55, 0.9);
}
</style>

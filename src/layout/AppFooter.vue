<script setup lang="ts">
/*
 * Компонент LayoutFooter - подвал приложения
 *
 * Функционал:
 * - Отображение информации о бренде и копирайте
 * - Показ версии приложения
 * - Автоматическое извлечение версии из переменных окружения
 *
 * Особенности:
 * - Фиксированное позиционирование внизу экрана
 * - Адаптивное отображение версии
 * - Минималистичный дизайн
 */

// Импорт версии приложения из переменных окружения
import { APP_VERSION } from '@/refactoring/environment/environment'

/**
 * Извлечение ID пайплайна из версии приложения
 *
 * Логика:
 * 1. Ищет последовательность цифр в начале строки APP_VERSION
 * 2. Возвращает найденные цифры или '0' по умолчанию
 */
const pipelineId = APP_VERSION?.match(/^\d+/)?.[0] ?? '0'

/**
 * Формирование читаемой версии приложения
 *
 * Формат: v 1.0.{pipelineId}
 * Пример: v 1.0.1234
 */
const appVersion = `v 1.0.${pipelineId}`
</script>

<template>
    <!--
      Основной контейнер подвала:
      - Фиксированная ширина (100%)
      - Минимальная высота 48px
      - Центрирование содержимого по горизонтали и вертикали
      - Два основных элемента:
        1. Бренд и копирайт (центр)
        2. Версия приложения (правый нижний угол)
    -->
    <div class="layout-footer flex flex-col items-center justify-center">
        <!-- Брендовая информация с годом -->
        <span class="layout-footer__brand">DAO-MED @ 2025</span>

        <!-- Номер версии приложения -->
        <span class="layout-footer__version">{{ appVersion }}</span>
    </div>
</template>

<style lang="scss" scoped>
/*
  Стили компонента подвала:

  .layout-footer - основной контейнер:
  - position: relative - для абсолютного позиционирования версии
  - width: 100% - на всю ширину родителя
  - min-height: 48px - минимальная высота
  - display: flex - flex-контейнер
  - justify-content: center - центрирование по горизонтали
  - align-items: center - центрирование по вертикали
  - font-size: 15px - базовый размер шрифта
  - color: var(--text-color) - цвет текста из темы

  .layout-footer__brand - стиль бренда:
  - color: inherit - наследует цвет из контейнера (темный/светлый)

  .layout-footer__version - стиль версии:
  - color: var(--text-color-secondary) - приглушенный цвет из темы
  - font-weight: 500 - средняя жирность
  - letter-spacing: 1px - межбуквенный интервал
  - font-size: 15px - размер шрифта
*/
.layout-footer {
    position: relative;
    width: 100%;
    min-height: 48px;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 15px;
    color: var(--text-color);

    &__brand {
        color: inherit;
    }

    &__version {
        color: var(--text-color-secondary);
        font-weight: 500;
        letter-spacing: 1px;
        font-size: 15px;
    }
}
</style>

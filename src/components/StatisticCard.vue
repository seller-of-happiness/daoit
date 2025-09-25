<script setup lang="ts">
/*
* Компонент StatsCard для отображения статистических данных
*
* Функционал:
* - Отображение числового значения с подписью
* - Поддержка состояния загрузки (скелетоны)
* - Адаптация под светлую/темную тему
*
* Особенности:
* - Фиксированная минимальная высота
* - Простая и чистая структура
* - Гибкость через пропсы
*/

/**
 * Определение пропсов компонента
 *
 * @property {Boolean} loading - Флаг состояния загрузки (true - показываем скелетоны)
 * @property {Number} statsCounter - Числовое значение статистики
 * @property {String} statsLabel - Текстовая метка статистики
 */
defineProps({
    loading: {
        type: Boolean,
        default: false,
    },
    statsCounter: {
        type: Number,
    },
    statsLabel: {
        type: String,
    },
})
</script>

<template>
    <!--
      Компонент StatsCard - карточка для отображения статистических данных

      Структура:
      - Основной контейнер карточки с фиксированной минимальной высотой
      - Состояние загрузки (скелетон)
      - Основное содержимое (метка и значение статистики)
    -->
    <div class="card mb-0 min-h-[109px]">
        <!-- Состояние загрузки: два скелетона -->
        <div v-if="loading" class="flex flex-col gap-4">
            <Skeleton></Skeleton>
            <Skeleton></Skeleton>
        </div>

        <!-- Основное содержимое карточки -->
        <div v-else class="flex justify-between gap-4">
            <div>
                <!-- Метка статистики (подпись) -->
                <span class="block text-muted-color font-medium mb-4">{{ statsLabel }}</span>

                <!-- Значение статистики -->
                <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">
                    {{ statsCounter }}
                </div>
            </div>
        </div>
    </div>
</template>

<style lang="scss" scoped>
/*
  Стили компонента:

  .card - базовая стилизация карточки:
  - Отступ снизу (mb-0)
  - Минимальная высота 109px (min-h-[109px])

  .text-muted-color - цвет для второстепенного текста

  .text-surface-900 - цвет основного текста в светлой теме
  .dark:text-surface-0 - цвет основного текста в темной теме

  Остальные стили:
  - Размер шрифта (text-xl)
  - Жирность шрифта (font-medium)
  - Отступы (mb-4)
  - Расположение элементов (flex, justify-between)
*/
</style>

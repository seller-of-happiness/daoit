<script setup lang="ts">
import { computed, defineProps } from 'vue'
import { useRouter } from 'vue-router'

import { normalizeRisk } from '@/refactoring/utils/heatMapRisk'

import type { ITrisk } from '@/components/HeatMap/types/ITrisk'
import type { ISquare } from '@/components/HeatMap/types/ISquare'

const router = useRouter()

/**
 * Свойства компонента
 *
 * @property square Объект квадрата (ISquare)
 * @property size Размер квадрата: 'sm' | 'md' | 'lg' (по умолчанию undefined)
 */
const props = defineProps<{
  square: ISquare
  size?: 'sm' | 'md' | 'lg'
}>()

/**
 * Вычисляемое свойство нормализованного риска
 *
 * Последовательность действий:
 * 1. Берёт risk из props.square
 * 2. Передаёт значение в функцию normalizeRisk
 * 3. Возвращает нормализованный риск в формате ITrisk
 */
const normalized = computed<ITrisk>(() => normalizeRisk(props.square.risk))

/**
 * Основной текст для отображения (displayMain)
 *
 * Последовательность действий:
 * 1. Проверяет наличие recurrence в props.square
 * 2. Если recurrence заполнено:
 *    - Приводит к строке и убирает пробелы
 *    - Возвращает строку с % на конце, если его нет
 * 3. Если recurrence пустое:
 *    - Возвращает label или detail из props.square
 */
const displayMain = computed(() => {
  const rec = (props.square as any).recurrence
  if (rec !== undefined && rec !== null && String(rec).trim() !== '') {
    const s = String(rec).trim()
    return s.includes('%') ? s : `${s}%`
  }
  return (props.square as any).label ?? props.square.detail ?? ''
})

/**
 * Дополнительный текст для отображения (displaySub)
 *
 * Последовательность действий:
 * 1. Проверяет наличие recurrence в props.square
 * 2. Если recurrence заполнено:
 *    - Берёт detail как базу
 *    - Если detail есть: возвращает "вероятность повторения - {detail}"
 *    - Если detail пустое: возвращает "Вероятность повторения"
 * 3. Если recurrence пустое:
 *    - Возвращает detail или пустую строку
 */
const displaySub = computed(() => {
  const rec = (props.square as any).recurrence
  if (rec !== undefined && rec !== null && String(rec).trim() !== '') {
    const base = props.square.detail ?? ''
    return base ? `вероятность повторения - ${base}` : 'Вероятность повторения'
  }
    return props.square.detail ?? ''
})

/**
 * CSS BEM-класс для отображения квадрата риска
 *
 * Последовательность действий:
 * 1. Проверяет значение normalized
 * 2. Возвращает строку класса вида "risk-square--{value}"
 * 3. Если normalized пустое — возвращает "risk-square--unknown"
 */
const riskBem = computed(() => (normalized.value ? `risk-square--${normalized.value}` : 'risk-square--unknown'))


/**
 * ARIA-метка для доступности
 *
 * Последовательность действий:
 * 1. Берёт detail из props.square (или пустую строку)
 * 2. Добавляет к нему нормализованное значение риска
 * 3. Возвращает итоговую строку
 */
const ariaLabel = computed(() => `${props.square.detail ?? ''} ${normalized.value ?? ''}`)

/**
 * Обработчик клика по квадрату риска
 *
 * Последовательность действий:
 * 1. Берёт id из props.square
 * 2. Если id пустое — завершает выполнение
 * 3. Если id есть — перенаправляет на страницу `/adverse-events/{id}`
 * 4. Игнорирует ошибки навигации
 */
const onClick = (): void => {
  const id = props.square.id
  if (id === undefined || id === null) return
  router.push({ path: `/adverse-events/${id}` }).catch(() => {})
}
</script>

<template>
  <div
    class="risk-square w-full rounded-lg shadow-sm cursor-pointer flex items-center justify-center"
    :class="[ riskBem ]"
    role="button"
    :aria-label="ariaLabel"
    :title="props.square.description"
    tabindex="0"
    @click="onClick"
    @keydown.enter="onClick"
  >
    <div
      class="risk-square__box w-full h-full flex flex-col items-center justify-center rounded-md"
    >
      <!-- главный большой текст — recurrence или label -->
      <div class="risk-square__main text-sm md:text-base font-semibold">
        {{ displayMain }}
      </div>

      <div class="risk-square__sub text-[10px] opacity-80 mt-1">
        {{ displaySub }}
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.risk-square {
  width: 100%;
  &--high .risk-square__box { background: var(--p-red-400); color: #fff; }
  &--medium .risk-square__box { background: var(--p-orange-400); color: #111827; }
  &--low .risk-square__box { background: var(--p-green-400); color: #111827; }

  &__box {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem;
    border-radius: 0.375rem;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    aspect-ratio: 1;
  }

  &__main {
    line-height: 1;
    text-align: center;
  }

  &__sub {
    text-align: center;
  }
}
</style>

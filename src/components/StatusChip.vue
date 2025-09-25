<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
    status?: string | null | undefined
}>()

const LABELS = {
    completed: 'Завершён',
    in_progress: 'В работе',
    new: 'Новое',
} as const

const key = computed(() => (props.status ?? '').toString().trim().toLowerCase().replace(/-/g, '_'))
const label = computed(() => (key.value ? (LABELS as any)[key.value] ?? props.status ?? '' : ''))
const statusClass = computed(() => (key.value === 'completed' ? 'completed' : key.value === 'new' ? 'new' : 'in-progress'))
</script>

<template>
  <span
      v-if="key && label"
      :class="[
      'inline-block self-center px-2 py-0.5 text-xs leading-tight rounded-full border border-current font-semibold',
      statusClass
    ]"
  >
    {{ label }}
  </span>
</template>

<style scoped>
.completed   { color: var(--primary-color); }
.in-progress { color: var(--p-orange-400); }
.new         { color: var(--p-blue-400); }
</style>

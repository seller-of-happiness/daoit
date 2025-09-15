<script lang="ts" setup>
/*
* Компонент-обертка для работы с тостами (уведомлениями)
*
* Назначение:
* - Интеграция системы уведомлений PrimeVue с состоянием приложения
* - Автоматический показ тостов при изменении состояния в feedbackStore
*
* Особенности:
* - Реагирует на изменения toastTrigger из хранилища
* - Передает параметры уведомления из feedbackStore в PrimeVue Toast
* - Использует стандартный компонент AppToast для отображения
* - Не требует собственных стилей
*/

import { useToast } from 'primevue/usetoast'
import { watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useFeedbackStore } from '@/refactoring/modules/feedback/stores/feedbackStore'

// Инициализация сервиса тостов PrimeVue
const toast = useToast()

// Получение реактивных свойств из хранилища
const { toastTrigger } = storeToRefs(useFeedbackStore())
const feedbackStore = useFeedbackStore()

// Отслеживание изменений триггера для показа тостов
watch(toastTrigger, () => {
    toast.add({
        severity: feedbackStore.toast.severity,
        summary: feedbackStore.toast.summary,
        detail: feedbackStore.toast.detail,
        life: feedbackStore.toast.life,
    })
})
</script>

<template>
    <!--
      Компонент отображения тостов:
      - Использует кастомный компонент AppToast
      - Не требует передачи параметров (работает через useToast)
      - Отображается в корневой области приложения
    -->
    <app-toast />
</template>

<style scoped lang="scss">
/*
  Стили не требуются, так как компонент:
  - Является логической оберткой
  - Не содержит собственных DOM-элементов
  - Все стили управляются компонентом AppToast
*/
</style>

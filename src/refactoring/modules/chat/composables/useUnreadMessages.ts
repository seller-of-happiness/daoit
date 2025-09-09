import { ref, watchEffect, readonly, computed } from 'vue'

/**
 * Composable для управления непрочитанными сообщениями в заголовке страницы
 * 
 * Особенности:
 * - Отслеживает количество непрочитанных сообщений
 * - Обновляет заголовок страницы всегда когда есть непрочитанные сообщения
 * - Автоматически сбрасывает счетчик при активации вкладки
 * - Сохраняет оригинальный заголовок страницы
 */
export function useUnreadMessages() {
  const unreadCount = ref(0)
  const originalTitle = document.title
  const isTabActive = ref(!document.hidden)

  // Отслеживаем состояние вкладки (активна/неактивна)
  const handleVisibilityChange = () => {
    isTabActive.value = !document.hidden
    
    // Если вкладка стала активной - сбрасываем счетчик
    if (isTabActive.value && unreadCount.value > 0) {
      resetUnread()
    }
  }

  // Подписываемся на изменение видимости вкладки
  document.addEventListener('visibilitychange', handleVisibilityChange)

  // watchEffect автоматически отслеживает unreadCount
  watchEffect(() => {
    // Обновляем заголовок всегда, когда есть непрочитанные сообщения
    document.title = unreadCount.value > 0
      ? `(${unreadCount.value}) ${originalTitle}`
      : originalTitle
  })

  const incrementUnread = () => {
    // Увеличиваем счетчик только если вкладка неактивна
    if (!isTabActive.value) {
      unreadCount.value++
    }
  }

  const resetUnread = () => {
    unreadCount.value = 0
  }

  const setUnreadCount = (count: number) => {
    unreadCount.value = count
  }

  const cleanup = () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    // Восстанавливаем оригинальный заголовок при очистке
    document.title = originalTitle
  }

  return { 
    unreadCount, 
    incrementUnread, 
    resetUnread, 
    setUnreadCount,
    cleanup,
    isTabActive: readonly(isTabActive)
  }
}
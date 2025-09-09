import { ref, watchEffect, readonly } from 'vue'

/**
 * Composable для управления непрочитанными сообщениями в заголовке страницы
 * 
 * Особенности:
 * - Отслеживает количество непрочитанных сообщений
 * - Обновляет заголовок страницы только когда вкладка неактивна
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

  // watchEffect автоматически отслеживает unreadCount и isTabActive
  watchEffect(() => {
    // Обновляем заголовок только если есть непрочитанные сообщения
    // и вкладка неактивна
    document.title = unreadCount.value > 0 && !isTabActive.value
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

  const cleanup = () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    // Восстанавливаем оригинальный заголовок при очистке
    document.title = originalTitle
  }

  return { 
    unreadCount, 
    incrementUnread, 
    resetUnread, 
    cleanup,
    isTabActive: readonly(isTabActive)
  }
}
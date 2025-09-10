import { ref, watchEffect, readonly, computed, onMounted, onUnmounted } from 'vue'

/**
 * Composable для управления непрочитанными сообщениями в заголовке страницы
 * 
 * Особенности:
 * - Отслеживает количество непрочитанных сообщений
 * - Обновляет заголовок страницы всегда когда есть непрочитанные сообщения
 * - Автоматически сбрасывает счетчик при активации вкладки
 * - Сохраняет оригинальный заголовок страницы
 * - Совместим с SSR и production сборками
 */
export function useUnreadMessages() {
  const unreadCount = ref(0)
  // Безопасная инициализация для SSR
  const originalTitle = typeof document !== 'undefined' ? document.title : 'DAO-MED'
  const isTabActive = ref(typeof document !== 'undefined' ? !document.hidden : true)

  // Отслеживаем состояние вкладки (активна/неактивна)
  const handleVisibilityChange = () => {
    if (typeof document === 'undefined') return
    
    isTabActive.value = !document.hidden
    
    // Если вкладка стала активной - сбрасываем счетчик
    if (isTabActive.value && unreadCount.value > 0) {
      resetUnread()
    }
  }

  // Инициализация событий после монтирования компонента
  let isEventListenerAdded = false
  
  const initializeEventListeners = () => {
    if (typeof document === 'undefined' || isEventListenerAdded) return
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    isEventListenerAdded = true
    
    // Обновляем состояние активности вкладки
    isTabActive.value = !document.hidden
  }
  
  // Инициализируем события сразу, если document доступен
  if (typeof document !== 'undefined') {
    initializeEventListeners()
  }

  // watchEffect автоматически отслеживает unreadCount
  watchEffect(() => {
    // Обновляем заголовок только если document доступен
    if (typeof document === 'undefined') return
    
    // Обновляем заголовок всегда, когда есть непрочитанные сообщения
    const newTitle = unreadCount.value > 0
      ? `(${unreadCount.value}) ${originalTitle}`
      : originalTitle
      
    document.title = newTitle
    
    // Debug: логируем изменения заголовка
    if (typeof window !== 'undefined' && window.console) {
      console.log(`[UnreadMessages] Заголовок обновлен: "${newTitle}", счетчик: ${unreadCount.value}`)
    }
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
    
    // Debug: логируем изменения счетчика в продакшене
    if (typeof window !== 'undefined' && window.console) {
      console.log(`[UnreadMessages] Счетчик установлен: ${count}, заголовок: "${document.title}"`)
    }
  }

  const cleanup = () => {
    if (typeof document === 'undefined' || !isEventListenerAdded) return
    
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    isEventListenerAdded = false
    
    // Восстанавливаем оригинальный заголовок при очистке
    document.title = originalTitle
  }

  return { 
    unreadCount, 
    incrementUnread, 
    resetUnread, 
    setUnreadCount,
    cleanup,
    isTabActive: readonly(isTabActive),
    // Дополнительный метод для инициализации в клиентском коде
    initializeEventListeners
  }
}
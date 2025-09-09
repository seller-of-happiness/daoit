# Исправление синхронизации реакций между пользователями

## Проблема
Реакции не синхронизировались между пользователями из-за отсутствия `user_id` в WebSocket сообщениях о реакциях.

## Анализ
1. **WebSocket данные**: В сообщениях о реакциях отсутствует поле `user_id`:
   ```json
   {
     "event_type": "new_reaction",
     "data": {
       "chat_id": 16,
       "message_id": 382,
       "reaction_type_id": 3
       // ❌ НЕТ user_id
     }
   }
   ```

2. **Локальное обновление**: Без `user_id` невозможно определить, какой пользователь добавил/удалил реакцию, что нарушает эксклюзивность реакций.

## Решение
Реализовано клиентское решение с автоматической перезагрузкой сообщений при отсутствии `user_id`:

### Изменения в `chatStore.ts`

1. **Добавлен debounced reload**:
   ```typescript
   // Debounce для перезагрузки сообщений при реакциях
   reactionReloadTimeout: number | null

   debouncedReloadMessages(chatId: number): void {
       if (this.reactionReloadTimeout) {
           clearTimeout(this.reactionReloadTimeout)
       }
       
       this.reactionReloadTimeout = window.setTimeout(() => {
           this.fetchMessages(chatId).catch((error) => {
               console.error('Ошибка при обновлении сообщений после реакции:', error)
           })
           this.reactionReloadTimeout = null
       }, 300)
   }
   ```

2. **Улучшена обработка реакций**:
   ```typescript
   handleReactionUpdate(data: any): void {
       // ... извлечение данных ...
       
       if (this.currentChat && chatId === this.currentChat.id) {
           // ✅ Если нет userId - перезагружаем с сервера
           if (!userId) {
               console.log('🔄 Отсутствует userId в WebSocket данных, перезагружаем сообщения')
               this.debouncedReloadMessages(this.currentChat.id)
               return
           }
           
           // Локальное обновление только если есть userId
           const success = this.updateMessageReactionLocally(messageId, reactionTypeId, userId, eventType)
           // ...
       }
   }
   ```

### Изменения в `centrifugeStore.ts`

Добавлено расширенное логирование для отладки:
```typescript
if (eventType && eventType.includes('reaction')) {
    const userId = reactionData?.user_id || reactionData?.user || ctx.data?.user_id || ctx.data?.user
    
    console.log('🎭 Centrifuge reaction event received:', {
        // ... данные ...
        hasUserId: !!userId,
    })
    
    // ⚠️ Предупреждение если userId отсутствует
    if (!userId) {
        console.warn('⚠️ WebSocket реакция без userId - потребуется перезагрузка сообщений')
    }
}
```

## Результат
- ✅ Реакции теперь корректно синхронизируются между всеми пользователями
- ✅ Debounce предотвращает избыточные запросы к серверу
- ✅ Улучшенное логирование для отладки
- ✅ Graceful fallback при отсутствии `user_id` в WebSocket

## Альтернативное решение
Для полного решения проблемы рекомендуется **серверное исправление**: добавить `user_id` в WebSocket сообщения о реакциях. Это позволит использовать более эффективное локальное обновление вместо перезагрузки сообщений.

## Тестирование
1. Откройте чат в двух браузерах под разными пользователями
2. Поставьте реакцию в одном браузере
3. Убедитесь, что реакция появилась во втором браузере
4. Проверьте логи в консоли для подтверждения срабатывания механизма
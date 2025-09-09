# Исправление обработки сообщений и реакций Centrifuge

## Проблема
1. Сообщения из Centrifuge не обновлялись в чатах. Анализ показал несоответствие между структурой данных, получаемых от WebSocket, и логикой их обработки.
2. Реакции не обрабатывались через WebSocket, требовалась ручная перезагрузка страницы.
3. Двойная подписка на чаты (индивидуальные каналы + общий канал пользователя).

## Структура данных от Centrifuge

### Новые сообщения
```json
{
  "push": {
    "channel": "chats:user#61fd72aa-9457-42b8-9098-7c0a676cad6e",
    "pub": {
      "data": {
        "event_type": "new_message",
        "data": {
          "chat_id": 16,
          "message": {
            "id": 373,
            "content": "12423423 42 ыф цу",
            "is_read": false,
            "is_edited": false,
            "attachments": [],
            "created_at": "2025-09-08T06:16:52.365056+05:00",
            "created_by": {
              "id": "365aa564-af67-4495-bf21-a5c58e97002e",
              "first_name": "Михаил",
              "last_name": "Стельмах"
            },
            "reactions": []
          }
        }
      }
    }
  }
}
```

### Новые реакции
```json
{
  "push": {
    "channel": "chats:user#61fd72aa-9457-42b8-9098-7c0a676cad6e",
    "pub": {
      "data": {
        "event_type": "new_reaction",
        "data": {
          "chat_id": 16,
          "message_id": 378,
          "reaction_type_id": 1
        }
      }
    }
  }
}
```

## Изменения

### 1. Исправлена логика обработки в `handleCentrifugoMessage`
**Файл:** `/workspace/src/refactoring/modules/chat/stores/chatStore.ts`

**Было:**
```typescript
case 'new_message':
    this.handleNewMessage(data.message || data.object || data, data.chat_id)
    break
```

**Стало:**
```typescript
case 'new_message':
    // Проверяем структуру данных из центрифуго
    const messageData = data?.data?.message || data.message || data.object || data
    const chatId = data?.data?.chat_id || data.chat_id
    
    if (messageData && chatId) {
        this.handleNewMessage(messageData, chatId)
    } else {
        console.warn('⚠️ Некорректная структура данных для нового сообщения:', data)
    }
    break
```

### 2. Добавлена обработка реакций через WebSocket
**Файл:** `/workspace/src/refactoring/modules/chat/stores/chatStore.ts`

```typescript
case 'reaction_added':
case 'reaction_removed':
case 'new_reaction':
    this.handleReactionUpdate(data)
    break
```

**Улучшенный метод `handleReactionUpdate`:**
```typescript
handleReactionUpdate(data: any): void {
    console.log('🎭 Обработка реакции:', data)
    
    const reactionData = data?.data || data
    const chatId = reactionData?.chat_id || data?.chat_id
    const messageId = reactionData?.message_id || data?.message_id
    const reactionTypeId = reactionData?.reaction_type_id || data?.reaction_type_id
    
    if (!chatId || !messageId) {
        console.warn('⚠️ Некорректные данные реакции:', data)
        return
    }
    
    if (this.currentChat && chatId === this.currentChat.id) {
        this.fetchMessages(this.currentChat.id).catch((error) => {
            console.error('Ошибка при обновлении сообщений после реакции:', error)
        })
    }
}
```

### 3. Оптимизирована система подписки на чаты
**Файл:** `/workspace/src/refactoring/modules/chat/stores/chatStore.ts`

**Убрана двойная подписка и устаревший метод:**
- Удален метод `subscribeToAllChats()` 
- Прямое использование `subscribeToUserChannel()` в `fetchChats()`
- Улучшен комментарий к `subscribeToUserChannel()` с объяснением новой системы

```typescript
// Подписывается на единый канал пользователя для получения уведомлений о всех чатах
// Используется новая система: один канал chats:user#${userUuid} вместо подписки на каждый чат отдельно
subscribeToUserChannel(): void {
    // ... реализация
}

// В fetchChats():
// Подписываемся на единый канал пользователя для получения уведомлений о всех чатах
this.subscribeToUserChannel()
```

### 4. Добавлено подробное логирование
- В `centrifugeStore.ts` добавлено логирование получаемых публикаций с типом события
- В `chatStore.ts` добавлено логирование обработки сообщений и реакций
- Создан тестовый файл `test-reaction-handling.js` для отладки

### 5. Улучшена обработка ошибок
- Добавлены проверки на корректность структуры данных
- Добавлены предупреждения при некорректных данных
- Добавлена обработка ошибок при обновлении сообщений

## Тестирование

### 1. Тестирование реакций
Запустите файл `test-reaction-handling.js` в консоли браузера:
```javascript
// Скопируйте содержимое test-reaction-handling.js в консоль браузера
// Затем вызовите:
testReactionHandling()
```

### 2. Автоматическое тестирование сообщений
Запустите файл `debug-centrifuge-fix.js` в консоли браузера:
```javascript
// Скопируйте содержимое debug-centrifuge-fix.js в консоль браузера
```

### 3. Ручное тестирование через консоль

#### Тестирование сообщений:
```javascript
// Получить store чата
const chatStore = window.debugCentrifuge.getChatStore();

// Протестировать с данными пользователя
window.debugCentrifuge.testWithData({
  event_type: "new_message",
  data: {
    chat_id: 16,
    message: {
      id: 999,
      content: "Тестовое сообщение",
      is_read: false,
      is_edited: false,
      attachments: [],
      created_at: new Date().toISOString(),
      created_by: {
        id: "365aa564-af67-4495-bf21-a5c58e97002e",
        first_name: "Михаил",
        last_name: "Стельмах"
      },
      reactions: []
    }
  }
});
```

#### Тестирование реакций:
```javascript
// Получить store чата напрямую
const { useChatStore } = window.pinia;
const chatStore = useChatStore();

// Протестировать реакцию
chatStore.handleCentrifugoMessage({
  event_type: "new_reaction",
  data: {
    chat_id: 16,
    message_id: 378,
    reaction_type_id: 1
  }
});
```

### 4. Проверка в реальных условиях

#### Тестирование сообщений:
1. Откройте чат в приложении
2. Отправьте сообщение из другого устройства/браузера
3. Проверьте, что сообщение появляется без перезагрузки страницы
4. Проверьте консоль на наличие логов с эмодзи (🔔, 📨, ✉️)

#### Тестирование реакций:
1. Откройте чат в приложении
2. Поставьте реакцию на сообщение из другого устройства/браузера
3. Проверьте, что реакция появляется без перезагрузки страницы
4. Проверьте консоль на наличие логов с эмодзи (🎭)

## Ожидаемые результаты
- Сообщения должны появляться в чате в реальном времени
- Реакции должны обновляться в реальном времени
- В консоли должны появляться логи с соответствующими эмодзи (🔔, 📨, 🎭)
- Счетчики непрочитанных сообщений должны обновляться
- Звуки уведомлений должны воспроизводиться
- Система подписки использует только единый канал `chats:user#${userUuid}`

## Откат изменений
Если что-то пойдет не так, можно откатить изменения:
1. Удалить добавленное логирование
2. Вернуть исходную логику в `handleCentrifugoMessage`
3. Перезапустить приложение
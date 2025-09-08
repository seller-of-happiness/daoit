# Исправление обработки сообщений Centrifuge

## Проблема
Сообщения из Centrifuge не обновлялись в чатах. Анализ показал несоответствие между структурой данных, получаемых от WebSocket, и логикой их обработки.

## Структура данных от Centrifuge
Согласно логам пользователя, данные приходят в следующем формате:
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
    
    console.log('📨 Обработка нового сообщения:', { messageData, chatId })
    
    if (messageData && chatId) {
        this.handleNewMessage(messageData, chatId)
    } else {
        console.warn('⚠️ Некорректная структура данных для нового сообщения:', data)
    }
    break
```

### 2. Добавлено подробное логирование
- В `centrifugeStore.ts` добавлено логирование получаемых публикаций
- В `chatStore.ts` добавлено логирование обработки сообщений
- Добавлен метод `debugTestCentrifugeMessage` для тестирования

### 3. Улучшена обработка ошибок
- Добавлены проверки на корректность структуры данных
- Добавлены предупреждения при некорректных данных

## Тестирование

### 1. Автоматическое тестирование
Запустите файл `debug-centrifuge-fix.js` в консоли браузера:
```javascript
// Скопируйте содержимое debug-centrifuge-fix.js в консоль браузера
```

### 2. Ручное тестирование через консоль
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

### 3. Проверка в реальных условиях
1. Откройте чат в приложении
2. Отправьте сообщение из другого устройства/браузера
3. Проверьте, что сообщение появляется без перезагрузки страницы
4. Проверьте консоль на наличие логов с эмодзи (🔔, 📨, ✉️)

## Ожидаемые результаты
- Сообщения должны появляться в чате в реальном времени
- В консоли должны появляться логи с соответствующими эмодзи
- Счетчики непрочитанных сообщений должны обновляться
- Звуки уведомлений должны воспроизводиться

## Откат изменений
Если что-то пойдет не так, можно откатить изменения:
1. Удалить добавленное логирование
2. Вернуть исходную логику в `handleCentrifugoMessage`
3. Перезапустить приложение
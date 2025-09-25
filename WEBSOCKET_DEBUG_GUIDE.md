# Руководство по отладке WebSocket и приглашений

## Проблема: Приглашения не приходят через сокет

### Быстрая диагностика

1. **Откройте консоль браузера** (F12)

2. **Проверьте подключение к WebSocket**:
   ```javascript
   window.chatDebug.checkConnection()
   ```

3. **Посмотрите полную диагностику**:
   ```javascript
   window.chatDebug.diagnostics()
   ```

4. **Переподключитесь к WebSocket** (если не подключен):
   ```javascript
   await window.chatDebug.reconnect()
   ```

5. **Симулируйте приглашение** для проверки обработчиков:
   ```javascript
   window.chatDebug.simulateInvitation("Тестовый чат")
   ```

### Что проверять в логах

#### 1. Подключение к Centrifuge
Ищите в консоли:
```
[ChatStore] Подписываемся на канал: chats:user#UUID
[ChatStore] Состояние Centrifuge: {...}
[ChatStore] Подписка на канал успешно установлена
```

#### 2. Получение WebSocket сообщений
Ищите в консоли:
```
[CENTRIFUGE] Received publication: {...}
[ChatStore] Получено сообщение из centrifuge: {...}
[CHAT INVITATION DEBUG] Обрабатываем приглашение: {...}
```

#### 3. Отправка приглашений
Ищите в консоли:
```
[ChatStore] Отправляем приглашения: {...}
[ChatStore] Ответ сервера на отправку приглашений: {...}
```

### Частые проблемы и решения

#### 1. WebSocket не подключен
**Симптомы**: `connected: false` в диагностике
**Решение**: 
```javascript
await window.chatDebug.reconnect()
```

#### 2. Не подписан на пользовательский канал
**Симптомы**: `subscribedToUserChannel: false` в диагностике
**Решение**: Проверьте UUID пользователя и переподключитесь

#### 3. Приходят сообщения, но не приглашения
**Симптомы**: Обычные сообщения работают, приглашения нет
**Решение**: Проверьте `event_type` в получаемых сообщениях

#### 4. Ошибки в обработчиках
**Симптомы**: `[CENTRIFUGE] Ошибка в обработчике канала`
**Решение**: Проверьте структуру данных приглашения

### Диагностика на сервере

1. **Проверьте эндпоинт отправки приглашений**:
   ```bash
   curl -X POST "http://localhost:3000/api/chat/chat/1/add-members/" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"user_ids": ["user-uuid"]}'
   ```

2. **Проверьте, что сервер публикует в Centrifuge**:
   Должны быть логи публикации в канал `chats:user#UUID`

### Структура сообщения приглашения

Ожидаемая структура WebSocket сообщения:
```json
{
  "event_type": "new_invite",
  "data": {
    "id": 123,
    "chat": {
      "id": 1,
      "title": "Название чата",
      "type": "group",
      "icon": null
    },
    "created_by": {
      "id": "user-uuid",
      "first_name": "Имя",
      "last_name": "Фамилия"
    },
    "invited_user": {
      "id": "invited-user-uuid",
      "first_name": "Имя",
      "last_name": "Фамилия"
    },
    "is_accepted": false,
    "created_at": "2024-01-01T12:00:00Z"
  }
}
```

### Возможные типы событий для приглашений

Клиент обрабатывает следующие типы:
- `new_invite`
- `invitation_created`
- `chat_invitation`
- `user_invited`
- `invite_created`
- `invitation`

### Кнопка диагностики в UI

В development режиме в заголовке чата есть кнопка с шестеренкой для быстрой диагностики WebSocket соединения.

### Если ничего не помогает

1. Проверьте сетевые запросы в Developer Tools
2. Убедитесь, что токен Centrifuge действителен
3. Проверьте, что сервер действительно публикует события
4. Убедитесь, что UUID пользователя корректный
5. Проверьте CORS настройки для WebSocket
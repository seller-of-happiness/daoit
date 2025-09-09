# Функциональность приглашений в чаты

## Обзор изменений

Реализована полная функциональность для работы с приглашениями в чаты, включая:

1. **Загрузка приглашений при инициализации** - приглашения загружаются автоматически при обновлении страницы
2. **Принятие приглашений** - пользователь может принять приглашение в чат
3. **Отклонение приглашений** - пользователь может отклонить приглашение

## API Endpoints

### GET /api/chat/invite/
Получение списка приглашений в чаты для текущего пользователя.

**Ответ:**
```json
[
  {
    "id": 1,
    "chat": {
      "id": 123,
      "title": "Название чата",
      "type": "group"
    },
    "created_by": {
      "id": "user-uuid",
      "first_name": "Имя",
      "last_name": "Фамилия"
    },
    "invited_user": {
      "id": "current-user-uuid",
      "first_name": "Имя",
      "last_name": "Фамилия"
    },
    "is_accepted": false,
    "created_at": "2024-01-01T12:00:00Z"
  }
]
```

### POST /api/chat/invite/
Приглашение пользователей в чат.

**Тело запроса:**
```json
{
  "chat_id": 123,
  "user_ids": ["user-uuid-1", "user-uuid-2"]
}
```

### POST /api/chat/invite/{id}/accept/
Принятие приглашения в чат.

### DELETE /api/chat/invite/{id}/decline/
Отклонение приглашения в чат.

## Изменения в коде

### 1. ChatStore (chatStore.ts)

#### Обновленные методы:

- **`initializeOnce()`** - добавлен вызов `fetchInvitations()` после загрузки чатов
- **`fetchInvitations()`** - теперь сохраняет приглашения в состояние store
- **`declineInvitation()`** - использует API endpoint `/decline/` для отклонения приглашения

#### Новая функциональность:

```typescript
// Загрузка приглашений при инициализации
async initializeOnce(): Promise<void> {
    // ...
    await this.fetchChats()
    
    // Загружаем приглашения после загрузки чатов
    await this.fetchInvitations()
    // ...
}

// Обновленный метод загрузки приглашений
async fetchInvitations(): Promise<void> {
    try {
        const res = await axios.get(`${BASE_URL}/api/chat/invite/`)
        const invitationsData = res.data?.results ?? res.data
        
        if (Array.isArray(invitationsData)) {
            this.invitations = invitationsData
        } else {
            this.invitations = []
        }
    } catch (error) {
        this.invitations = []
    }
}
```

### 2. WebSocket обработка

Приглашения уже обрабатываются через WebSocket в методе `handleNewInvitation()`:

- При получении события `new_invite` через WebSocket приглашение автоматически добавляется в список
- Показывается toast-уведомление о новом приглашении
- Приглашение отображается в боковой панели чата

### 3. UI компоненты

#### ChatSidebar.vue
- Отображает список приглашений в отдельной секции
- Показывает счетчик приглашений
- Обрабатывает события принятия/отклонения

#### InvitationListItem.vue
- Компонент для отображения отдельного приглашения
- Кнопки принятия и отклонения
- Отображение информации о чате и пригласившем пользователе

## Тестирование

Для тестирования функциональности используйте файл `test-invitations.http`:

```http
# Получить список приглашений
GET {{BASE_URL}}/api/chat/invite/
Authorization: Bearer {{TOKEN}}

# Пригласить пользователей
POST {{BASE_URL}}/api/chat/invite/
Content-Type: application/json
{
    "chat_id": 1,
    "user_ids": ["user-uuid-1"]
}

# Принять приглашение
POST {{BASE_URL}}/api/chat/invite/1/accept/

# Отклонить приглашение  
DELETE {{BASE_URL}}/api/chat/invite/1/decline/
```

## Особенности реализации

1. **Автоматическая загрузка** - приглашения загружаются при каждом обновлении страницы
2. **Реальное время** - новые приглашения приходят через WebSocket и отображаются мгновенно
3. **Обработка ошибок** - все методы содержат обработку ошибок с показом уведомлений
4. **Типизация** - все данные типизированы через интерфейс `IChatInvitation`
5. **Состояние** - приглашения хранятся в глобальном состоянии Pinia store

## Поток работы

1. **При загрузке страницы**: вызывается `initializeOnce()` → `fetchInvitations()` → приглашения загружаются и отображаются
2. **При получении нового приглашения через WebSocket**: `handleNewInvitation()` → приглашение добавляется в список + показывается уведомление
3. **При принятии приглашения**: `acceptInvitation()` → API вызов → приглашение удаляется из списка → обновляется список чатов
4. **При отклонении приглашения**: `declineInvitation()` → API вызов → приглашение удаляется из списка
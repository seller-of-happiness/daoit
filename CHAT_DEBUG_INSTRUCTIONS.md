# Инструкции по отладке чата

## Проблема
Отсутствуют записи в консоли при отправке сообщений и реакций.

## Добавленная отладка

В код были добавлены подробные console.log записи для отслеживания всех этапов работы чата:

### 1. Отправка сообщений
- `[CHAT DEBUG]` - отладка отправки сообщений в chatStore.ts
- `[CHAT LOGIC DEBUG]` - отладка в композабле useChatLogic.ts

### 2. Реакции
- `[REACTION DEBUG]` - отладка всех операций с реакциями (добавление, удаление, очистка)
- `[CHAT LOGIC DEBUG]` - отладка логики реакций в композабле

### 3. WebSocket события
- `[WEBSOCKET DEBUG]` - отладка подписки на каналы и получения событий
- `[CHAT SORT]` - отладка сортировки чатов (уже была в коде)

## Как проверить

### Шаг 1: Откройте консоль браузера
1. Откройте приложение в браузере
2. Нажмите F12 или Ctrl+Shift+I
3. Перейдите на вкладку Console

### Шаг 2: Проверьте подключение к WebSocket
1. При загрузке страницы должны появиться записи:
   ```
   [WEBSOCKET DEBUG] subscribeToUserChannel called
   [WEBSOCKET DEBUG] User UUID for subscription: [ваш UUID]
   [WEBSOCKET DEBUG] Subscribing to channel: chats:user#[UUID]
   [WEBSOCKET DEBUG] Subscription to user channel completed
   ```

### Шаг 3: Проверьте отправку сообщения
1. Попробуйте отправить сообщение
2. Должны появиться записи:
   ```
   [CHAT LOGIC DEBUG] sendMessage called with content: [текст сообщения]
   [CHAT DEBUG] sendMessage called with: {content: "...", currentChatId: 123}
   [CHAT DEBUG] Setting isSending to true, starting message send...
   [CHAT DEBUG] Making POST request to: [URL]
   [CHAT DEBUG] Request payload: {content: "..."}
   ```

3. При успешной отправке:
   ```
   [CHAT DEBUG] Message sent successfully, response: [данные ответа]
   [CHAT DEBUG] sendMessage completed successfully
   [CHAT LOGIC DEBUG] sendMessage completed successfully
   ```

4. При ошибке:
   ```
   [CHAT DEBUG] sendMessage failed with error: [ошибка]
   [CHAT DEBUG] Error details: {message: "...", status: 500, ...}
   ```

### Шаг 4: Проверьте реакции
1. Попробуйте добавить реакцию на сообщение
2. Должны появиться записи:
   ```
   [CHAT LOGIC DEBUG] changeReaction called with: {messageId: 123, reactionId: 1, prevReactionId: null}
   [CHAT LOGIC DEBUG] User has no existing reaction, adding new reaction...
   [REACTION DEBUG] addReaction called with: {messageId: 123, reactionId: 1, currentChatId: 456}
   [REACTION DEBUG] Making POST request to: [URL]
   [REACTION DEBUG] Request payload: {reaction_type_id: 1}
   [REACTION DEBUG] Reaction added successfully
   ```

### Шаг 5: Проверьте получение WebSocket событий
1. После отправки сообщения или реакции должны появиться записи:
   ```
   [WEBSOCKET DEBUG] Received data on channel chats:user#[UUID]: [данные события]
   [WEBSOCKET DEBUG] Received centrifugo message: [данные]
   [WEBSOCKET DEBUG] Event type: new_message
   [WEBSOCKET DEBUG] Processing new message event
   ```

## Возможные причины отсутствия логов

### 1. Функции не вызываются
- Проверьте, что кнопки отправки сообщений и реакций работают
- Убедитесь, что нет JavaScript ошибок, блокирующих выполнение

### 2. Проблемы с сетью
- Откройте вкладку Network в DevTools
- Проверьте, отправляются ли HTTP запросы при отправке сообщений/реакций
- Проверьте статус ответов (200, 400, 500 и т.д.)

### 3. Проблемы с WebSocket
- Проверьте подключение к WebSocket в Network -> WS
- Убедитесь, что соединение установлено и активно

### 4. Ошибки аутентификации
- Проверьте, что пользователь авторизован
- Убедитесь, что токен доступа действителен

## Дополнительная диагностика

### Проверка состояния чата
```javascript
// В консоли браузера выполните:
const chatStore = window.$pinia.state.value.chatStore
console.log('Current chat:', chatStore.currentChat)
console.log('Messages:', chatStore.messages)
console.log('Is sending:', chatStore.isSending)
```

### Проверка пользователя
```javascript
const userStore = window.$pinia.state.value.userStore  
console.log('Current user:', userStore.user)
```

### Проверка центрифуго
```javascript
const centrifugeStore = window.$pinia.state.value.centrifugeStore
console.log('Centrifuge connection:', centrifugeStore)
```

## Следующие шаги

После выполнения этих проверок вы сможете понять:
1. Вызываются ли функции отправки сообщений/реакций
2. Отправляются ли HTTP запросы на сервер
3. Получает ли приложение ответы от сервера
4. Работает ли WebSocket подключение
5. Обрабатываются ли события в реальном времени

На основе полученной информации можно будет определить точную причину проблемы и принять меры по её устранению.
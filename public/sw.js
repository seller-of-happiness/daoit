// Service Worker для звуковых уведомлений

self.addEventListener('install', (event) => {
    console.log('📦 Service Worker установлен')
    self.skipWaiting()
})

self.addEventListener('activate', (event) => {
    console.log('🚀 Service Worker активирован')
    event.waitUntil(self.clients.claim())
})

// Обработка сообщений от основного потока
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'PLAY_SOUND') {
        console.log('🔊 SW: Получен запрос на воспроизведение звука')

        // Показываем notification со звуком (обходит ограничения!)
        self.registration
            .showNotification('💬 Новое сообщение в чате', {
                icon: '/favicon.ico',
                badge: '/favicon.ico',
                silent: false, // ВАЖНО: false = звук включен
                tag: 'chat-message',
                data: event.data,
                requireInteraction: false, // Не требует взаимодействия
                actions: [],
                // Дополнительные параметры для максимальной совместимости
                vibrate: [200, 100, 200], // Вибрация на мобильных
            })
            .then(() => {
                console.log('✅ SW: Уведомление показано')

                // Закрываем уведомление через 2 секунды (больше времени для звука)
                setTimeout(() => {
                    self.registration
                        .getNotifications({ tag: 'chat-message' })
                        .then((notifications) => {
                            notifications.forEach((notification) => notification.close())
                            console.log('🗑️ SW: Уведомление автоматически закрыто')
                        })
                }, 2000)
            })
    }
})

// На некоторых браузерах требуется, чтобы была активна хотя бы одна клиентская страница
self.addEventListener('notificationclose', () => {})

// Fallback: если основная страница попросит проиграть звук напрямую
self.addEventListener('push', (event) => {
    // Если будете подключать Push API — здесь тоже будет играть системный звук
})

// Обработка клика по уведомлению
self.addEventListener('notificationclick', (event) => {
    console.log('👆 SW: Клик по уведомлению')
    event.notification.close()

    // Фокусируем окно чата
    event.waitUntil(
        self.clients.matchAll({ type: 'window' }).then((clients) => {
            if (clients.length > 0) {
                return clients[0].focus()
            }
            return self.clients.openWindow('/')
        }),
    )
})

console.log('🎵 Service Worker для звуковых уведомлений готов')

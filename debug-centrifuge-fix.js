// Отладочный скрипт для проверки исправления обработки сообщений Centrifuge
// Запустите этот код в консоли браузера на странице с чатом

console.log('🔧 Отладочный скрипт для проверки исправления Centrifuge');

// Получаем доступ к store чата через Vue DevTools или глобальный объект
function getChatStore() {
    // Попробуем найти store через Vue DevTools
    if (window.__VUE_DEVTOOLS_GLOBAL_HOOK__) {
        const apps = window.__VUE_DEVTOOLS_GLOBAL_HOOK__.apps;
        if (apps && apps.length > 0) {
            const app = apps[0];
            if (app && app.config && app.config.globalProperties) {
                const $pinia = app.config.globalProperties.$pinia;
                if ($pinia) {
                    // Найдем store чата
                    for (const store of Object.values($pinia._s)) {
                        if (store.$id === 'chatStore') {
                            return store;
                        }
                    }
                }
            }
        }
    }
    
    console.error('❌ Не удалось найти chatStore. Убедитесь, что приложение запущено и чат открыт.');
    return null;
}

// Тестируем исправление
function testCentrifugeFix() {
    const chatStore = getChatStore();
    if (!chatStore) return;

    console.log('✅ ChatStore найден:', chatStore);
    console.log('📊 Текущее состояние:', {
        currentChat: chatStore.currentChat,
        messagesCount: chatStore.messages.length,
        chatsCount: chatStore.chats.length
    });

    // Тестируем с данными пользователя
    const testData = {
        event_type: "new_message",
        data: {
            chat_id: 16,
            message: {
                id: Math.floor(Math.random() * 10000) + 1000, // Уникальный ID
                content: "Тестовое сообщение для проверки исправления " + new Date().toLocaleTimeString(),
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
    };

    console.log('🧪 Тестируем с данными:', testData);
    
    if (typeof chatStore.debugTestCentrifugeMessage === 'function') {
        chatStore.debugTestCentrifugeMessage(testData);
    } else {
        console.log('⚠️ Метод debugTestCentrifugeMessage не найден, вызываем handleCentrifugoMessage напрямую');
        if (typeof chatStore.handleCentrifugoMessage === 'function') {
            chatStore.handleCentrifugoMessage(testData);
        } else {
            console.error('❌ Метод handleCentrifugoMessage не найден');
        }
    }

    // Проверяем результат через секунду
    setTimeout(() => {
        console.log('📈 Состояние после теста:', {
            messagesCount: chatStore.messages.length,
            lastMessage: chatStore.messages[chatStore.messages.length - 1]
        });
    }, 1000);
}

// Запускаем тест
testCentrifugeFix();

// Экспортируем функции для повторного использования
window.debugCentrifuge = {
    getChatStore,
    testCentrifugeFix,
    
    // Прямой тест с пользовательскими данными
    testWithData: (data) => {
        const chatStore = getChatStore();
        if (chatStore && typeof chatStore.handleCentrifugoMessage === 'function') {
            chatStore.handleCentrifugoMessage(data);
        }
    }
};

console.log('✅ Отладочные функции доступны в window.debugCentrifuge');
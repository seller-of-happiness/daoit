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

// Запускаем тесты
testCentrifugeFix();

// Запускаем тест реакций через 3 секунды после основного теста
setTimeout(() => {
    console.log('🚀 Запускаем тест реакций...');
    testReactionUpdate();
}, 3000);

// Тестируем обновление реакций
function testReactionUpdate() {
    const chatStore = getChatStore();
    if (!chatStore) return;

    console.log('🎭 Тестируем обновление реакций...');
    
    // Проверяем, есть ли сообщения для тестирования
    if (!chatStore.messages || chatStore.messages.length === 0) {
        console.warn('⚠️ Нет сообщений для тестирования реакций');
        return;
    }

    const testMessage = chatStore.messages[chatStore.messages.length - 1];
    console.log('📝 Тестируем с сообщением:', testMessage);

    // Тестовые данные реакции как из вашего примера
    const testReactionData = {
        event_type: "new_reaction",
        data: {
            chat_id: chatStore.currentChat?.id || 16,
            message_id: testMessage.id,
            reaction_type_id: 3,
            user_id: "test-user-123"
        }
    };

    console.log('🧪 Тестируем добавление реакции:', testReactionData);
    
    // Вызываем обработчик
    if (typeof chatStore.handleCentrifugoMessage === 'function') {
        chatStore.handleCentrifugoMessage(testReactionData);
    } else if (typeof chatStore.handleReactionUpdate === 'function') {
        chatStore.handleReactionUpdate(testReactionData);
    } else {
        console.error('❌ Методы обработки реакций не найдены');
        return;
    }

    // Проверяем результат
    setTimeout(() => {
        const updatedMessage = chatStore.messages.find(m => m.id === testMessage.id);
        console.log('✅ Результат обновления реакции:', {
            messageId: testMessage.id,
            originalReactions: testMessage.reactions || testMessage.message_reactions || [],
            updatedReactions: updatedMessage?.reactions || updatedMessage?.message_reactions || []
        });
    }, 500);

    // Тестируем удаление реакции
    setTimeout(() => {
        const removeReactionData = {
            event_type: "reaction_removed",
            data: {
                chat_id: chatStore.currentChat?.id || 16,
                message_id: testMessage.id,
                reaction_type_id: 3,
                user_id: "test-user-123"
            }
        };

        console.log('🧪 Тестируем удаление реакции:', removeReactionData);
        
        if (typeof chatStore.handleCentrifugoMessage === 'function') {
            chatStore.handleCentrifugoMessage(removeReactionData);
        } else if (typeof chatStore.handleReactionUpdate === 'function') {
            chatStore.handleReactionUpdate(removeReactionData);
        }

        setTimeout(() => {
            const finalMessage = chatStore.messages.find(m => m.id === testMessage.id);
            console.log('✅ Результат удаления реакции:', {
                messageId: testMessage.id,
                finalReactions: finalMessage?.reactions || finalMessage?.message_reactions || []
            });
        }, 500);
    }, 2000);
}

// Экспортируем функции для повторного использования
window.debugCentrifuge = {
    getChatStore,
    testCentrifugeFix,
    testReactionUpdate,
    
    // Прямой тест с пользовательскими данными
    testWithData: (data) => {
        const chatStore = getChatStore();
        if (chatStore && typeof chatStore.handleCentrifugoMessage === 'function') {
            chatStore.handleCentrifugoMessage(data);
        }
    },
    
    // Тест реакции с пользовательскими данными
    testReaction: (chatId, messageId, reactionTypeId, userId, eventType = 'new_reaction') => {
        const chatStore = getChatStore();
        if (!chatStore) return;
        
        const reactionData = {
            event_type: eventType,
            data: {
                chat_id: chatId,
                message_id: messageId,
                reaction_type_id: reactionTypeId,
                user_id: userId
            }
        };
        
        console.log('🎭 Тестируем реакцию с данными:', reactionData);
        
        if (typeof chatStore.handleCentrifugoMessage === 'function') {
            chatStore.handleCentrifugoMessage(reactionData);
        }
    }
};

console.log('✅ Отладочные функции доступны в window.debugCentrifuge');
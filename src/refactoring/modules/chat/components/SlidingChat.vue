<template>
    <!-- Overlay для всей страницы -->
    <Transition name="overlay">
        <div
            v-if="isVisible"
            class="fixed inset-0 bg-surface-950 bg-opacity-50 backdrop-blur-sm z-[9990]"
            @click="closeChat"
        />
    </Transition>

    <!-- Основной контейнер скользящего чата -->
    <Transition name="slide-right">
        <div
            v-if="isVisible"
            class="fixed right-0 top-0 h-full bg-white dark:bg-surface-900 shadow-xl shadow-surface-900 z-[9991] w-full max-w-[94vw] pb-10"
        >
            <div class="slide-btn w-full flex justify-end pt-8 px-8">
                <!-- Кнопка переключения в полный режим -->
                <Button
                    v-if="!isMobile"
                    icon="pi pi-external-link"
                    severity="secondary"
                    text
                    rounded
                    size="medium"
                    v-tooltip.bottom="'Открыть в полном режиме'"
                    @click="openFullChat"
                />

                <!-- Кнопка закрытия -->
                <Button
                    icon="pi pi-times"
                    severity="secondary"
                    text
                    rounded
                    size="medium"
                    v-tooltip.bottom="'Закрыть'"
                    @click="closeChat"
                />
            </div>
            <div class="flex gap-4 h-full flex-wrap md:flex-nowrap relative overflow-hidden">
                <!-- Боковая панель -->
                <ChatSidebar
                    :chats="chatStore.chats"
                    :current-chat-id="chatStore.currentChat?.id || null"
                    :search-results="chatStore.searchResults"
                    :is-searching="chatStore.isSearching"
                    :invitations="chatStore.invitations"
                    :mobile-class="mobileAsideClass"
                    @select-chat="openChatFromList"
                    @create-chat="showCreate = true"
                    @create-dialog="createNewDialog"
                    @search="performSearch"
                    @clear-search="clearSearch"
                    @accept-invitation="acceptInvitation"
                    @decline-invitation="declineInvitation"
                    class="!pt-0"
                />

                <!-- Основная область чата -->
                <section
                    class="w-full card !pt-0 flex flex-col overflow-hidden"
                    :class="mobileChatClass"
                >
                    <!-- Заголовок чата -->
                    <ChatHeader
                        :current-chat="chatStore.currentChat"
                        :is-mobile="isMobile"
                        :mobile-view="mobileView"
                        @back-to-list="mobileView = 'list'"
                        @invite-users="showInviteDialog = true"
                    >
                    </ChatHeader>

                    <!-- Область сообщений -->
                    <div
                        id="sliding-chat-messages"
                        ref="messagesContainer"
                        class="flex-1 overflow-y-auto py-4 px-10 bg-surface-50 dark:bg-surface-900/40 flex flex-col gap-1"
                    >
                        <template v-if="chatStore.currentChat">
                            <template v-for="group in groupedMessages" :key="group.key">
                                <div class="text-center text-sm text-surface-500 my-2 select-none">
                                    {{ group.label }}
                                </div>
                                <MessageItem
                                    v-for="message in group.items"
                                    :key="message.id"
                                    :message="message"
                                    :reaction-types="chatStore.reactionTypes"
                                    :current-user-id="currentUser.id.value"
                                    :current-user-name="currentUser.nameForChat.value"
                                    :chat-members="chatStore.currentChat?.members"
                                    @change-reaction="changeReaction"
                                    @remove-my-reaction="removeMyReaction"
                                />
                            </template>
                        </template>
                        <template v-else>
                            <div class="h-full flex items-center justify-center text-surface-500">
                                Выберите чат слева
                            </div>
                        </template>
                    </div>

                    <!-- Область ввода -->
                    <ChatInput
                        :current-chat="chatStore.currentChat"
                        :is-sending="chatStore.isSending"
                        @send-message="sendMessage"
                        @upload-file="uploadFile"
                    />
                </section>

                <!-- Баннер активации звука (как в Битрикс24/Telegram) -->

                <!-- Баннер активации звука (как в Битрикс24/Telegram) -->
                <SoundActivationBanner />
            </div>
        </div>
    </Transition>

    <!-- Модальные окна для скользящего чата -->
    <!-- Диалог создания чата -->
    <ChatCreateDialog v-model:visible="showCreate" @create="createChat" />

    <!-- Диалог приглашения пользователей -->
    <InviteUsersDialog
        v-model:visible="showInviteDialog"
        :chat="chatStore.currentChat"
        @invite-users="inviteUsers"
    />
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useChatLogic } from '@/refactoring/modules/chat/composables/useChatLogic'
import { usePhotoSwipe } from '@/refactoring/modules/chat/composables/usePhotoSwipe'
import 'photoswipe/style.css'

import ChatSidebar from './ChatSidebar.vue'
import ChatHeader from './ChatHeader.vue'
import ChatInput from './ChatInput.vue'
import MessageItem from './MessageItem.vue'
import ChatCreateDialog from './ChatCreateDialog.vue'
import InviteUsersDialog from './InviteUsersDialog.vue'
import SoundActivationBanner from './SoundActivationBanner.vue'

interface Props {
    /** Видимость скользящего чата */
    visible?: boolean
    /** Начальный ID чата для открытия */
    initialChatId?: number | null
    /** Начальный ID пользователя для создания диалога */
    initialUserId?: string | null
    /** Ширина чата на desktop в пикселях */
    width?: number
}

interface Emits {
    (e: 'update:visible', visible: boolean): void
    (e: 'open-full-chat', chatId?: number): void
}

const props = withDefaults(defineProps<Props>(), {
    visible: false,
    initialChatId: null,
    initialUserId: null,
    width: 800,
})

const emit = defineEmits<Emits>()

// Инициализация композабла с общей логикой чата
const chatLogic = useChatLogic({
    userId: props.initialUserId,
    initialChatId: props.initialChatId,
    messagesContainerSelector: '#sliding-chat-messages',
})

// Состояние компонента
const showCreate = ref(false)
const showInviteDialog = ref(false)

// Извлекаем нужные переменные из композабла
const {
    chatStore,
    currentUser,
    messagesContainer,
    isMobile,
    mobileView,
    groupedMessages,
    scrollToBottom,
    openChatFromList,
    performSearch,
    clearSearch,
    createNewDialog,
    sendMessage,
    uploadFile,
    createChat: createChatBase,
    inviteUsersToChat,
    changeReaction,
    removeMyReaction,
    initialize,
    cleanup,
} = chatLogic

// Вычисляемые свойства
const isVisible = computed({
    get: () => props.visible,
    set: (value: boolean) => emit('update:visible', value),
})

const mobileAsideClass = computed(() =>
    isMobile.value
        ? [
              'absolute',
              'inset-0',
              'z-10',
              'transform',
              'transition-transform',
              'duration-300',
              mobileView.value === 'list' ? 'translate-x-0' : '-translate-x-full',
          ]
        : [],
)

const mobileChatClass = computed(() =>
    isMobile.value
        ? [
              'absolute',
              'inset-0',
              'z-20',
              'transform',
              'transition-transform',
              'duration-300',
              mobileView.value === 'chat' ? 'translate-x-0' : 'translate-x-full',
          ]
        : [],
)

const createChat = async (payload: {
    type: 'group' | 'channel'
    title: string
    description: string
    icon: File | null
}) => {
    await createChatBase(payload)
    showCreate.value = false
}

const inviteUsers = async (userIds: string[]) => {
    await inviteUsersToChat(userIds)
    showInviteDialog.value = false
}

const acceptInvitation = async (invitation: any) => {
    try {
        if (invitation.id) {
            await chatStore.acceptInvitation(invitation.id)
        }
        } catch (error) {
            // Ошибка при принятии приглашения
        }
}

const declineInvitation = async (invitation: any) => {
    try {
        if (invitation.id) {
            await chatStore.declineInvitation(invitation.id)
        }
        } catch (error) {
            // Ошибка при отклонении приглашения
        }
}

const closeChat = () => {
    isVisible.value = false
}

const openFullChat = () => {
    const chatId = chatStore.currentChat?.id
    emit('open-full-chat', chatId)
    closeChat()
}

// Инициализация галереи изображений
usePhotoSwipe({
    gallery: '#sliding-chat-messages',
    children: 'a.attachment-image-link, .attachments-only .img-wrap',
})

// Хуки жизненного цикла
onMounted(async () => {
    await initialize()
})

onUnmounted(() => {
    cleanup()
})

// Автоскролл при открытии чата
watch(
    () => props.visible,
    (newVisible) => {
        if (newVisible) {
            requestAnimationFrame(scrollToBottom)
        }
    },
)

// Отслеживаем изменения параметров чата и принудительно открываем нужный
watch(
    [() => props.initialChatId, () => props.initialUserId, () => props.visible],
    async ([newChatId, newUserId, visible]) => {
        if (visible && (newChatId || newUserId)) {
            try {
                let chatToOpen: any = null

                if (newUserId) {
                    console.log('SlidingChat: Trying to find/create chat with userId:', newUserId)
                    chatToOpen = await chatStore.findOrCreateDirectChat(newUserId)
                    console.log('SlidingChat: Successfully found/created chat:', chatToOpen)
                } else if (newChatId) {
                    console.log('SlidingChat: Trying to find chat with chatId:', newChatId)
                    chatToOpen = chatStore.chats.find((c) => c.id === newChatId) || null
                    if (!chatToOpen) {
                        // Попытаемся инициализировать чаты, если они еще не загружены
                        await chatStore.initializeOnce()
                        chatToOpen = chatStore.chats.find((c) => c.id === newChatId) || null
                    }
                    console.log('SlidingChat: Found chat with chatId:', chatToOpen)
                }

                if (chatToOpen) {
                    console.log('SlidingChat: Opening chat:', chatToOpen)
                    await chatStore.openChat(chatToOpen)
                    if (isMobile.value) mobileView.value = 'chat'
                } else {
                    console.log('SlidingChat: No chat found to open')
                }
            } catch (error) {
                console.error('SlidingChat: Error opening chat:', error)
            }
        }
    },
    { immediate: false },
)
</script>

<style lang="scss">
@use '../styles' as *;

// Специфичные стили компонента, которые не покрыты глобальными стилями
.slide-btn {
    .p-button {
        margin-left: 0.5rem;
    }
}
</style>

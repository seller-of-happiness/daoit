<template>
    <div class="flex gap-4 h-[calc(100vh-8rem)] flex-wrap md:flex-nowrap relative overflow-hidden">
        <!-- Боковая панель -->
        <ChatSidebar
            :chats="chatStore.chats"
            :current-chat-id="chatStore.currentChat?.id || null"
            :search-results="chatStore.searchResults"
            :is-searching="chatStore.isSearching"
            :mobile-class="mobileAsideClass"
            @select-chat="openChatFromList"
            @create-chat="showCreate = true"
            @create-dialog="createNewDialog"
            @search="performSearch"
            @clear-search="clearSearch"
            @join-public-chat="joinPublicChat"
        />

        <!-- Основная область чата -->
        <section class="w-full card p-0 flex flex-col overflow-hidden" :class="mobileChatClass">
            <!-- Заголовок чата -->
            <ChatHeader
                :current-chat="chatStore.currentChat"
                :is-mobile="isMobile"
                :mobile-view="mobileView"
                @back-to-list="mobileView = 'list'"
                @invite-users="showInviteDialog = true"
            />

            <!-- Область сообщений -->
            <div
                id="chat-messages"
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

        <!-- Диалог создания чата -->
        <ChatCreateDialog v-model:visible="showCreate" @create="createChat" />

        <!-- Диалог приглашения пользователей -->
        <InviteUsersDialog
            v-model:visible="showInviteDialog"
            :chat="chatStore.currentChat"
            @invite-users="inviteUsers"
        />

        <!-- Баннер активации звука (как в Битрикс24/Telegram) -->
        <SoundActivationBanner />
    </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
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

import type { IChat } from '@/refactoring/modules/chat/types/IChat'

interface Props {
    userId?: string
}

const props = defineProps<Props>()

// Инициализация композабла с общей логикой чата
const chatLogic = useChatLogic({
    userId: props.userId,
    messagesContainerSelector: '#chat-messages',
})

// Инициализация PhotoSwipe для галереи
usePhotoSwipe({
    gallery: '#chat-messages',
    children: 'a.attachment-image-link, .attachments-only .img-wrap',
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
    joinPublicChat,
    sendMessage,
    uploadFile,
    createChat: createChatBase,
    inviteUsersToChat,
    changeReaction,
    removeMyReaction,
    initialize,
    cleanup,
} = chatLogic

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

// Lifecycle hooks
onMounted(async () => {
    await initialize()
})

onUnmounted(() => {
    cleanup()
})
</script>

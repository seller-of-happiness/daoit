<template>
    <div class="flex gap-4 h-[calc(100vh-8rem)] flex-wrap md:flex-nowrap relative overflow-hidden">
        <!-- Боковая панель -->
        <ChatSidebar
            :chats="chatStore.chats"
            :current-chat-id="chatStore.currentChat?.id || null"
            :search-results="chatStore.searchResults"
            :is-searching="chatStore.isSearching"
            :is-loading-chats="chatStore.isLoadingChats"
            :invitations="chatStore.invitations"
            :mobile-class="mobileAsideClass"
            @select-chat="openChatFromList"
            @create-chat="showCreate = true"
            @create-dialog="createNewDialog"
            @search="performSearch"
            @clear-search="clearSearch"
            @accept-invitation="acceptInvitation"
            @decline-invitation="declineInvitation"
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
                @manage-chat="showManageDialog = true"
                @show-members="showMembersDialog = true"
            />

            <!-- Область сообщений -->
            <div
                id="chat-messages"
                ref="messagesContainer"
                class="flex-1 overflow-y-auto py-4 px-10 bg-surface-50 dark:bg-surface-900/40 flex flex-col gap-1"
            >
                <template v-if="chatStore.currentChat">
                    <!-- Показываем скелетоны во время загрузки -->
                    <template v-if="chatStore.isLoadingMessages">
                        <MessagesSkeletonGroup :count="6" />
                    </template>
                    
                    <!-- Показываем реальные сообщения после загрузки -->
                    <template v-else>
                        <template v-for="group in groupedMessages" :key="group.key">
                            <div class="text-center text-sm text-surface-500 my-2 select-none">
                                {{ group.label }}
                            </div>
                            <MessageItem
                                v-for="message in group.items"
                                :key="`${message.id}-${message.reaction_updated_at || message.updated_at || message.created_at}`"
                                :message="message"
                                :reaction-types="chatStore.reactionTypes"
                                :current-user-id="currentUser.id.value"
                                :current-user-name="currentUser.nameForChat.value"
                                :chat-members="chatStore.currentChat?.members"
                                @change-reaction="changeReaction"
                                @remove-my-reaction="removeMyReaction"
                                @edit-message="editMessage"
                                @delete-message="deleteMessage"
                            />
                        </template>
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

        <!-- Диалог управления чатом -->
        <ChatMembersManagement
            v-model:visible="showManageDialog"
            :chat="chatStore.currentChat"
            @chat-updated="onChatUpdated"
        />

        <!-- Модальное окно со списком участников -->
        <MembersListModal
            v-model:visible="showMembersDialog"
            :chat="chatStore.currentChat"
            @member-removed="onMemberRemoved"
        />

        <!-- Баннер активации звука (как в Битрикс24/Telegram) -->
        <SoundActivationBanner />
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useChatLogic } from '@/refactoring/modules/chat/composables/useChatLogic'
import { usePhotoSwipe } from '@/refactoring/modules/chat/composables/usePhotoSwipe'
import 'photoswipe/style.css'

import ChatSidebar from './ChatSidebar.vue'
import ChatHeader from './ChatHeader.vue'
import ChatInput from './ChatInput.vue'
import MessageItem from './MessageItem.vue'
import MessagesSkeletonGroup from './MessagesSkeletonGroup.vue'
import ChatCreateDialog from './ChatCreateDialog.vue'
import InviteUsersDialog from './InviteUsersDialog.vue'
import ChatMembersManagement from './ChatMembersManagement.vue'
import MembersListModal from './MembersListModal.vue'
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

// Инициализация галереи изображений
usePhotoSwipe({
    gallery: '#chat-messages',
    children: 'a.attachment-image-link, .attachments-only .img-wrap',
})

// Состояние компонента
const showCreate = ref(false)
const showInviteDialog = ref(false)
const showManageDialog = ref(false)
const showMembersDialog = ref(false)

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
    createChat: createChatBase,
    inviteUsersToChat,
    changeReaction,
    removeMyReaction,
    acceptInvitation,
    declineInvitation,
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
    addMembersImmediately: boolean
    selectedUsers: Array<{
        id: string
        full_name: string
        position: string | null
        department: { id: string; name: string } | null
    }>
}) => {
    try {
        const result = await createChatBase(payload)
        showCreate.value = false

        // Если есть выбранные пользователи, приглашаем их сразу после создания чата
        if (payload.addMembersImmediately && payload.selectedUsers.length > 0) {
            // Небольшая задержка чтобы чат успел загрузиться
            setTimeout(async () => {
                const userIds = payload.selectedUsers.map(user => user.id)
                await inviteUsersToChat(userIds)
            }, 300)
        } else if (payload.addMembersImmediately) {
            // Если включена опция, но пользователи не выбраны, открываем диалог приглашения
            setTimeout(() => {
                showInviteDialog.value = true
            }, 300)
        }
    } catch (error) {
        // Ошибка обрабатывается в композабле
    }
}

const inviteUsers = async (userIds: string[]) => {
    await inviteUsersToChat(userIds)
    showInviteDialog.value = false
}

const onChatUpdated = (updatedChat: IChat) => {
    // Обновляем текущий чат в сторе
    if (chatStore.currentChat?.id === updatedChat.id) {
        chatStore.currentChat = updatedChat
    }

    // Обновляем чат в списке чатов
    const chatIndex = chatStore.chats.findIndex((chat) => chat.id === updatedChat.id)
    if (chatIndex !== -1) {
        chatStore.chats.splice(chatIndex, 1, updatedChat)
    }
}

const onMemberRemoved = async () => {
    // Обновляем данные чата после удаления участника
    if (chatStore.currentChat) {
        try {
            const updatedChat = await chatStore.fetchChat(chatStore.currentChat.id)
            onChatUpdated(updatedChat)
        } catch (error) {
        }
    }
}

// Обработчики для редактирования и удаления сообщений
const editMessage = async (messageId: number) => {
    if (!chatStore.currentChat) return
    
    try {
        // Находим сообщение для редактирования
        const message = chatStore.messages.find(m => m.id === messageId)
        if (!message) return
        
        // Показываем prompt для редактирования
        const newContent = prompt('Редактировать сообщение:', message.content)
        if (newContent === null || newContent.trim() === '') return
        
        // Обновляем сообщение через store
        await chatStore.updateMessage(chatStore.currentChat.id, messageId, newContent.trim())
    } catch (error) {
        // Ошибка обрабатывается в store
    }
}

const deleteMessage = async (messageId: number) => {
    if (!chatStore.currentChat) return
    
    try {
        // Подтверждение удаления
        const confirmed = confirm('Вы уверены, что хотите удалить это сообщение?')
        if (!confirmed) return
        
        // Удаляем сообщение через store
        await chatStore.deleteMessage(chatStore.currentChat.id, messageId)
    } catch (error) {
        // Ошибка обрабатывается в store
    }
}

// Хуки жизненного цикла
onMounted(async () => {
    await initialize()
})

onUnmounted(() => {
    cleanup()
})
</script>

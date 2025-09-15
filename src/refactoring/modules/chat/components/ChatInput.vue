<template>
    <div
        v-if="currentChat"
        class="py-4 border-t border-surface-200 dark:border-surface-800 flex items-center gap-2"
    >
        <textarea
            ref="messageInputRef"
            v-model="draft"
            placeholder="Сообщение ..."
            class="w-full p-inputtextarea p-inputtext chat-textarea !py-2"
            rows="5"
            @keydown.enter="onEnterPress"
            @keydown.ctrl.e.prevent="toggleEmojiPicker"
        ></textarea>

        <input type="file" ref="fileInput" class="hidden" @change="onFileSelect" />

        <!-- Эмодзи пикер -->
        <div class="relative">
            <Button
                ref="emojiBtnRef"
                icon="pi pi-face-smile"
                severity="success"
                text
                @click="toggleEmojiPicker"
            />
            <div
                v-if="showEmojiPicker"
                ref="emojiPanelRef"
                class="absolute bottom-full right-0 mb-2 z-30"
            >
                <EmojiPicker
                    :native="true"
                    @select="onSelectEmoji"
                    :group-names="emojiGroupNamesRu"
                    :static-texts="emojiStaticTextsRu"
                />
            </div>
        </div>

        <Button icon="pi pi-paperclip" text @click="fileInput?.click()" />

        <Button
            :label="isSending ? '...' : 'Отправить'"
            :disabled="isSending || !draft.trim()"
            @click="sendMessage"
        />
    </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import EmojiPicker from 'vue3-emoji-picker'
import 'vue3-emoji-picker/css'
import type { IChat } from '@/refactoring/modules/chat/types/IChat'

interface Props {
    currentChat: IChat | null
    isSending: boolean
}

interface Emits {
    (e: 'send-message', content: string): void
    (e: 'upload-file', file: File): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Состояние компонента
const draft = ref('')
const messageInputRef = ref<HTMLTextAreaElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const showEmojiPicker = ref(false)
const emojiPanelRef = ref<HTMLElement | null>(null)
const emojiBtnRef = ref<HTMLElement | null>(null)

// Локализация эмодзи пикера
const emojiGroupNamesRu = {
    smileys_people: 'Смайлы и люди',
    animals_nature: 'Животные и природа',
    food_drink: 'Еда и напитки',
    activities: 'Активности',
    travel_places: 'Путешествия и места',
    objects: 'Объекты',
    symbols: 'Символы',
    flags: 'Флаги',
} as const

const emojiStaticTextsRu = {
    placeholder: 'Поиск эмодзи',
    skinTone: 'Тон кожи',
} as const

// Функции обработки событий
const onEnterPress = (e: KeyboardEvent) => {
    if (e.shiftKey) {
        // Shift + Enter: новая строка
        return
    }
    // Enter: отправка сообщения
    e.preventDefault()
    sendMessage()
}

const sendMessage = () => {
    if (!draft.value.trim() || props.isSending) return

    emit('send-message', draft.value.trim())
    draft.value = ''
}

const onFileSelect = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return

    emit('upload-file', file)

    // Очищаем input
    if (fileInput.value) {
        fileInput.value.value = ''
    }
}

// Логика эмодзи пикера
const toggleEmojiPicker = () => {
    showEmojiPicker.value = !showEmojiPicker.value
}

const onSelectEmoji = (emoji: any) => {
    const char = emoji?.i || emoji?.native || ''
    if (!char) return

    insertTextAtCursor(char)
    showEmojiPicker.value = false
}

const insertTextAtCursor = (text: string) => {
    const el = messageInputRef.value
    if (!el) {
        draft.value += text
        return
    }

    const start = el.selectionStart ?? draft.value.length
    const end = el.selectionEnd ?? draft.value.length
    const before = draft.value.slice(0, start)
    const after = draft.value.slice(end)

    draft.value = `${before}${text}${after}`
    const newPos = start + text.length

    nextTick(() => {
        el.focus()
        el.selectionStart = el.selectionEnd = newPos
    })
}

// Закрытие эмодзи пикера при клике вне
const onDocumentClickForEmoji = (e: MouseEvent) => {
    if (!showEmojiPicker.value) return

    const target = e.target as Node
    const panel = emojiPanelRef.value
    const btn = emojiBtnRef.value

    if (panel && panel.contains(target)) return

    const btnElement = (btn as { $el?: HTMLElement })?.$el || (btn as HTMLElement)
    if (btnElement && btnElement.contains && btnElement.contains(target)) return

    showEmojiPicker.value = false
}

onMounted(() => {
    document.addEventListener('click', onDocumentClickForEmoji, { passive: true })
})

onUnmounted(() => {
    document.removeEventListener('click', onDocumentClickForEmoji)
})
</script>



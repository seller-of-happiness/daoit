<template>
    <div
        v-if="currentChat"
        class="py-4 border-t border-surface-200 dark:border-surface-800 flex flex-col gap-2"
    >
        <!-- Предварительный просмотр прикрепленных файлов -->
        <div v-if="attachedFiles.length > 0" class="flex flex-wrap gap-3 px-2">
            <div
                v-for="(file, index) in attachedFiles"
                :key="index"
                class="relative group"
            >
                <!-- Изображения: показываем миниатюру -->
                <div
                    v-if="isImageFile(file)"
                    class="relative w-20 h-20 rounded-lg overflow-hidden bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700"
                >
                    <img
                        :src="getFilePreviewUrl(file)"
                        :alt="file.name"
                        class="w-full h-full object-cover"
                        @error="onImageError"
                    />
                    <!-- Кнопка удаления для изображений -->
                    <Button
                        icon="pi pi-times"
                        severity="danger"
                        text
                        size="small"
                        class="!absolute !top-1 !right-1 !p-1 !w-6 !h-6 !bg-black/50 !text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        @click="removeAttachedFile(index)"
                    />
                    <!-- Название файла под миниатюрой -->
                    <div class="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs px-1 py-0.5 truncate">
                        {{ file.name }}
                    </div>
                </div>

                <!-- Обычные файлы: показываем иконку и название -->
                <div
                    v-else
                    class="flex items-center gap-2 bg-surface-100 dark:bg-surface-800 rounded-lg px-3 py-2 text-sm min-w-[200px] max-w-[300px] border border-surface-200 dark:border-surface-700"
                >
                    <i :class="getFileIcon(file)" class="text-primary text-lg"></i>
                    <div class="flex-1 min-w-0">
                        <div class="truncate font-medium">{{ file.name }}</div>
                        <div class="text-xs text-surface-500">{{ formatFileSize(file.size) }}</div>
                    </div>
                    <Button
                        icon="pi pi-times"
                        text
                        size="small"
                        class="!p-1 !w-6 !h-6 opacity-70 hover:opacity-100"
                        @click="removeAttachedFile(index)"
                    />
                </div>
            </div>
        </div>

        <div class="flex items-center gap-2">
            <textarea
                ref="messageInputRef"
                v-model="draft"
                placeholder="Сообщение ..."
                class="w-full p-inputtextarea p-inputtext chat-textarea !py-2"
                rows="5"
                @keydown.enter="onEnterPress"
                @keydown.ctrl.e.prevent="toggleEmojiPicker"
            ></textarea>

            <input
                type="file"
                ref="fileInput"
                class="hidden"
                multiple
                @change="onFileSelect"
            />

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
                :disabled="isSending || (!draft.trim() && attachedFiles.length === 0)"
                @click="sendMessage"
            />
        </div>
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
    (e: 'send-message', content: string, files?: File[]): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Состояние компонента
const draft = ref('')
const attachedFiles = ref<File[]>([])
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
    if ((!draft.value.trim() && attachedFiles.value.length === 0) || props.isSending) return

    emit('send-message', draft.value.trim(), attachedFiles.value.length > 0 ? attachedFiles.value : undefined)
    draft.value = ''
    attachedFiles.value = []
}

const onFileSelect = (e: Event) => {
    const files = (e.target as HTMLInputElement).files
    if (!files || files.length === 0) return

    // Добавляем все выбранные файлы к уже прикрепленным
    for (let i = 0; i < files.length; i++) {
        attachedFiles.value.push(files[i])
    }

    // Очищаем input для возможности повторного выбора тех же файлов
    if (fileInput.value) {
        fileInput.value.value = ''
    }
}

const removeAttachedFile = (index: number) => {
    attachedFiles.value.splice(index, 1)
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

// Вспомогательные функции для работы с файлами
const isImageFile = (file: File): boolean => {
    return file.type.startsWith('image/')
}

const getFilePreviewUrl = (file: File): string => {
    return URL.createObjectURL(file)
}

const onImageError = (event: Event) => {
    // Если изображение не удалось загрузить, скрываем его
    const img = event.target as HTMLImageElement
    img.style.display = 'none'
}

const getFileIcon = (file: File): string => {
    const type = file.type.toLowerCase()
    
    if (type.includes('pdf')) return 'pi pi-file-pdf'
    if (type.includes('word') || type.includes('msword') || type.includes('wordprocessingml')) return 'pi pi-file-word'
    if (type.includes('excel') || type.includes('spreadsheetml')) return 'pi pi-file-excel'
    if (type.includes('powerpoint') || type.includes('presentationml')) return 'pi pi-file-powerpoint'
    if (type.includes('zip') || type.includes('rar') || type.includes('7z')) return 'pi pi-file-archive'
    if (type.includes('video')) return 'pi pi-video'
    if (type.includes('audio')) return 'pi pi-volume-up'
    if (type.includes('text')) return 'pi pi-file-text'
    
    return 'pi pi-file'
}

const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
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



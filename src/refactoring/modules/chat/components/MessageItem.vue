<template>
    <div
        :class="['message mb-6', isMine ? 'message--mine' : 'message--theirs']"
        :data-dir="isMine ? 'out' : 'in'"
        @mouseenter="onMessageEnter"
        @mouseleave="onMessageLeave"
    >
        <!-- Сообщение с текстом -->
        <div class="message-wrapper" v-if="hasTextContent">
            <div class="message-bubble">
                <div class="message-content py-4 px-4 flex justify-between items-end">
                    <div class="content-left">
                        <div class="text" v-html="safeContent"></div>
                        <MessageReactionsBar
                            v-if="reactions.groupedReactions.value.length"
                            :groups="reactions.groupedReactions.value"
                        />
                    </div>
                    <span class="time inline-block ml-4 text-sm text-gray-500 italic time-fixed">
                        {{ formatDateTime(message.created_at) }}
                    </span>
                </div>

                <!-- Триггер реакции при наведении -->
                <button
                    ref="triggerRef"
                    :class="['reaction-trigger', { active: reactions.hasMyReaction }]"
                    type="button"
                    aria-label="Добавить реакцию"
                    v-show="showTrigger"
                    @mouseenter="onTriggerEnter"
                    @mouseleave="onTriggerLeave"
                    @click.stop="onTriggerClick"
                >
                    <i class="pi pi-thumbs-up" />
                </button>
            </div>

            <!-- Панель реакций -->
            <transition name="reaction-pop">
                <div v-if="showPicker" class="reaction-anchor" :style="anchorStyle">
                    <div
                        ref="pickerRef"
                        class="reaction-picker"
                        :style="pickerStyle"
                        @click.stop
                        @mouseenter="onPickerEnter"
                        @mouseleave="onPickerLeave"
                        aria-live="polite"
                    >
                        <button
                            v-for="r in reactions.menuReactions.value"
                            :key="r.id"
                            class="reaction-btn"
                            @click.stop="selectReaction(r)"
                            v-app-tooltip="r.name"
                            :aria-label="r.name"
                            type="button"
                        >
                            <span v-if="!isThumbReaction(r)" class="emoji">
                                {{ getReactionEmoji(r) }}
                            </span>
                            <i v-else class="pi pi-thumbs-up" />
                        </button>
                    </div>
                </div>
            </transition>

            <!-- Вложения -->
            <div
                class="message-attachments mb-6 flex justify-end"
                v-if="hasTextContent && message.attachments?.length"
            >
                <div v-for="a in message.attachments" :key="a.id" class="attachment">
                    <template v-if="isImage(a.file)">
                        <a
                            class="attachment-image-link"
                            :href="withBase(a.file)"
                            target="_blank"
                            rel="noopener"
                            :data-pswp-src="withBase(a.file)"
                        >
                            <img
                                :src="withBase(a.file)"
                                alt="attachment"
                                class="attachment-image"
                                @load="onImageLoadSetDims"
                            />
                        </a>
                        <a
                            class="attachment-download"
                            :href="withBase(a.file)"
                            :download="deriveFileName(a.file)"
                        >
                            <i class="pi pi-download" />
                            <span>Скачать</span>
                        </a>
                    </template>
                    <template v-else>
                        <a :href="withBase(a.file)" target="_blank" class="file-pill">
                            <i class="pi pi-paperclip" />
                            <span>{{ nonImageLabel(a.file) }}</span>
                        </a>
                    </template>
                    <MessageReactionsBar
                        v-if="isImage(a.file) && reactions.groupedReactions.value.length"
                        :groups="reactions.groupedReactions.value"
                    />
                </div>
            </div>
        </div>

        <!-- Сообщение только с вложениями (без текста) -->
        <div v-if="isAttachmentOnly" class="attachments-only">
            <template v-for="a in message.attachments" :key="a.id">
                <!-- Картинки: показываем полноразмерно с временем внизу справа -->
                <div v-if="isImage(a.file)" class="attachment-image-only mb-6">
                    <a
                        :href="withBase(a.file)"
                        target="_blank"
                        rel="noopener"
                        class="img-wrap"
                        :data-pswp-src="withBase(a.file)"
                    >
                        <img :src="withBase(a.file)" alt="attachment" @load="onImageLoadSetDims" />
                        <span class="time-badge">
                            {{ shortTime }}
                        </span>
                    </a>
                    <MessageReactionsBar
                        v-if="reactions.groupedReactions.value.length"
                        :groups="reactions.groupedReactions.value"
                    />
                </div>

                <!-- Файлы: оборачиваем в тот же пузырь, что и обычные сообщения -->
                <div v-else class="message-bubble">
                    <div class="message-content py-4 px-4 flex justify-between items-end">
                        <div class="content-left">
                            <FileAttachmentCard
                                :href="withBase(a.file)"
                                :name="nonImageLabel(a.file)"
                                :time="shortTime"
                                :mine="isMine"
                            />
                            <MessageReactionsBar
                                v-if="reactions.groupedReactions.value.length"
                                :groups="reactions.groupedReactions.value"
                            />
                        </div>
                    </div>

                    <!-- Триггер реакции при наведении как у обычного сообщения -->
                    <button
                        ref="triggerRef"
                        :class="['reaction-trigger', { active: reactions.hasMyReaction }]"
                        type="button"
                        aria-label="Добавить реакцию"
                        v-show="showTrigger"
                        @mouseenter="onTriggerEnter"
                        @mouseleave="onTriggerLeave"
                        @click.stop="onTriggerClick"
                    >
                        <i class="pi pi-thumbs-up" />
                    </button>
                </div>
            </template>

            <!-- Триггер реакции рядом с вложениями при наведении -->
            <button
                ref="triggerRef"
                :class="['reaction-trigger', { active: reactions.hasMyReaction }]"
                type="button"
                aria-label="Добавить реакцию"
                v-show="showTrigger"
                @mouseenter="onTriggerEnter"
                @mouseleave="onTriggerLeave"
                @click.stop="onTriggerClick"
            >
                <i class="pi pi-thumbs-up" />
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'
import MessageReactionsBar from './MessageReactionsBar.vue'
import FileAttachmentCard from './FileAttachmentCard.vue'
import { formatDateTime } from '@/refactoring/utils/formatters'
import { BASE_URL } from '@/refactoring/environment/environment'
import { useCurrentUser, isMyMessage } from '@/refactoring/modules/chat/composables/useCurrentUser'
import {
    useReactions,
    getReactionEmoji,
    isThumbReaction,
} from '@/refactoring/modules/chat/composables/useReactions'
import { setImageDimensions } from '@/refactoring/modules/chat/composables/usePhotoSwipe'
import type { IMessage, IReactionType } from '@/refactoring/modules/chat/types/IChat'

const props = defineProps<{
    message: IMessage
    reactionTypes: IReactionType[]
    currentUserId?: string | number | null
    currentUserName?: string | null
    chatMembers?: Array<{ user: string; user_name: string; user_uuid?: string }>
}>()

const emit = defineEmits<{
    (
        e: 'change-reaction',
        messageId: number,
        reactionId: number,
        prevReactionId: number | null,
    ): void
    (e: 'remove-my-reaction', messageId: number, reactionId: number | null): void
}>()

// Композаблы
const currentUser = useCurrentUser()
const reactions = useReactions(
    props.message,
    props.currentUserId?.toString() || currentUser.id.value,
    props.reactionTypes,
    props.chatMembers,
)

// Состояние компонента
const showPicker = ref(false)
const pickerRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLElement | null>(null)
const pickerStyle = ref<Record<string, string>>({})
const anchorStyle = ref<Record<string, string>>({})

// Логика взаимодействия с триггером реакций
const isHoverTrigger = ref(false)
const isHoverPicker = ref(false)
const isHoverMessage = ref(false)
const showTrigger = ref(false)

let hideTimeoutId: number | null = null

const HIDE_DELAY_MS = 700

// Вычисляемые свойства
const withBase = (path: string | null) => {
    if (!path) return ''
    if (path.startsWith('http')) return path
    return `${BASE_URL}${path}`
}

const isMine = computed(() => {
    const result = isMyMessage(
        props.message,
        props.currentUserId?.toString() || currentUser.id.value,
        props.currentUserName || currentUser.name.value,
    )

    return result
})

const safeContent = computed(() => (props.message.content || '').replace(/\n/g, '<br/>'))

const hasTextContent = computed(() => !!String(props.message?.content || '').trim())

const isAttachmentOnly = computed(
    () => !hasTextContent.value && (props.message?.attachments?.length || 0) > 0,
)

const shortTime = computed(() => {
    const fullTime = formatDateTime(props.message.created_at)
    return fullTime.split(' ')[1] || fullTime
})

// Вспомогательные функции
function isImage(path: string | null): boolean {
    if (!path) return false
    const lower = path.split('?')[0].toLowerCase()
    return /(\.png|\.jpg|\.jpeg|\.gif|\.webp|\.bmp|\.svg|\.avif)$/.test(lower)
}

function deriveFileName(path: string | null): string {
    if (!path) return 'file'
    try {
        const clean = path.split('?')[0]
        const name = clean.split('/').pop() || 'file'
        return name
    } catch {
        return 'file'
    }
}

function nonImageLabel(path: string | null): string {
    const name = deriveFileName(path)
    const parts = name.split('.')
    if (parts.length >= 2) {
        const ext = parts.pop() || ''
        const base = parts.join('.')
        return `${base}.${ext}`
    }
    return name
}

// Использование функции из композабла
const onImageLoadSetDims = setImageDimensions

// Логика панели реакций
function openPicker(e: MouseEvent) {
    if (showPicker.value) {
        closePicker()
        return
    }
    anchorStyle.value = { position: 'fixed', left: `${e.clientX}px`, top: `${e.clientY}px` }
    pickerStyle.value = { transform: 'translateX(-50%) translateY(0)' }
    showPicker.value = true
    void nextTick(adjustPickerWithinViewport)
}

function openPickerFromTrigger() {
    const el = triggerRef.value
    if (!el) return
    const rect = el.getBoundingClientRect()
    anchorStyle.value = {
        position: 'fixed',
        left: `${rect.left + rect.width / 2}px`,
        top: `${Math.max(0, rect.top - 64)}px`,
    }
    pickerStyle.value = { transform: 'translateX(-50%) translateY(0)' }
    showPicker.value = true
    void nextTick(adjustPickerWithinViewport)
}

function closePicker() {
    showPicker.value = false
}

function adjustPickerWithinViewport() {
    const el = pickerRef.value
    if (!el) return

    const rect = el.getBoundingClientRect()
    const vw = window.innerWidth || document.documentElement.clientWidth
    const vh = window.innerHeight || document.documentElement.clientHeight
    const margin = 8
    const currentLeft = parseFloat(String(anchorStyle.value.left || '0'))
    const currentTop = parseFloat(String(anchorStyle.value.top || '0'))

    const halfWidth = rect.width / 2
    let clampedLeft = currentLeft
    const minCenter = margin + halfWidth
    const maxCenter = vw - margin - halfWidth
    if (clampedLeft < minCenter) clampedLeft = minCenter
    if (clampedLeft > maxCenter) clampedLeft = maxCenter

    let clampedTop = currentTop
    const minTop = margin
    const maxTop = vh - margin - rect.height
    if (clampedTop < minTop) clampedTop = minTop
    if (clampedTop > maxTop) clampedTop = Math.max(minTop, maxTop)

    anchorStyle.value = {
        position: 'fixed',
        left: `${clampedLeft}px`,
        top: `${clampedTop}px`,
    }
}

function selectReaction(r: IReactionType) {
    closePicker()

    const user = {
        id: props.currentUserId || currentUser.id.value || 'me',
        user_name: props.currentUserName || currentUser.name.value || 'Я',
        avatar: null,
    }

    // Сохраняем предыдущее значение реакции ДО изменения оптимистичного состояния
    const prevReactionId = reactions.myReactionId.value

    reactions.clearOptimisticForMe()
    reactions.addOptimisticReaction(r.id, r.name, r.icon, user)

    if (String(r.id) !== String(-1)) {
        emit('change-reaction', props.message.id, r.id, prevReactionId)
    }
}

// Обработчики взаимодействия
function cancelHide() {
    if (hideTimeoutId) {
        window.clearTimeout(hideTimeoutId)
        hideTimeoutId = null
    }
}

function scheduleHide() {
    cancelHide()
    hideTimeoutId = window.setTimeout(() => {
        if (!isHoverTrigger.value && !isHoverPicker.value) {
            closePicker()
        }
    }, HIDE_DELAY_MS)
}

function onTriggerEnter() {
    isHoverTrigger.value = true
    cancelHide()
    // Убираем задержку - мгновенное открытие меню
    openPickerFromTrigger()
}

function onTriggerLeave() {
    isHoverTrigger.value = false
    scheduleHide()
}

function onPickerEnter() {
    isHoverPicker.value = true
    cancelHide()
}

function onPickerLeave() {
    isHoverPicker.value = false
    scheduleHide()
}

function onMessageEnter() {
    isHoverMessage.value = true
    showTrigger.value = true
}

function onMessageLeave() {
    isHoverMessage.value = false
    if (!isHoverTrigger.value && !isHoverPicker.value) {
        showTrigger.value = false
    }
}

function onTriggerClick() {
    if (reactions.hasMyReaction.value) {
        // Сохраняем ID реакции до очистки оптимистичного состояния
        const prevReactionId = reactions.myReactionId.value
        reactions.clearOptimisticForMe()
        emit('remove-my-reaction', props.message.id, prevReactionId)
        closePicker()
        showTrigger.value = false
        isHoverTrigger.value = false
        isHoverMessage.value = false
        return
    }

    openPickerFromTrigger()
}
</script>

<style scoped lang="scss">
@use '../styles/MessageItem.scss' as *;
</style>

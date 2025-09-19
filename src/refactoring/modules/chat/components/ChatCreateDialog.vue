<template>
    <Dialog
        :visible="visible"
        header="Создать чат"
        :modal="true"
        :style="{ width: '520px' }"
        :appendTo="'body'"
        :baseZIndex="9995"
        class="sliding-chat-modal"
        @update:visible="$emit('update:visible', $event)"
    >
        <div class="space-y-4">
            <!-- Тип чата -->
            <div>
                <div class="label">Тип чата</div>
                <div class="flex items-center gap-3">
                    <Button
                        :severity="chatType === 'group' ? 'primary' : 'secondary'"
                        :text="chatType !== 'group'"
                        @click="chatType = 'group'"
                        class="flex-1"
                    >
                        <i class="pi pi-users mr-2" />
                        <div class="text-left">
                            <div class="font-semibold">Группа</div>
                            <div class="text-xs opacity-75">Для командной работы и обсуждений</div>
                        </div>
                    </Button>
                    <Button
                        :severity="chatType === 'channel' ? 'primary' : 'secondary'"
                        :text="chatType !== 'channel'"
                        @click="chatType = 'channel'"
                        class="flex-1"
                    >
                        <i class="pi pi-megaphone mr-2" />
                        <div class="text-left">
                            <div class="font-semibold">Канал</div>
                            <div class="text-xs opacity-75">Для объявлений и новостей</div>
                        </div>
                    </Button>
                </div>
            </div>

            <!-- Название -->
            <div>
                <div class="label">
                    Название
                    <span class="text-red-500">*</span>
                </div>
                <app-inputtext
                    v-model="chatTitle"
                    :placeholder="chatType === 'group' ? 'Название группы' : 'Название канала'"
                    class="w-full"
                    :class="{ 'p-invalid': titleError }"
                />
                <small v-if="titleError" class="p-error">{{ titleError }}</small>
            </div>

            <!-- Описание -->
            <div>
                <div class="label">Описание</div>
                <textarea
                    v-model="chatDescription"
                    rows="3"
                    class="p-inputtext p-inputtextarea w-full"
                    :placeholder="
                        chatType === 'group' ? 'Краткое описание группы' : 'Краткое описание канала'
                    "
                ></textarea>
                <small class="text-surface-500 text-xs">Необязательное поле</small>
            </div>

            <!-- Иконка -->
            <div>
                <div class="label">Иконка</div>
                <div class="flex items-center gap-3">
                    <div v-if="iconPreview" class="icon-preview">
                        <img :src="iconPreview" alt="icon" />
                        <Button
                            icon="pi pi-times"
                            size="small"
                            severity="danger"
                            text
                            rounded
                            class="remove-icon-btn"
                            @click="removeIcon"
                            v-tooltip.top="'Удалить иконку'"
                        />
                    </div>
                    <div v-else class="icon-placeholder">
                        <i class="pi pi-image text-2xl text-surface-400"></i>
                    </div>

                    <div class="flex flex-col gap-2">
                        <Button
                            icon="pi pi-upload"
                            label="Выбрать файл"
                            severity="secondary"
                            outlined
                            size="small"
                            @click="$refs.fileInput?.click()"
                        />
                        <small class="text-surface-500 text-xs">
                            Поддерживаются: JPG, PNG, GIF (макс. 5 МБ)
                        </small>
                    </div>

                    <input
                        ref="fileInput"
                        type="file"
                        accept="image/*"
                        class="hidden"
                        @change="onIconSelect"
                    />
                </div>
            </div>

            <!-- Дополнительные настройки -->
            <div class="bg-surface-50 dark:bg-surface-800 p-3 rounded-md">
                <div class="flex items-center justify-between mb-2">
                    <label class="font-medium text-sm">Дополнительные настройки</label>
                </div>

                <!-- Добавить участников сразу -->
                <div class="flex items-center gap-2 mb-2">
                    <Checkbox v-model="addMembersImmediately" binary />
                    <label
                        class="text-sm cursor-pointer"
                        @click="addMembersImmediately = !addMembersImmediately"
                    >
                        Пригласить участников после создания
                    </label>
                </div>

                <small class="text-surface-500 text-xs">
                    Если включено, после создания {{ chatType === 'group' ? 'группы' : 'канала' }}
                    откроется окно приглашения участников.
                </small>
            </div>

            <!-- Кнопки -->
            <div class="flex justify-end gap-2 pt-2">
                <Button
                    label="Отмена"
                    severity="secondary"
                    text
                    @click="closeDialog"
                    :disabled="isCreating"
                />
                <Button
                    :label="createButtonLabel"
                    :disabled="!canSave || isCreating"
                    :loading="isCreating"
                    @click="createChat"
                />
            </div>
        </div>
    </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

interface Props {
    visible: boolean
}

interface Emits {
    (e: 'update:visible', visible: boolean): void
    (
        e: 'create',
        payload: {
            type: 'group' | 'channel'
            title: string
            description: string
            icon: File | null
            addMembersImmediately: boolean
        },
    ): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Ссылки на элементы
const fileInput = ref<HTMLInputElement | null>(null)

// Состояние формы
const chatType = ref<'group' | 'channel'>('group')
const chatTitle = ref('')
const chatDescription = ref('')
const iconFile = ref<File | null>(null)
const iconPreview = ref<string | null>(null)
const addMembersImmediately = ref(false)
const isCreating = ref(false)

// Валидация
const titleError = computed(() => {
    if (!chatTitle.value.trim()) {
        return 'Название обязательно для заполнения'
    }
    if (chatTitle.value.trim().length < 2) {
        return 'Название должно содержать минимум 2 символа'
    }
    if (chatTitle.value.trim().length > 100) {
        return 'Название не может быть длиннее 100 символов'
    }
    return null
})

const canSave = computed(() => {
    return !!chatTitle.value.trim() && !titleError.value && !isCreating.value
})

const createButtonLabel = computed(() => {
    if (isCreating.value) {
        return chatType.value === 'group' ? 'Создание группы...' : 'Создание канала...'
    }
    return chatType.value === 'group' ? 'Создать группу' : 'Создать канал'
})

// Обработчики событий
const onIconSelect = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0] || null

    if (file) {
        // Проверяем размер файла (5 МБ)
        if (file.size > 5 * 1024 * 1024) {
            alert('Размер файла не должен превышать 5 МБ')
            return
        }

        // Проверяем тип файла
        if (!file.type.startsWith('image/')) {
            alert('Можно загружать только изображения')
            return
        }

        iconFile.value = file

        // Создаем превью
        const reader = new FileReader()
        reader.onload = () => {
            iconPreview.value = String(reader.result || '')
        }
        reader.readAsDataURL(file)
    } else {
        removeIcon()
    }

    // Очищаем input
    if (fileInput.value) {
        fileInput.value.value = ''
    }
}

const removeIcon = () => {
    iconFile.value = null
    iconPreview.value = null
    if (fileInput.value) {
        fileInput.value.value = ''
    }
}

const createChat = async () => {
    if (!canSave.value) return

    isCreating.value = true

    try {
        emit('create', {
            type: chatType.value,
            title: chatTitle.value.trim(),
            description: chatDescription.value.trim(),
            icon: iconFile.value,
            addMembersImmediately: addMembersImmediately.value,
        })

        closeDialog()
    } catch (error) {
        // Ошибка обрабатывается в родительском компоненте
    } finally {
        isCreating.value = false
    }
}

const closeDialog = () => {
    emit('update:visible', false)
    resetForm()
}

const resetForm = () => {
    chatType.value = 'group'
    chatTitle.value = ''
    chatDescription.value = ''
    iconFile.value = null
    iconPreview.value = null
    addMembersImmediately.value = false
    isCreating.value = false
}

// Сброс формы при закрытии диалога
watch(
    () => props.visible,
    (visible) => {
        if (!visible) {
            resetForm()
        }
    },
)

// Сброс ошибок при изменении названия
watch(chatTitle, () => {
    // Автоматически убираем ошибки при вводе корректного значения
})
</script>

<style scoped>
.icon-preview {
    position: relative;
    width: 64px;
    height: 64px;
    border-radius: 8px;
    overflow: hidden;
    border: 2px solid var(--p-content-border-color);
    flex-shrink: 0;
}

.icon-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.remove-icon-btn {
    position: absolute;
    top: -8px;
    right: -8px;
    width: 24px !important;
    height: 24px !important;
    min-width: 24px !important;
}

.icon-placeholder {
    width: 64px;
    height: 64px;
    border: 2px dashed var(--p-surface-300);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--p-surface-100);
    flex-shrink: 0;
}

.space-y-4 > * + * {
    margin-top: 1rem;
}

.label {
    font-weight: 600;
    color: var(--p-surface-900);
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
}

:global(.dark) .label {
    color: var(--p-surface-0);
}

:global(.dark) .icon-placeholder {
    background: var(--p-surface-800);
    border-color: var(--p-surface-600);
}

/* Улучшенные стили для кнопок выбора типа */
.flex.items-center.gap-3 .p-button {
    padding: 1rem;
    border-radius: 8px;
    text-align: left;
    justify-content: flex-start;
    min-height: 80px;
    transition: all 0.2s ease;
}

.flex.items-center.gap-3 .p-button:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.flex.items-center.gap-3 .p-button.p-button-primary {
    background: var(--p-primary-color);
    border-color: var(--p-primary-color);
}

.flex.items-center.gap-3 .p-button .pi {
    font-size: 1.25rem;
}

/* Стили для чекбокса */
.p-checkbox {
    flex-shrink: 0;
}

/* Адаптивные стили */
@media (max-width: 640px) {
    .flex.items-center.gap-3 {
        flex-direction: column;
        gap: 0.75rem;
    }

    .flex.items-center.gap-3 .p-button {
        width: 100%;
        min-height: 60px;
        padding: 0.75rem;
    }

    .icon-preview,
    .icon-placeholder {
        width: 48px;
        height: 48px;
    }
}
</style>

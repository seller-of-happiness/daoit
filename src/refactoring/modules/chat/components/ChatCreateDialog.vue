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
                <div class="label">Тип</div>
                <div class="flex items-center gap-3">
                    <Button
                        :severity="chatType === 'channel' ? 'primary' : 'secondary'"
                        :text="chatType !== 'channel'"
                        @click="chatType = 'channel'"
                    >
                        <i class="pi pi-megaphone mr-2" /> Канал
                    </Button>
                    <Button
                        :severity="chatType === 'group' ? 'primary' : 'secondary'"
                        :text="chatType !== 'group'"
                        @click="chatType = 'group'"
                    >
                        <i class="pi pi-users mr-2" /> Группа
                    </Button>
                </div>
            </div>

            <!-- Название -->
            <div>
                <div class="label">Название</div>
                <app-inputtext v-model="chatTitle" placeholder="Введите название" class="w-full" />
            </div>

            <!-- Описание -->
            <div>
                <div class="label">Описание</div>
                <textarea
                    v-model="chatDescription"
                    rows="3"
                    class="p-inputtext p-inputtextarea w-full"
                    placeholder="Краткое описание"
                ></textarea>
            </div>

            <!-- Иконка -->
            <div>
                <div class="label">Иконка</div>
                <div class="flex items-center gap-3">
                    <div v-if="iconPreview" class="icon-preview">
                        <img :src="iconPreview" alt="icon" />
                    </div>
                    <input type="file" accept="image/*" @change="onIconSelect" />
                </div>
            </div>

            <!-- Кнопки -->
            <div class="flex justify-end gap-2 pt-2">
                <Button label="Отмена" severity="secondary" text @click="closeDialog" />
                <Button label="Сохранить" :disabled="!canSave" @click="createChat" />
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
        },
    ): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Состояние формы
const chatType = ref<'group' | 'channel'>('channel')
const chatTitle = ref('')
const chatDescription = ref('')
const iconFile = ref<File | null>(null)
const iconPreview = ref<string | null>(null)

// Валидация формы
const canSave = computed(() => !!chatTitle.value.trim())

// Обработчики событий
const onIconSelect = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0] || null
    iconFile.value = file

    if (file) {
        const reader = new FileReader()
        reader.onload = () => {
            iconPreview.value = String(reader.result || '')
        }
        reader.readAsDataURL(file)
    } else {
        iconPreview.value = null
    }
}

const createChat = () => {
    if (!canSave.value) return

    emit('create', {
        type: chatType.value,
        title: chatTitle.value.trim(),
        description: chatDescription.value.trim(),
        icon: iconFile.value,
    })

    closeDialog()
}

const closeDialog = () => {
    emit('update:visible', false)
    resetForm()
}

const resetForm = () => {
    chatType.value = 'channel'
    chatTitle.value = ''
    chatDescription.value = ''
    iconFile.value = null
    iconPreview.value = null
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
</script>

<style scoped>


.icon-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.space-y-4 > * + * {
    margin-top: 1rem;
}

</style>

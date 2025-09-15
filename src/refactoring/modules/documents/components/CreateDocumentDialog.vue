<template>
    <Dialog
        v-model:visible="dialogVisible"
        modal
        header="Загрузить документ"
        :style="{ width: '500px' }"
        @hide="resetForm"
    >
        <form @submit.prevent="handleSubmit" class="create-document-form">
            <div class="form-field">
                <label for="documentFile" class="field-label required">Файл</label>
                <div class="file-upload-area">
                    <FileUpload
                        ref="fileUpload"
                        mode="basic"
                        :auto="false"
                        :choose-label="selectedFile ? 'Изменить файл' : 'Выбрать файл'"
                        :show-upload-button="false"
                        :show-cancel-button="false"
                        accept=".pdf,.doc,.docx,.txt,.jpg,.png,.zip,.rar"
                        :max-file-size="100000000"
                        @select="onFileSelect"
                        @clear="onFileClear"
                        class="w-full"
                    />
                    <div v-if="selectedFile" class="selected-file-info">
                        <div class="file-info">
                            <i :class="getFileIcon(selectedFile.name)" class="file-icon"></i>
                            <div class="file-details">
                                <div class="file-name">{{ selectedFile.name }}</div>
                                <div class="file-size">{{ formatFileSize(selectedFile.size) }}</div>
                            </div>
                        </div>
                    </div>
                </div>
                <small v-if="errors.file" class="p-error">{{ errors.file }}</small>
            </div>

            <div class="form-field">
                <label for="documentName" class="field-label required">Название документа</label>
                <InputText
                    id="documentName"
                    v-model="form.name"
                    :class="{ 'p-invalid': errors.name }"
                    placeholder="Введите название документа"
                    class="w-full"
                />
                <small v-if="errors.name" class="p-error">{{ errors.name }}</small>
            </div>

            <div class="form-field">
                <label for="documentDescription" class="field-label">Описание</label>
                <Textarea
                    id="documentDescription"
                    v-model="form.description"
                    placeholder="Введите описание документа (необязательно)"
                    rows="3"
                    class="w-full"
                />
            </div>

            <div class="form-field">
                <label for="documentType" class="field-label">Тип документа</label>
                <Dropdown
                    id="documentType"
                    v-model="form.type_id"
                    :options="documentTypes"
                    option-label="name"
                    option-value="id"
                    placeholder="Выберите тип документа (необязательно)"
                    class="w-full"
                    show-clear
                />
            </div>

            <div class="form-field">
                <label for="documentVisibility" class="field-label required">Видимость</label>
                <Dropdown
                    id="documentVisibility"
                    v-model="form.visibility"
                    :options="visibilityOptions"
                    option-label="label"
                    option-value="value"
                    placeholder="Выберите уровень видимости"
                    class="w-full"
                />
                <small v-if="errors.visibility" class="p-error">{{ errors.visibility }}</small>
            </div>

            <div class="form-actions">
                <Button
                    type="button"
                    label="Отмена"
                    severity="secondary"
                    @click="dialogVisible = false"
                />
                <Button
                    type="submit"
                    label="Загрузить"
                    :loading="isLoading"
                    :disabled="!isFormValid"
                />
            </div>
        </form>
    </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useDocumentsStore } from '@/refactoring/modules/documents/stores/documentsStore'
import type { IDocumentType } from '@/refactoring/modules/documents/types/IDocument'

interface Props {
    visible: boolean
    documentTypes: IDocumentType[]
}

interface Emits {
    (e: 'update:visible', value: boolean): void
    (e: 'created'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const documentsStore = useDocumentsStore()

// Реактивность диалога
const dialogVisible = computed({
    get: () => props.visible,
    set: (value) => emit('update:visible', value),
})

// Файл
const fileUpload = ref()
const selectedFile = ref<File | null>(null)

// Форма
const form = ref({
    name: '',
    description: '',
    type_id: null as number | null,
    visibility: 'public' as 'public' | 'private' | 'department',
})

const errors = ref({
    file: '',
    name: '',
    visibility: '',
})

const isLoading = ref(false)

// Опции видимости
const visibilityOptions = [
    { label: 'Публичный (доступен всем)', value: 'public' },
    { label: 'Отдел (доступен отделу)', value: 'department' },
    { label: 'Приватный (только мне)', value: 'private' },
]

// Обработчики файлов
const onFileSelect = (event: any) => {
    const file = event.files[0]
    if (file) {
        selectedFile.value = file
        if (!form.value.name.trim()) {
            const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '')
            form.value.name = nameWithoutExt
        }
        errors.value.file = ''
    }
}

const onFileClear = () => {
    selectedFile.value = null
}

// Утилиты
const getFileIcon = (filename: string): string => {
    const ext = filename.toLowerCase().split('.').pop() || ''

    const iconMap: Record<string, string> = {
        pdf: 'pi pi-file-pdf',
        doc: 'pi pi-file-word',
        docx: 'pi pi-file-word',
        xls: 'pi pi-file-excel',
        xlsx: 'pi pi-file-excel',
        csv: 'pi pi-file-excel',
        jpg: 'pi pi-image',
        jpeg: 'pi pi-image',
        png: 'pi pi-image',
        gif: 'pi pi-image',
        webp: 'pi pi-image',
        svg: 'pi pi-image',
        zip: 'pi pi-box',
        rar: 'pi pi-box',
        '7z': 'pi pi-box',
        mp4: 'pi pi-video',
        mov: 'pi pi-video',
        avi: 'pi pi-video',
        mkv: 'pi pi-video',
        mp3: 'pi pi-volume-up',
        wav: 'pi pi-volume-up',
        ogg: 'pi pi-volume-up',
    }

    return iconMap[ext] || 'pi pi-file'
}

const formatFileSize = (bytes: number): string => {
    const units = ['Б', 'КБ', 'МБ', 'ГБ']
    let size = bytes
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024
        unitIndex++
    }

    return `${Math.round(size * 10) / 10} ${units[unitIndex]}`
}

// Валидация
const validateForm = () => {
    errors.value = {
        file: '',
        name: '',
        visibility: '',
    }

    let isValid = true

    if (!selectedFile.value) {
        errors.value.file = 'Выберите файл для загрузки'
        isValid = false
    }

    if (!form.value.name.trim()) {
        errors.value.name = 'Название документа обязательно'
        isValid = false
    } else if (form.value.name.trim().length < 2) {
        errors.value.name = 'Название должно содержать минимум 2 символа'
        isValid = false
    } else if (form.value.name.trim().length > 200) {
        errors.value.name = 'Название не должно превышать 200 символов'
        isValid = false
    }

    if (!form.value.visibility) {
        errors.value.visibility = 'Выберите уровень видимости'
        isValid = false
    }

    return isValid
}

const isFormValid = computed(() => {
    return (
        selectedFile.value &&
        form.value.name.trim().length >= 2 &&
        form.value.name.trim().length <= 200 &&
        form.value.visibility
    )
})

// Обработчики
const handleSubmit = async () => {
    if (!validateForm() || !selectedFile.value) return

    isLoading.value = true

    try {
        await documentsStore.createDocument({
            name: form.value.name.trim(),
            description: form.value.description.trim() || undefined,
            type_id: form.value.type_id || undefined,
            parent_folder: documentsStore.currentPath,
            file: selectedFile.value,
            visibility: form.value.visibility,
        })

        emit('created')
        resetForm()
    } catch (error) {
        // Error is handled in the store
    } finally {
        isLoading.value = false
    }
}

const resetForm = () => {
    form.value = {
        name: '',
        description: '',
        type_id: null,
        visibility: 'public',
    }

    errors.value = {
        file: '',
        name: '',
        visibility: '',
    }

    selectedFile.value = null

    if (fileUpload.value) {
        fileUpload.value.clear()
    }
}

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
.create-document-form {
    @apply space-y-4;
}

.form-field {
    @apply space-y-2;
}

.field-label {
    @apply block text-sm font-medium text-surface-700 dark:text-surface-200;
}

.field-label.required::after {
    content: ' *';
    color: var(--p-red-500);
}

.file-upload-area {
    @apply space-y-3;
}

.selected-file-info {
    @apply p-3 bg-surface-50 dark:bg-surface-800 rounded-md border border-surface-200 dark:border-surface-700;
}

.file-info {
    @apply flex items-center gap-3;
}

.file-icon {
    @apply text-xl text-primary;
}

.file-details {
    @apply flex-1 min-w-0;
}

.file-name {
    @apply font-medium text-surface-900 dark:text-surface-0 truncate;
}

.file-size {
    @apply text-sm text-surface-600 dark:text-surface-300;
}

.form-actions {
    @apply flex justify-end gap-2 pt-4 border-t border-surface-200 dark:border-surface-700;
}

.p-error {
    @apply text-xs;
    color: var(--p-red-500);
}
</style>

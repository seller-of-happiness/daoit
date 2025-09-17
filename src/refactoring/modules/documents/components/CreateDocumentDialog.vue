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
                        ref="fileUploadRef"
                        mode="basic"
                        :auto="false"
                        :choose-label="selectedFile ? 'Изменить файл' : 'Выбрать файл'"
                        :show-upload-button="false"
                        :show-cancel-button="false"
                        :accept="getAcceptString()"
                        :max-file-size="getMaxSizeMB() * 1024 * 1024"
                        @select="onFileSelect"
                        @clear="onFileClear"
                        class="w-full"
                    />
                    <div v-if="fileInfo" class="selected-file-info">
                        <div class="file-info">
                            <i :class="fileInfo.icon" class="file-icon"></i>
                            <div class="file-details">
                                <div class="file-name">{{ fileInfo.name }}</div>
                                <div class="file-size">{{ fileInfo.formattedSize }}</div>
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
import { useFileUpload } from '@/refactoring/modules/documents/composables/useFileUpload'
import { useFormValidation } from '@/refactoring/modules/documents/composables/useFormValidation'
import { useDialog } from '@/refactoring/modules/documents/composables/useDialog'
import { useErrorHandler } from '@/refactoring/modules/documents/composables/useErrorHandler'
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

const { handleError, showSuccess } = useErrorHandler()
const { validateForm, documentRules, errors, clearErrors } = useFormValidation()
const { isLoading, setLoading } = useDialog({
    autoReset: true,
    onReset: () => resetForm(),
})

// Форма
const form = ref({
    name: '',
    description: '',
    type_id: null as number | null,
    visibility: 'public' as 'public' | 'private' | 'department',
})

// Файловый загрузчик
const {
    selectedFile,
    fileUploadRef,
    fileInfo,
    onFileSelect: handleFileSelect,
    clearFile,
    reset: resetFileUpload,
    getAcceptString,
    getMaxSizeMB,
} = useFileUpload({
    autoFillName: true,
    nameField: computed({
        get: () => form.value.name,
        set: (value) => (form.value.name = value),
    }),
})

const dialogVisible = computed({
    get: () => props.visible,
    set: (value: boolean) => emit('update:visible', value)
})


// Опции видимости
const visibilityOptions = [
    { label: 'Публичный (доступен всем)', value: 'public' },
    { label: 'Отдел (доступен отделу)', value: 'department' },
    { label: 'Приватный (только мне)', value: 'private' },
]

// Обработчики файлов
const onFileSelect = (event: any) => {
    const result = handleFileSelect(event)
    if (!result.isValid && result.error) {
        errors.value.file = result.error
    } else {
        errors.value.file = ''
    }
}

const onFileClear = () => {
    clearFile()
}

// Валидация
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
    const formData = {
        file: selectedFile.value,
        name: form.value.name,
        visibility: form.value.visibility,
    }

    if (!validateForm(formData, documentRules.createDocument)) {
        return
    }

    if (!selectedFile.value) return

    setLoading(true)

    try {
        await documentsStore.createDocument({
            name: form.value.name.trim(),
            description: form.value.description.trim() || undefined,
            type_id: form.value.type_id || undefined,
            parent_folder: documentsStore.currentPath,
            file: selectedFile.value,
            visibility: form.value.visibility,
        })

        // Сообщение об успехе уже показывается в store
        emit('created')
        dialogVisible.value = false
    } catch (error) {
        handleError(error, {
            context: 'CreateDocumentDialog',
            functionName: 'handleSubmit',
            toastTitle: 'Ошибка',
            toastMessage: 'Не удалось создать документ',
            toastTime: 7000,
        })
    } finally {
        setLoading(false)
    }
}

const resetForm = () => {
    form.value = {
        name: '',
        description: '',
        type_id: null,
        visibility: 'public',
    }

    clearErrors()
    resetFileUpload()
}
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

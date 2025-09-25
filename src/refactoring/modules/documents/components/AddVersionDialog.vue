<template>
    <Dialog
        v-model:visible="dialogVisible"
        modal
        :header="`Добавить версию: ${document?.name || ''}`"
        :style="{ width: '450px' }"
        @hide="resetForm"
    >
        <form @submit.prevent="handleSubmit" class="add-version-form">
            <div class="form-field">
                <label for="versionFile" class="field-label required">Файл новой версии</label>
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
                <label for="versionDescription" class="field-label">Описание изменений</label>
                <Textarea
                    id="versionDescription"
                    v-model="form.description"
                    placeholder="Опишите что изменилось в новой версии (необязательно)"
                    rows="4"
                    class="w-full"
                />
            </div>

            <div v-if="document" class="document-info">
                <h5>Информация о документе:</h5>
                <div class="info-item">
                    <span class="info-label">Название:</span>
                    <span class="info-value">{{ document.name }}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Текущий размер:</span>
                    <span class="info-value">{{ formatFileSize(document.size || 0) }}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Последнее изменение:</span>
                    <span class="info-value">{{ formatDate(document.updated_at) }}</span>
                </div>
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
                    label="Добавить версию"
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
import { useFormValidation } from '@/refactoring/modules/documents/composables/useFormValidation'
import { useErrorHandler } from '@/refactoring/modules/documents/composables/useErrorHandler'
import {
    formatFileSize,
    formatDate,
    getFileIcon,
} from '@/refactoring/modules/documents/utils/documentUtils'
import type {
    IDocument,
    IDocumentDetailsResponse,
} from '@/refactoring/modules/documents/types/IDocument'

interface Props {
    visible: boolean
    document: IDocument | IDocumentDetailsResponse | null
}

interface Emits {
    (e: 'update:visible', value: boolean): void
    (e: 'added'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const documentsStore = useDocumentsStore()
const { errors, documentRules, validateForm, clearErrors, clearFieldError, hasErrors } =
    useFormValidation()
const { handleError, showSuccess } = useErrorHandler()

const dialogVisible = computed({
    get: () => props.visible,
    set: (value) => emit('update:visible', value),
})

// Файл
const fileUpload = ref()
const selectedFile = ref<File | null>(null)

// Форма
const form = ref({
    description: '',
})

const isLoading = ref(false)

// Обработчики файлов
const onFileSelect = (event: any) => {
    const file = event.files[0]
    if (file) {
        selectedFile.value = file
        clearFieldError('file')
    }
}

const onFileClear = () => {
    selectedFile.value = null
}

const isFormValid = computed(() => !hasErrors.value && selectedFile.value !== null)

// Обработчики
const handleSubmit = async () => {
    const formData = { file: selectedFile.value }
    const isValid = validateForm(formData, documentRules.addVersion)
    if (!isValid || !selectedFile.value || !props.document) return

    isLoading.value = true

    try {
        await documentsStore.addDocumentVersion(
            props.document.id,
            selectedFile.value,
            form.value.description.trim() || undefined,
        )

        // Сообщение об успехе уже показывается в store
        emit('added')
        resetForm()
    } catch (error) {
        handleError(error, {
            context: 'AddVersionDialog',
            functionName: 'handleSubmit',
            toastTitle: 'Ошибка',
            toastMessage: 'Не удалось добавить версию документа',
            additionalData: { documentId: props.document?.id },
        })
    } finally {
        isLoading.value = false
    }
}

const resetForm = () => {
    form.value = {
        description: '',
    }

    clearErrors()
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
.add-version-form {
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

.document-info {
    @apply p-4 bg-surface-50 dark:bg-surface-800 rounded-md border border-surface-200 dark:border-surface-700;
}

.document-info h5 {
    @apply text-sm font-semibold text-surface-700 dark:text-surface-200 mb-3 m-0;
}

.info-item {
    @apply flex justify-between items-center py-1;
}

.info-label {
    @apply text-sm text-surface-600 dark:text-surface-300;
}

.info-value {
    @apply text-sm font-medium text-surface-900 dark:text-surface-0;
}

.form-actions {
    @apply flex justify-end gap-2 pt-4 border-t border-surface-200 dark:border-surface-700;
}

.p-error {
    @apply text-xs;
    color: var(--p-red-500);
}
</style>

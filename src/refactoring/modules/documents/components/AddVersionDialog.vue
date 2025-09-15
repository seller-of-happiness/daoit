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
            accept="*/*"
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
import type { IDocument } from '@/refactoring/modules/documents/types/IDocument'

interface Props {
  visible: boolean
  document: IDocument | null
}

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'added'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const documentsStore = useDocumentsStore()

// Реактивность диалога
const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
})

// Файл
const fileUpload = ref()
const selectedFile = ref<File | null>(null)

// Форма
const form = ref({
  description: ''
})

const errors = ref({
  file: ''
})

const isLoading = ref(false)

// Обработчики файлов
const onFileSelect = (event: any) => {
  const file = event.files[0]
  if (file) {
    selectedFile.value = file
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
    'pdf': 'pi pi-file-pdf',
    'doc': 'pi pi-file-word',
    'docx': 'pi pi-file-word',
    'xls': 'pi pi-file-excel',
    'xlsx': 'pi pi-file-excel',
    'csv': 'pi pi-file-excel',
    'jpg': 'pi pi-image',
    'jpeg': 'pi pi-image',
    'png': 'pi pi-image',
    'gif': 'pi pi-image',
    'webp': 'pi pi-image',
    'svg': 'pi pi-image',
    'zip': 'pi pi-box',
    'rar': 'pi pi-box',
    '7z': 'pi pi-box',
    'mp4': 'pi pi-video',
    'mov': 'pi pi-video',
    'avi': 'pi pi-video',
    'mkv': 'pi pi-video',
    'mp3': 'pi pi-volume-up',
    'wav': 'pi pi-volume-up',
    'ogg': 'pi pi-volume-up'
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

const formatDate = (dateString: string): string => {
  try {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return dateString
  }
}

// Валидация
const validateForm = () => {
  errors.value = {
    file: ''
  }

  let isValid = true

  if (!selectedFile.value) {
    errors.value.file = 'Выберите файл для новой версии'
    isValid = false
  }

  return isValid
}

const isFormValid = computed(() => {
  return selectedFile.value !== null
})

// Обработчики
const handleSubmit = async () => {
  if (!validateForm() || !selectedFile.value || !props.document) return

  isLoading.value = true

  try {
    await documentsStore.addDocumentVersion(
      props.document.id,
      selectedFile.value,
      form.value.description.trim() || undefined
    )

    emit('added')
    resetForm()
  } catch (error) {
    // Error is handled in the store
  } finally {
    isLoading.value = false
  }
}

const resetForm = () => {
  form.value = {
    description: ''
  }
  
  errors.value = {
    file: ''
  }
  
  selectedFile.value = null
  
  if (fileUpload.value) {
    fileUpload.value.clear()
  }
}

watch(() => props.visible, (visible) => {
  if (!visible) {
    resetForm()
  }
})
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
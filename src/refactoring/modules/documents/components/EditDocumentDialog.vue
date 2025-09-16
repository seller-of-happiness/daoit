<template>
    <Dialog
        v-model:visible="dialogVisible"
        modal
        :header="`Редактирование документа: ${document?.name || ''}`"
        :style="{ width: '800px', maxHeight: '90vh' }"
        @hide="resetForm"
    >
        <div class="edit-document-dialog">
            <!-- Основная информация о документе -->
            <div class="document-info-section">
                <div class="section-header">
                    <h4>Информация о документе</h4>
                </div>
                <div class="document-details">
                    <div class="detail-row">
                        <span class="detail-label">Название:</span>
                        <span class="detail-value">{{ document?.name }}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Номер:</span>
                        <span class="detail-value">{{ document?.number || '—' }}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Тип:</span>
                        <span class="detail-value">{{
                            document?.type_name ||
                            getFileTypeByExtension(document?.extension || '')
                        }}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Статус:</span>
                        <span class="detail-value">{{ document?.status || '—' }}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Видимость:</span>
                        <span class="detail-value">{{ getVisibilityLabel(document?.visibility) }}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Создан:</span>
                        <span class="detail-value">{{
                            formatDate(document?.created_at || '')
                        }}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Последнее изменение:</span>
                        <span class="detail-value">{{
                            formatDate(document?.updated_at || '')
                        }}</span>
                    </div>
                    <div v-if="document?.approved_at" class="detail-row">
                        <span class="detail-label">Утвержден:</span>
                        <span class="detail-value">{{
                            formatDate(document.approved_at)
                        }}</span>
                    </div>
                </div>
            </div>

            <!-- Список версий -->
            <div class="versions-section">
                <div class="section-header">
                    <h4>Версии документа</h4>
                </div>

                <div class="versions-list">
                    <div v-if="!document?.versions || document.versions.length === 0" class="empty-versions">
                        <i class="pi pi-file-o"></i>
                        <p>У документа пока нет версий</p>
                    </div>

                    <div v-else class="versions-table">
                        <div class="version-header">
                            <div>Версия</div>
                            <div>Статус</div>
                            <div>Размер</div>
                            <div>Дата создания</div>
                            <div>Создатель</div>
                            <div>Описание</div>
                            <div>Действия</div>
                        </div>

                        <div
                            v-for="version in document.versions"
                            :key="version.id"
                            class="version-row"
                        >
                            <div class="version-number">{{ version.version }}</div>
                            <div class="version-status">
                                <StatusChip :status="version.status" />
                            </div>
                            <div class="version-size">{{ formatFileSize(version.size) }}</div>
                            <div class="version-date">
                                {{ formatDate(version.created_at) }}
                            </div>
                            <div class="version-author">{{ version.created_by }}</div>
                            <div class="version-description">
                                {{ version.description || '—' }}
                            </div>
                            <div class="version-actions">
                                <Button
                                    icon="pi pi-download"
                                    severity="secondary"
                                    text
                                    size="small"
                                    @click="downloadVersion(version)"
                                    v-tooltip.top="'Скачать эту версию'"
                                />
                                <Button
                                    icon="pi pi-trash"
                                    severity="danger"
                                    text
                                    size="small"
                                    @click="confirmDeleteVersion(version)"
                                    v-tooltip.top="'Удалить версию'"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Действия с документом -->
            <div class="document-actions-section">
                <div class="action-buttons">
                    <Button
                        icon="pi pi-upload"
                        label="Добавить версию"
                        @click="showAddVersionDialog = true"
                    />
                    <Button
                        icon="pi pi-download"
                        label="Скачать файл"
                        severity="secondary"
                        @click="downloadDocument"
                    />
                    <Button
                        icon="pi pi-trash"
                        label="Удалить файл"
                        severity="danger"
                        @click="confirmDeleteDocument"
                    />
                </div>
                <small class="danger-text">
                    Удаление документа необратимо. Все версии будут удалены.
                </small>
            </div>
        </div>

        <!-- Диалог добавления версии (встроенный) -->
        <AddVersionDialog
            v-model:visible="showAddVersionDialog"
            :document="document"
            @added="onVersionAdded"
        />

        <!-- Диалог подтверждения удаления -->
        <ConfirmDialog />
    </Dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import { useDocumentsStore } from '@/refactoring/modules/documents/stores/documentsStore'
import { useFeedbackStore } from '@/refactoring/modules/feedback/stores/feedbackStore'
import type { IDocument, IDocumentVersion } from '@/refactoring/modules/documents/types/IDocument'
import AddVersionDialog from './AddVersionDialog.vue'
import StatusChip from '@/components/StatusChip.vue'
import { BASE_URL } from '@/refactoring/environment/environment'

interface Props {
    visible: boolean
    document: IDocument | null
}

interface Emits {
    (e: 'update:visible', value: boolean): void
    (e: 'documentDeleted'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const documentsStore = useDocumentsStore()
const confirm = useConfirm()

// Реактивность диалога
const dialogVisible = computed({
    get: () => props.visible,
    set: (value) => emit('update:visible', value),
})

// Состояние
const showAddVersionDialog = ref(false)

const downloadVersion = (version: IDocumentVersion) => {
    const url = version.download_url || version.file_url || version.file
    if (!url) {
        useFeedbackStore().showToast({
            type: 'error',
            title: 'Ошибка',
            message: 'Не удалось найти ссылку для скачивания версии',
            time: 5000,
        })
        return
    }

    try {
        const downloadUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`
        const link = window.document.createElement('a')
        link.href = downloadUrl
        link.download = `${props.document?.name}_v${version.version}` || 'download'
        link.target = '_blank'

        window.document.body.appendChild(link)
        link.click()
        window.document.body.removeChild(link)

        useFeedbackStore().showToast({
            type: 'success',
            title: 'Успех',
            message: 'Скачивание версии началось',
            time: 3000,
        })
    } catch (error) {
        useFeedbackStore().showToast({
            type: 'error',
            title: 'Ошибка',
            message: 'Не удалось скачать версию документа',
            time: 5000,
        })
    }
}

const confirmDeleteVersion = (version: IDocumentVersion) => {
    if (!props.document) return

    confirm.require({
        message: `Вы уверены, что хотите удалить версию ${version.version}?`,
        header: 'Подтверждение удаления',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Удалить',
        rejectLabel: 'Отмена',
        acceptClass: 'p-button-danger',
        accept: async () => {
            try {
                await documentsStore.deleteDocumentVersion(props.document!.id, version.id)
                // Версии теперь приходят в составе документа, поэтому нужно обновить документ
                // или обновить локальные данные
            } catch (error) {
                // Error is already handled in store
            }
        },
    })
}

// Методы для управления документом
const downloadDocument = () => {
    if (!props.document) return

    const url = props.document.download_url || props.document.file_url
    if (!url) {
        useFeedbackStore().showToast({
            type: 'error',
            title: 'Ошибка',
            message: 'Не удалось найти ссылку для скачивания документа',
            time: 5000,
        })
        return
    }

    try {
        const downloadUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`
        const link = window.document.createElement('a')
        link.href = downloadUrl
        link.download = props.document.name || 'download'
        link.target = '_blank'

        window.document.body.appendChild(link)
        link.click()
        window.document.body.removeChild(link)

        useFeedbackStore().showToast({
            type: 'success',
            title: 'Успех',
            message: 'Скачивание файла началось',
            time: 3000,
        })
    } catch (error) {
        useFeedbackStore().showToast({
            type: 'error',
            title: 'Ошибка',
            message: 'Не удалось скачать документ',
            time: 5000,
        })
    }
}

const viewDocument = () => {
    if (!props.document) return

    const url = props.document.file_url || props.document.download_url
    if (!url) {
        useFeedbackStore().showToast({
            type: 'error',
            title: 'Ошибка',
            message: 'Не удалось найти ссылку для просмотра документа',
            time: 5000,
        })
        return
    }

    try {
        const viewUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`
        window.open(viewUrl, '_blank')
    } catch (error) {
        useFeedbackStore().showToast({
            type: 'error',
            title: 'Ошибка',
            message: 'Не удалось открыть документ для просмотра',
            time: 5000,
        })
    }
}

const confirmDeleteDocument = () => {
    if (!props.document) return

    confirm.require({
        message: `Вы уверены, что хотите удалить документ "${props.document.name}"? Это действие необратимо.`,
        header: 'Подтверждение удаления',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Удалить',
        rejectLabel: 'Отмена',
        acceptClass: 'p-button-danger',
        accept: async () => {
            try {
                await documentsStore.deleteDocument(props.document!.id)
                emit('documentDeleted')
                dialogVisible.value = false
            } catch (error) {
                // Error handled in store
            }
        },
    })
}

// Обработчики событий
const onVersionAdded = () => {
    showAddVersionDialog.value = false
    // Версии теперь приходят в составе документа при обновлении
}

const resetForm = () => {
    showAddVersionDialog.value = false
}

// Утилиты
const getVisibilityLabel = (visibility?: string): string => {
    const visibilityMap: Record<string, string> = {
        creator: 'Только создатель',
        public: 'Публичный',
        private: 'Приватный',
        department: 'Отдел',
    }
    return visibilityMap[visibility || ''] || visibility || '—'
}

const getFileTypeByExtension = (extension: string): string => {
    const ext = extension.toLowerCase()
    const typeMap: Record<string, string> = {
        pdf: 'PDF документ',
        doc: 'Word документ',
        docx: 'Word документ',
        xls: 'Excel таблица',
        xlsx: 'Excel таблица',
        csv: 'CSV файл',
        txt: 'Текстовый файл',
        jpg: 'Изображение',
        jpeg: 'Изображение',
        png: 'Изображение',
        gif: 'Изображение',
        zip: 'Архив',
        rar: 'Архив',
        '7z': 'Архив',
    }
    return typeMap[ext] || 'Файл'
}

const formatFileSize = (bytes: number): string => {
    if (!bytes) return '—'

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
    if (!dateString) return '—'

    try {
        return new Date(dateString).toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        })
    } catch {
        return dateString
    }
}

// Watchers - версии теперь приходят в составе документа, поэтому отдельная загрузка не нужна
</script>

<style scoped>
.edit-document-dialog {
    @apply space-y-6;
}

/* Информация о документе */
.document-info-section {
    @apply bg-surface-50 dark:bg-surface-800 rounded-lg p-4 border border-surface-200 dark:border-surface-700;
}

.section-header {
    @apply mb-4;
}

.section-header h4 {
    @apply text-lg font-semibold text-surface-900 dark:text-surface-0 m-0;
}

.section-header h5 {
    @apply text-base font-semibold text-surface-900 dark:text-surface-0 m-0;
}

.document-details {
    @apply space-y-2;
}

.detail-row {
    @apply flex justify-between items-center py-1;
}

.detail-label {
    @apply text-sm font-medium text-surface-600 dark:text-surface-300;
}

.detail-value {
    @apply text-sm text-surface-900 dark:text-surface-0;
}

/* Версии */
.versions-section {
    @apply bg-surface-50 dark:bg-surface-800 rounded-lg p-4 border border-surface-200 dark:border-surface-700 space-y-4;
}

.versions-list {
    @apply min-h-[200px];
}

.empty-versions {
    @apply text-center p-8 space-y-4;
}

.empty-versions i {
    @apply text-4xl text-surface-400 dark:text-surface-500;
}

.empty-versions p {
    @apply text-surface-600 dark:text-surface-300 m-0;
}

.versions-table {
    @apply border border-surface-200 dark:border-surface-700 rounded-lg overflow-hidden;
}

.version-header {
    @apply grid grid-cols-[80px_100px_80px_140px_120px_1fr_100px] gap-4 p-3 bg-surface-100 dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700 text-sm font-medium text-surface-700 dark:text-surface-200;
}

.version-row {
    @apply grid grid-cols-[80px_100px_80px_140px_120px_1fr_100px] gap-4 p-3 border-b border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800 text-sm;
}

.version-row:last-child {
    @apply border-b-0;
}

.version-number {
    @apply font-medium text-primary;
}

.version-status,
.version-size,
.version-date,
.version-author,
.version-description {
    @apply text-surface-700 dark:text-surface-200;
}

.version-description {
    @apply truncate;
}

.version-actions {
    @apply flex items-center gap-1;
}

/* Действия с документом */
.document-actions-section {
    @apply bg-surface-50 dark:bg-surface-800 rounded-lg p-4 border border-surface-200 dark:border-surface-700 space-y-3;
}

.action-buttons {
    @apply flex gap-2 flex-wrap;
}

.danger-text {
    @apply text-surface-500 dark:text-surface-400 text-xs;
}

/* Адаптивность */
@media (max-width: 768px) {
    .version-header,
    .version-row {
        @apply grid-cols-[60px_80px_1fr_80px] gap-2;
    }

    .version-size,
    .version-date,
    .version-author {
        @apply hidden;
    }

    .action-buttons {
        @apply flex-col;
    }
}
</style>

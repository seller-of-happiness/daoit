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
                        <span class="detail-label">Тип:</span>
                        <span class="detail-value">{{ document?.type?.name || getFileTypeByExtension(document?.extension || '') }}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Размер:</span>
                        <span class="detail-value">{{ formatFileSize(document?.size || 0) }}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Создан:</span>
                        <span class="detail-value">{{ formatDate(document?.created_at || '') }}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Последнее изменение:</span>
                        <span class="detail-value">{{ formatDate(document?.updated_at || '') }}</span>
                    </div>
                </div>
            </div>

            <!-- Вкладки -->
            <TabView class="document-tabs">
                <!-- История версий -->
                <TabPanel header="История версий">
                    <div class="versions-section">
                        <div class="section-header">
                            <h5>Версии документа</h5>
                            <Button
                                icon="pi pi-plus"
                                label="Добавить версию"
                                size="small"
                                @click="showAddVersionDialog = true"
                            />
                        </div>

                        <div class="versions-list">
                            <div v-if="isLoadingVersions" class="loading-state">
                                <ProgressSpinner size="small" />
                                <span>Загрузка версий...</span>
                            </div>
                            
                            <div v-else-if="documentVersions.length === 0" class="empty-versions">
                                <i class="pi pi-file-o"></i>
                                <p>У документа пока нет дополнительных версий</p>
                                <Button
                                    label="Добавить первую версию"
                                    size="small"
                                    @click="showAddVersionDialog = true"
                                />
                            </div>

                            <div v-else class="versions-table">
                                <div class="version-header">
                                    <div>Версия</div>
                                    <div>Дата создания</div>
                                    <div>Создатель</div>
                                    <div>Описание</div>
                                    <div>Действия</div>
                                </div>
                                
                                <div 
                                    v-for="version in documentVersions" 
                                    :key="version.id"
                                    class="version-row"
                                >
                                    <div class="version-number">{{ version.version_number }}</div>
                                    <div class="version-date">{{ formatDate(version.created_at) }}</div>
                                    <div class="version-author">{{ version.created_by }}</div>
                                    <div class="version-description">{{ version.description || '—' }}</div>
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
                </TabPanel>

                <!-- Управление документом -->
                <TabPanel header="Управление">
                    <div class="management-section">
                        <div class="management-actions">
                            <div class="action-group">
                                <h5>Действия с документом</h5>
                                <div class="action-buttons">
                                    <Button
                                        icon="pi pi-download"
                                        label="Скачать документ"
                                        severity="secondary"
                                        @click="downloadDocument"
                                    />
                                    <Button
                                        icon="pi pi-eye"
                                        label="Просмотреть"
                                        severity="secondary"
                                        @click="viewDocument"
                                    />
                                    <Button
                                        icon="pi pi-upload"
                                        label="Добавить версию"
                                        @click="showAddVersionDialog = true"
                                    />
                                </div>
                            </div>

                            <div class="action-group danger-zone">
                                <h5>Опасная зона</h5>
                                <div class="action-buttons">
                                    <Button
                                        icon="pi pi-trash"
                                        label="Удалить документ"
                                        severity="danger"
                                        @click="confirmDeleteDocument"
                                    />
                                </div>
                                <small class="danger-text">
                                    Удаление документа необратимо. Все версии будут удалены.
                                </small>
                            </div>
                        </div>
                    </div>
                </TabPanel>
            </TabView>
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
import { ref, computed, watch } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import { useDocumentsStore } from '@/refactoring/modules/documents/stores/documentsStore'
import { useFeedbackStore } from '@/refactoring/modules/feedback/stores/feedbackStore'
import type { IDocument, IDocumentVersion } from '@/refactoring/modules/documents/types/IDocument'
import AddVersionDialog from './AddVersionDialog.vue'
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
const documentVersions = ref<IDocumentVersion[]>([])
const isLoadingVersions = ref(false)

// Методы для работы с версиями
const loadDocumentVersions = async () => {
    if (!props.document) return

    isLoadingVersions.value = true
    try {
        documentVersions.value = await documentsStore.fetchDocumentVersions(props.document.id)
    } catch (error) {
        // Error is already handled in store
    } finally {
        isLoadingVersions.value = false
    }
}

const downloadVersion = (version: IDocumentVersion) => {
    const url = version.download_url || version.file_url
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
        link.download = `${props.document?.name}_v${version.version_number}` || 'download'
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
        message: `Вы уверены, что хотите удалить версию ${version.version_number}?`,
        header: 'Подтверждение удаления',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Удалить',
        rejectLabel: 'Отмена',
        acceptClass: 'p-button-danger',
        accept: async () => {
            try {
                await documentsStore.deleteDocumentVersion(props.document!.id, version.id)
                await loadDocumentVersions()
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
    loadDocumentVersions()
}

const resetForm = () => {
    showAddVersionDialog.value = false
    documentVersions.value = []
}

// Утилиты
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

// Watchers
watch(
    () => props.visible,
    (visible) => {
        if (visible && props.document) {
            loadDocumentVersions()
        } else {
            resetForm()
        }
    },
)
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

/* Вкладки */
.document-tabs {
    @apply mt-4;
}

/* Версии */
.versions-section {
    @apply space-y-4;
}

.section-header {
    @apply flex items-center justify-between;
}

.versions-list {
    @apply min-h-[200px];
}

.loading-state {
    @apply flex items-center justify-center gap-3 p-8 text-surface-600 dark:text-surface-300;
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
    @apply grid grid-cols-[80px_140px_120px_1fr_100px] gap-4 p-3 bg-surface-100 dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700 text-sm font-medium text-surface-700 dark:text-surface-200;
}

.version-row {
    @apply grid grid-cols-[80px_140px_120px_1fr_100px] gap-4 p-3 border-b border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800 text-sm;
}

.version-row:last-child {
    @apply border-b-0;
}

.version-number {
    @apply font-medium text-primary;
}

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

/* Управление */
.management-section {
    @apply space-y-6;
}

.management-actions {
    @apply space-y-6;
}

.action-group {
    @apply space-y-3;
}

.action-group h5 {
    @apply text-base font-semibold text-surface-900 dark:text-surface-0 m-0;
}

.action-buttons {
    @apply flex gap-2 flex-wrap;
}

.danger-zone {
    @apply p-4 border border-red-500 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-900/20;
}

.danger-zone h5 {
    @apply text-red-700 dark:text-red-300;
}

.danger-text {
    @apply text-red-600 dark:text-red-400 text-xs mt-2 block;
}

/* Адаптивность */
@media (max-width: 768px) {
    .version-header,
    .version-row {
        @apply grid-cols-[60px_1fr_80px] gap-2;
    }

    .version-date,
    .version-author {
        @apply hidden;
    }
}
</style>
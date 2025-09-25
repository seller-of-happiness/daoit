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
                            document?.type_name || getFileTypeByExtension(documentExtension)
                        }}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Статус:</span>
                        <span class="detail-value">{{ document?.status || '—' }}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Видимость:</span>
                        <span class="detail-value">{{
                            getVisibilityLabel(document?.visibility)
                        }}</span>
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
                        <span class="detail-value">{{ formatDate(document.approved_at) }}</span>
                    </div>
                </div>
            </div>

            <!-- Список версий -->
            <div class="versions-section">
                <div class="section-header">
                    <h4>Версии документа</h4>
                </div>

                <div class="versions-list">
                    <div
                        v-if="!selectedDocument?.versions || selectedDocument.versions.length === 0"
                        class="empty-versions"
                    >
                        <i class="pi pi-file-o"></i>
                        <p>У документа пока нет версий</p>
                    </div>

                    <div v-else class="versions-table">
                        <div class="version-header">
                            <div>Версия</div>
                            <div>Размер</div>
                            <div>Дата создания</div>
                            <div>Действия</div>
                        </div>

                        <div
                            v-for="version in selectedDocument.versions"
                            :key="version.id"
                            class="version-row"
                        >
                            <div
                                class="version-number cursor-pointer"
                                @click="downloadVersion(version)"
                            >
                                {{ version.version }}
                            </div>
                            <div class="version-size">{{ formatFileSize(version.size) }}</div>
                            <div class="version-date">
                                {{ formatDate(version.created_at) }}
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
                                <!-- <Button
                                    icon="pi pi-trash"
                                    severity="danger"
                                    text
                                    size="small"
                                    @click="confirmDeleteVersion(version)"
                                    v-tooltip.top="'Удалить версию'"
                                /> -->
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Действия с документом -->
            <div class="document-actions-section">
                <div class="action-buttons">
                    <div>
                        <Button
                            icon="pi pi-upload"
                            label="Добавить версию"
                            @click="showAddVersionDialog = true"
                        />
                    </div>
                    <div>
                        <Button
                            icon="pi pi-download"
                            label="Скачать файл"
                            @click="downloadDocument"
                            class="download-btn"
                        />
                        <Button
                            icon="pi pi-trash"
                            label="Удалить файл"
                            severity="danger"
                            @click="confirmDeleteDocument"
                        />
                    </div>
                </div>
                <div class="danger-text">
                    Удаление документа необратимо. Все версии будут удалены.
                </div>
            </div>
        </div>

        <!-- Диалог добавления версии (встроенный) -->
        <AddVersionDialog
            v-model:visible="showAddVersionDialog"
            :document="selectedDocument || document"
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
import {
    formatFileSize,
    formatDate,
    getFileTypeByExtension,
    getVisibilityLabel,
} from '@/refactoring/modules/documents/utils/documentUtils'
import type {
    IDocument,
    IDocumentVersion,
    IDocumentDetailsResponse,
} from '@/refactoring/modules/documents/types/IDocument'
import AddVersionDialog from './AddVersionDialog.vue'
import { BASE_URL } from '@/refactoring/environment/environment'

interface Props {
    visible: boolean
    document: IDocument | IDocumentDetailsResponse | null
}

interface Emits {
    (e: 'update:visible', value: boolean): void
    (e: 'documentDeleted'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const documentsStore = useDocumentsStore()
const feedbackStore = useFeedbackStore()
const confirm = useConfirm()

const dialogVisible = computed({
    get: () => props.visible,
    set: (value) => emit('update:visible', value),
})

const documentExtension = computed(() => {
    if (!props.document) return ''
    return (props.document as any).extension || ''
})

const showAddVersionDialog = ref(false)
const selectedDocument = ref<IDocument | IDocumentDetailsResponse | null>(null)

const downloadVersion = (version: IDocumentVersion) => {
    const url = version.download_url || version.file_url || version.file
    if (!url) {
        feedbackStore.showToast({
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

        feedbackStore.showToast({
            type: 'success',
            title: 'Успех',
            message: 'Скачивание версии началось',
            time: 3000,
        })
    } catch (error) {
        feedbackStore.showToast({
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
                confirm.close()
                // Обновляем список версий
                if (props.document?.id) {
                    const updatedDocument = await documentsStore.fetchDocumentDetails(props.document.id)
                    selectedDocument.value = updatedDocument
                }
            } catch (error) {
                // Ошибка уже обработана в store
            }
        },
    })
}

// Методы для управления документом
const downloadDocument = () => {
    if (!props.document) return

    const url = props.document.download_url || props.document.file_url
    if (!url) {
        feedbackStore.showToast({
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

        feedbackStore.showToast({
            type: 'success',
            title: 'Успех',
            message: 'Скачивание файла началось',
            time: 3000,
        })
    } catch (error) {
        feedbackStore.showToast({
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
        feedbackStore.showToast({
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
        feedbackStore.showToast({
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
                confirm.close()
                emit('documentDeleted')
                dialogVisible.value = false
            } catch (error) {
                // Ошибка уже обработана в store
            }
        },
    })
}

// Обработчики событий
const onVersionAdded = async () => {
    showAddVersionDialog.value = false
    
    // Обновляем детали документа для получения актуального списка версий
    if (props.document?.id) {
        try {
            const updatedDocument = await documentsStore.fetchDocumentDetails(props.document.id)
            // Обновляем текущий документ в родительском компоненте
            selectedDocument.value = updatedDocument
        } catch (error) {
            // Игнорируем ошибку, основной список все равно обновится
        }
    }
}

const resetForm = () => {
    showAddVersionDialog.value = false
}

// Синхронизируем selectedDocument с props.document
watch(
    () => props.document,
    (newDocument) => {
        selectedDocument.value = newDocument
    },
    { immediate: true }
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
    @apply grid grid-cols-[25%_25%_25%_25%] p-3 bg-surface-100 dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700 text-sm font-medium text-surface-700 dark:text-surface-200;
}

.version-row {
    @apply grid grid-cols-[25%_25%_25%_25%] p-3 border-b border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800 text-sm;
}

.version-row:last-child {
    @apply border-b-0;
}

.version-header div,
.version-row div {
    @apply px-2 text-center;
}

.version-number {
    @apply font-medium text-primary;
}

.version-size,
.version-date {
    @apply text-surface-700 dark:text-surface-200;
}

.version-actions {
    @apply flex items-center justify-center gap-1;
}

/* Действия с документом */
.document-actions-section {
    @apply bg-surface-50 dark:bg-surface-800 rounded-lg p-4 border border-surface-200 dark:border-surface-700 space-y-3;
}

.action-buttons {
    @apply flex gap-2 flex-wrap justify-between;
}

.danger-text {
    @apply text-surface-500 dark:text-surface-400 text-xs w-full text-right mt-3;
}

.download-btn {
    margin-right: 24px !important;
}

/* Адаптивность */
@media (max-width: 768px) {
    .version-header,
    .version-row {
        @apply grid-cols-[60px_1fr_80px] gap-2;
    }

    .version-size {
        @apply hidden;
    }

    .action-buttons {
        @apply flex-col;
    }
}
</style>

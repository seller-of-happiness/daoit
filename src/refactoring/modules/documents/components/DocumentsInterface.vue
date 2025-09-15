<template>
    <div class="documents-interface">
        <!-- Заголовок и панель инструментов -->
        <div class="toolbar-container">
            <div class="toolbar-header">
                <h3 class="page-title">Документы</h3>
                <div class="toolbar-actions">
                    <Button
                        icon="pi pi-folder-plus"
                        label="Создать папку"
                        severity="secondary"
                        @click="showCreateFolderDialog = true"
                    />
                    <Button
                        icon="pi pi-plus"
                        label="Загрузить документ"
                        @click="showCreateDocumentDialog = true"
                    />
                </div>
            </div>

            <!-- Breadcrumbs -->
            <div class="breadcrumbs-container">
                <Breadcrumb :model="breadcrumbItems" class="breadcrumbs">
                    <template #item="{ item }">
                        <span
                            v-if="item.command"
                            @click="() => item.command()"
                            class="breadcrumb-item clickable"
                        >
                            {{ item.label }}
                        </span>
                        <span v-else class="breadcrumb-item">{{ item.label }}</span>
                    </template>
                </Breadcrumb>
            </div>

            <!-- Панель выбора -->
        </div>

        <!-- Основная таблица документов -->
        <div class="documents-table-container">
            <div class="table-card">
                <!-- Заголовок таблицы -->
                <div class="table-header">
                    <div class="table-header-cell name-cell">
                        <i class="pi pi-sort-alt"></i>
                        Название
                    </div>
                    <div class="table-header-cell type-cell">Тип</div>
                    <div class="table-header-cell size-cell">Размер</div>
                    <div class="table-header-cell date-cell">Дата изменения</div>
                    <div class="table-header-cell actions-cell">Действия</div>
                </div>

                <!-- Строки таблицы -->
                <div class="table-body">
                    <!-- Кнопка "Назад" если не в корне -->
                    <div
                        v-if="!documentsStore.isRootPath"
                        class="table-row back-row"
                        @click="navigateUp"
                        title="Перейти на одну папку вверх"
                    >
                        <div class="table-cell name-cell">
                            <i class="pi pi-arrow-left text-primary"></i>
                            <span class="item-name">.. (назад)</span>
                        </div>
                        <div class="table-cell type-cell">—</div>
                        <div class="table-cell size-cell">—</div>
                        <div class="table-cell date-cell">—</div>
                        <div class="table-cell actions-cell"></div>
                    </div>

                    <!-- Папки -->
                    <div
                        v-for="folder in documentsStore.currentFolders"
                        :key="`folder-${folder.id}`"
                        class="table-row folder-row"
                        @click="navigateToFolder(folder)"
                    >
                        <div class="table-cell name-cell">
                            <i
                                :class="documentsStore.getDocumentIcon(folder)"
                                class="item-icon"
                            ></i>
                            <span class="item-name">{{ folder.name }}</span>
                        </div>
                        <div class="table-cell type-cell">Папка</div>
                        <div class="table-cell size-cell">—</div>
                        <div class="table-cell date-cell">
                            {{ documentsStore.formatDate(folder.updated_at) }}
                        </div>
                        <div class="table-cell actions-cell" @click.stop>
                            <div class="action-buttons">
                                <Button
                                    icon="pi pi-folder-open"
                                    severity="secondary"
                                    text
                                    size="small"
                                    @click="navigateToFolder(folder)"
                                    v-tooltip.top="'Открыть'"
                                />
                                <Button
                                    icon="pi pi-link"
                                    severity="secondary"
                                    text
                                    size="small"
                                    @click="copyFolderLink(folder)"
                                    v-tooltip.top="'Скопировать ссылку'"
                                />
                                <Button
                                    v-if="folder.id"
                                    icon="pi pi-trash"
                                    severity="danger"
                                    text
                                    size="small"
                                    @click="confirmDeleteFolder(folder)"
                                    v-tooltip.top="'Удалить'"
                                />
                            </div>
                        </div>
                    </div>

                    <!-- Документы -->
                    <div
                        v-for="document in documentsStore.currentDocuments"
                        :key="`doc-${document.id}`"
                        class="table-row document-row"
                    >
                        <div class="table-cell name-cell">
                            <i
                                :class="documentsStore.getDocumentIcon(document)"
                                class="item-icon"
                            ></i>
                            <span class="item-name">{{ document.name }}</span>
                        </div>
                        <div class="table-cell type-cell">
                            {{ document.type?.name || getFileTypeByExtension(document.extension) }}
                        </div>
                        <div class="table-cell size-cell">
                            {{ documentsStore.formatFileSize(document.size) }}
                        </div>
                        <div class="table-cell date-cell">
                            {{ documentsStore.formatDate(document.updated_at) }}
                        </div>
                        <div class="table-cell actions-cell" @click.stop>
                            <div class="action-buttons">
                                <Button
                                    icon="pi pi-download"
                                    severity="secondary"
                                    text
                                    size="small"
                                    @click="downloadDocument(document)"
                                    v-tooltip.top="'Скачать'"
                                />
                                <Button
                                    icon="pi pi-eye"
                                    severity="secondary"
                                    text
                                    size="small"
                                    @click="viewDocument(document)"
                                    v-tooltip.top="'Просмотр'"
                                />
                                <Button
                                    icon="pi pi-upload"
                                    severity="secondary"
                                    text
                                    size="small"
                                    @click="openAddVersionDialog(document)"
                                    v-tooltip.top="'Добавить версию'"
                                />
                                <Button
                                    icon="pi pi-trash"
                                    severity="danger"
                                    text
                                    size="small"
                                    @click="confirmDeleteDocument(document)"
                                    v-tooltip.top="'Удалить'"
                                />
                            </div>
                        </div>
                    </div>

                    <!-- Сообщение о пустой папке -->
                    <div v-if="documentsStore.currentItems.length === 0" class="empty-state">
                        <div class="empty-state-content">
                            <i class="pi pi-folder-open empty-icon"></i>
                            <h4>Папка пуста</h4>
                            <p>Создайте новую папку или загрузите документ</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Диалог создания папки -->
        <CreateFolderDialog v-model:visible="showCreateFolderDialog" @created="onFolderCreated" />

        <!-- Диалог создания документа -->
        <CreateDocumentDialog
            v-model:visible="showCreateDocumentDialog"
            :document-types="documentsStore.documentTypes"
            @created="onDocumentCreated"
        />

        <!-- Диалог добавления версии -->
        <AddVersionDialog
            v-model:visible="showAddVersionDialog"
            :document="selectedDocument"
            @added="onVersionAdded"
        />

        <!-- Диалог подтверждения удаления -->
        <ConfirmDialog />
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useConfirm } from 'primevue/useconfirm'
import { useDocumentsStore } from '@/refactoring/modules/documents/stores/documentsStore'
import { useFeedbackStore } from '@/refactoring/modules/feedback/stores/feedbackStore'
import { ERouteNames } from '@/router/ERouteNames'
import type { IDocument, IDocumentFolder } from '@/refactoring/modules/documents/types/IDocument'
import CreateFolderDialog from './CreateFolderDialog.vue'
import CreateDocumentDialog from './CreateDocumentDialog.vue'
import AddVersionDialog from './AddVersionDialog.vue'
import { BASE_URL } from '@/refactoring/environment/environment'

// Props
interface Props {
    path?: string[]
}

const props = withDefaults(defineProps<Props>(), {
    path: () => [],
})


const documentsStore = useDocumentsStore()
const confirm = useConfirm()
const route = useRoute()
const router = useRouter()

// Диалоги
const showCreateFolderDialog = ref(false)
const showCreateDocumentDialog = ref(false)
const showAddVersionDialog = ref(false)
const selectedDocument = ref<IDocument | null>(null)

// Breadcrumbs
const breadcrumbItems = computed(() => {
    return documentsStore.breadcrumbs.map((crumb, index) => ({
        label: crumb.name,
        command:
            index < documentsStore.breadcrumbs.length - 1
                ? () => {
                      if (crumb.id) {
                          navigateToFolderId(crumb.id)
                      } else {
                          navigateToPath(crumb.path)
                      }
                  }
                : undefined,
    }))
})


const onFolderCreated = () => {
    showCreateFolderDialog.value = false
}

const onDocumentCreated = () => {
    showCreateDocumentDialog.value = false
}

const onVersionAdded = () => {
    showAddVersionDialog.value = false
    selectedDocument.value = null
}

const openAddVersionDialog = (document: IDocument) => {
    selectedDocument.value = document
    showAddVersionDialog.value = true
}

const confirmDeleteFolder = (folder: IDocumentFolder) => {
    if (!folder.id) {
        return
    }

    confirm.require({
        message: `Вы уверены, что хотите удалить папку "${folder.name}"?`,
        header: 'Подтверждение удаления',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Удалить',
        rejectLabel: 'Отмена',
        acceptClass: 'p-button-danger',
        accept: () => {
            return documentsStore
                .deleteFolder(folder.id!)
                .catch((error) => {
                    throw error
                })
        }
    })
}

const confirmDeleteDocument = (document: IDocument) => {
    confirm.require({
        message: `Вы уверены, что хотите удалить документ "${document.name}"?`,
        header: 'Подтверждение удаления',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Удалить',
        rejectLabel: 'Отмена',
        acceptClass: 'p-button-danger',
        accept: async () => {
            try {
                await documentsStore.deleteDocument(document.id)
                confirm.close()
            } catch (error) {
                // Error is already handled in the store
            }
        },
        reject: () => {
            confirm.close()
        },
    })
}


const downloadDocument = (document: IDocument) => {
    const url = document.download_url || document.file_url
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
        // Проверяем, является ли URL относительным
        const downloadUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`

        // Создаем временную ссылку для скачивания
        const link = window.document.createElement('a')
        link.href = downloadUrl
        link.download = document.name || 'download'
        link.target = '_blank'

        // Добавляем в DOM, кликаем и удаляем
        window.document.body.appendChild(link)
        link.click()
        window.document.body.removeChild(link)

        // Показываем уведомление об успехе
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

const viewDocument = (document: IDocument) => {
    const url = document.file_url || document.download_url
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
        // Проверяем, является ли URL относительным
        const viewUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`

        // Открываем документ в новой вкладке
        const newWindow = window.open(viewUrl, '_blank')

        // Проверяем, удалось ли открыть окно (может быть заблокировано блокировщиком попапов)
        if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
            useFeedbackStore().showToast({
                type: 'warn',
                title: 'Внимание',
                message:
                    'Возможно, браузер заблокировал открытие новой вкладки. Попробуйте скачать документ.',
                time: 7000,
            })
        }
    } catch (error) {
        useFeedbackStore().showToast({
            type: 'error',
            title: 'Ошибка',
            message: 'Не удалось открыть документ для просмотра',
            time: 5000,
        })
    }
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

const navigateToFolder = async (folder: IDocumentFolder) => {
    try {
        await documentsStore.navigateToFolder(folder)
        // Обновляем URL после успешной навигации
        documentsStore.updateUrl(router)
    } catch (error) {
    }
}

const navigateToPath = async (path: string) => {
    try {
        await documentsStore.navigateToPath(path)
        // Обновляем URL после успешной навигации
        documentsStore.updateUrl(router)
    } catch (error) {
    }
}

const navigateToFolderId = async (folderId: string) => {
    try {
        await documentsStore.navigateToFolderId(folderId)
        // Обновляем URL после успешной навигации
        documentsStore.updateUrl(router)
    } catch (error) {
    }
}

const navigateUp = async () => {
    try {
        await documentsStore.navigateUp()
        // Обновляем URL после успешной навигации
        documentsStore.updateUrl(router)
    } catch (error) {
    }
}

const copyFolderLink = (folder: IDocumentFolder) => {
    try {
        let fullUrl: string

        if (folder.path && folder.path !== '/') {
            // Создаем URL для папки на основе пути
            const pathArray = documentsStore.pathToArray(folder.path)

            const routeParams = {
                name: ERouteNames.DOCUMENTS_FOLDER,
                params: { pathMatch: pathArray },
            }
            fullUrl = `${window.location.origin}${router.resolve(routeParams).href}`
        } else {
            fullUrl = `${window.location.origin}${router.resolve({ name: ERouteNames.DOCUMENTS }).href}`
        }

        navigator.clipboard
            .writeText(fullUrl)
            .then(() => {
                useFeedbackStore().showToast({
                    type: 'success',
                    title: 'Успех',
                    message: 'Ссылка на папку скопирована в буфер обмена',
                    time: 3000,
                })
            })
            .catch(() => {
                const textArea = window.document.createElement('textarea')
                textArea.value = fullUrl
                window.document.body.appendChild(textArea)
                textArea.select()
                window.document.execCommand('copy')
                window.document.body.removeChild(textArea)

                useFeedbackStore().showToast({
                    type: 'success',
                    title: 'Успех',
                    message: 'Ссылка на папку скопирована в буфер обмена',
                    time: 3000,
                })
            })
    } catch (error) {
        useFeedbackStore().showToast({
            type: 'error',
            title: 'Ошибка',
            message: 'Не удалось скопировать ссылку на папку',
            time: 5000,
        })
    }
}

const initializeFromUrl = async () => {
    try {
        if (props.path && Array.isArray(props.path) && props.path.length > 0) {
            const targetPath = documentsStore.arrayToPath(props.path)
            await documentsStore.fetchDocuments({ path: targetPath })
        } else {
            await documentsStore.fetchDocuments()
        }
    } catch (error) {
        await documentsStore.fetchDocuments()
    }
}

watch(
    () => props.path,
    async (newPath, oldPath) => {
        try {
            const targetPath =
                newPath && newPath.length > 0 ? documentsStore.arrayToPath(newPath) : '/'

            if (targetPath !== documentsStore.currentPath) {
                await documentsStore.fetchDocuments({ path: targetPath })
            }
        } catch (error) {
            // Error is handled in the store
        }
    },
    { immediate: false, deep: true },
)

onMounted(async () => {
    await documentsStore.fetchDocumentTypes()
    await initializeFromUrl()
})

onUnmounted(() => {
    documentsStore.cleanup()
})
</script>

<style scoped>
.documents-interface {
    @apply flex flex-col h-full;
}

.toolbar-container {
    @apply bg-surface-0 dark:bg-surface-900 border-b border-surface-200 dark:border-surface-700;
}

.toolbar-header {
    @apply flex items-center justify-between p-4;
}

.page-title {
    @apply text-xl font-semibold text-surface-900 dark:text-surface-0 m-0;
}

.toolbar-actions {
    @apply flex gap-2;
}

.breadcrumbs-container {
    @apply px-4 pb-3;
}

.breadcrumbs {
    @apply p-0;
    background: transparent;
}

.breadcrumb-item {
    @apply text-sm;
}

.breadcrumb-item.clickable {
    @apply cursor-pointer text-primary hover:text-primary-600;
}

.selection-panel {
    @apply flex items-center justify-between px-4 py-2 bg-primary-50 dark:bg-primary-900/20 border-t border-primary-200 dark:border-primary-800;
}

.selection-info {
    @apply text-sm font-medium text-primary-700 dark:text-primary-300;
}

.selection-actions {
    @apply flex gap-2;
}

.documents-table-container {
    @apply flex-1 p-4;
}

.table-card {
    @apply bg-surface-0 dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-700 overflow-hidden;
}

.table-header {
    @apply grid grid-cols-[1fr_120px_100px_160px_120px] gap-4 px-4 py-3 bg-surface-50 dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700;
}

.table-header-cell {
    @apply flex items-center text-sm font-medium text-surface-600 dark:text-surface-300;
}

.table-body {
    @apply divide-y divide-surface-200 dark:divide-surface-700;
}

.table-row {
    @apply grid grid-cols-[1fr_120px_100px_160px_120px] gap-4 px-4 py-3 hover:bg-surface-50 dark:hover:bg-surface-800 cursor-pointer transition-colors;
}

.table-row.selected {
    @apply bg-primary-50 dark:bg-primary-900/20;
}

.table-row.back-row {
    @apply border-b border-surface-200 dark:border-surface-700;
}

.table-row.folder-row {
    @apply font-medium;
}

.table-cell {
    @apply flex items-center text-sm;
}

.select-cell {
    @apply justify-center;
}

.name-cell {
    @apply gap-3;
}

.item-icon {
    @apply text-lg text-primary;
}

.item-name {
    @apply truncate;
}

.type-cell,
.size-cell,
.date-cell {
    @apply text-surface-600 dark:text-surface-300;
}

.actions-cell {
    @apply justify-end;
}

.action-buttons {
    @apply flex gap-1;
}

.empty-state {
    @apply p-8;
}

.empty-state-content {
    @apply text-center;
}

.empty-icon {
    @apply text-4xl text-surface-400 dark:text-surface-500 mb-4;
}

.empty-state h4 {
    @apply text-lg font-semibold text-surface-600 dark:text-surface-300 mb-2;
}

.empty-state p {
    @apply text-surface-500 dark:text-surface-400;
}

/* Адаптивность */
@media (max-width: 1024px) {
    .table-header,
    .table-row {
        @apply grid-cols-[1fr_80px_80px];
    }

    .type-cell,
    .date-cell {
        @apply hidden;
    }
}

@media (max-width: 768px) {
    .toolbar-header {
        @apply flex-col gap-3 items-stretch;
    }

    .toolbar-actions {
        @apply justify-center;
    }

    .table-header,
    .table-row {
        @apply grid-cols-[1fr_80px];
    }

    .size-cell {
        @apply hidden;
    }
}
</style>

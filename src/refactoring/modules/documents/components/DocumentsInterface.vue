<template>
    <div class="documents-interface">
        <!-- Заголовок и панель инструментов -->
        <div class="toolbar-container">
            <div class="toolbar-header">
                <h3 class="page-title">Документы</h3>
                <div class="toolbar-actions">
                    <Button
                        icon="pi pi-filter"
                        :label="
                            documentsStore.hasActiveFilters
                                ? `Фильтры (${documentsStore.activeFiltersCount})`
                                : 'Фильтры'
                        "
                        :severity="documentsStore.hasActiveFilters ? 'primary' : 'secondary'"
                        :outlined="!documentsStore.hasActiveFilters"
                        @click="showFiltersDialog = true"
                    />
                    <Button
                        icon="pi pi-folder-plus"
                        label="Создать папку"
                        severity="secondary"
                        @click="showCreateFolderDialog = true"
                    />
                    <Button
                        icon="pi pi-plus"
                        label="Загрузить документ"
                        :loading="documentsStore.isLoading"
                        :disabled="documentsStore.isLoading"
                        @click="showCreateDocumentDialog = true"
                    />
                </div>
            </div>

            <!-- Поле поиска -->
            <div class="search-container">
                <div class="search-field w-full max-w-80">
                    <IconField iconPosition="left" class="w-full">
                        <InputIcon class="pi pi-search" />
                        <InputText
                            v-model="documentSearch.searchQuery.value"
                            @input="documentSearch.onSearchInput"
                            placeholder="Поиск документов"
                            class="w-full search-input"
                        />
                    </IconField>
                    <Button
                        v-if="documentsStore.isSearchMode"
                        icon="pi pi-times"
                        severity="secondary"
                        text
                        @click="documentSearch.clearSearch"
                        v-tooltip.top="'Очистить поиск'"
                        class="clear-search-btn"
                    />
                </div>

                <!-- Индикатор режима поиска -->
                <div v-if="documentsStore.isSearchMode" class="search-indicator">
                    <i class="pi pi-search text-primary"></i>
                    <span class="search-text">
                        Результаты поиска: "{{ documentsStore.searchQuery }}"
                    </span>
                    <Button
                        label="Вернуться к просмотру папок"
                        severity="secondary"
                        size="small"
                        text
                        @click="documentSearch.clearSearch"
                    />
                </div>

                <!-- Индикатор активных фильтров -->
                <div v-if="documentsStore.hasActiveFilters" class="filters-indicator">
                    <i class="pi pi-filter text-primary"></i>
                    <span class="filters-text">
                        Применены фильтры ({{ documentsStore.activeFiltersCount }})
                    </span>
                    <Button
                        label="Сбросить фильтры"
                        severity="secondary"
                        size="small"
                        text
                        @click="clearFilters"
                    />
                    <Button
                        label="Изменить фильтры"
                        severity="primary"
                        size="small"
                        text
                        @click="showFiltersDialog = true"
                    />
                </div>
            </div>

            <!-- Breadcrumbs (скрываем в режиме поиска) -->
            <div v-if="!documentsStore.isSearchMode" class="breadcrumbs-container">
                <div class="custom-breadcrumbs">
                    <template v-for="(crumb, index) in documentsStore.breadcrumbs" :key="index">
                        <span
                            v-if="index < documentsStore.breadcrumbs.length - 1"
                            @click="documentNavigation.navigateToBreadcrumb(crumb)"
                            class="breadcrumb-item clickable"
                            :title="crumb.name"
                            v-tooltip.top="crumb.name"
                        >
                            {{ documentNavigation.truncateBreadcrumbName(crumb.name) }}
                        </span>
                        <span
                            v-else
                            class="breadcrumb-item current"
                            :title="crumb.name"
                            v-tooltip.top="crumb.name"
                        >
                            {{ documentNavigation.truncateBreadcrumbName(crumb.name) }}
                        </span>

                        <i
                            v-if="index < documentsStore.breadcrumbs.length - 1"
                            class="pi pi-chevron-right breadcrumb-separator"
                        ></i>
                    </template>
                </div>
            </div>
        </div>

        <!-- Основная таблица документов -->
        <div class="documents-table-container">
            <div class="table-card">
                <!-- Заголовок таблицы -->
                <div class="table-header">
                    <div class="table-header-cell name-cell">
                        <button
                            class="sort-button"
                            @click="documentSort.handleSort('name')"
                            :class="documentSort.getSortButtonClass('name')"
                        >
                            <i class="sort-icon" :class="documentSort.getSortIconClass('name')"></i>
                            <span>Название</span>
                        </button>
                    </div>
                    <div class="table-header-cell type-cell">
                        <button
                            class="sort-button"
                            @click="documentSort.handleSort('extension')"
                            :class="documentSort.getSortButtonClass('extension')"
                        >
                            <i
                                class="sort-icon"
                                :class="documentSort.getSortIconClass('extension')"
                            ></i>
                            <span>Тип</span>
                        </button>
                    </div>
                    <div class="table-header-cell size-cell">
                        <button
                            class="sort-button"
                            @click="documentSort.handleSort('size')"
                            :class="documentSort.getSortButtonClass('size')"
                        >
                            <i class="sort-icon" :class="documentSort.getSortIconClass('size')"></i>
                            <span>Размер</span>
                        </button>
                    </div>
                    <div class="table-header-cell date-cell">Дата изменения</div>
                    <div class="table-header-cell actions-cell">Действия</div>
                </div>

                <!-- Строки таблицы -->
                <div class="table-body">
                    <!-- Кнопка "Назад" если не в корне и не в режиме поиска -->
                    <div
                        v-if="!documentsStore.isRootPath && !documentsStore.isSearchMode"
                        class="table-row back-row"
                        @click="documentNavigation.navigateUp"
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
                        @click="documentNavigation.navigateToFolder(folder)"
                    >
                        <div class="table-cell name-cell">
                            <i :class="getDocumentIcon(folder)" class="item-icon"></i>
                            <span class="item-name">{{ folder.name }}</span>
                        </div>
                        <div class="table-cell type-cell">Папка</div>
                        <div class="table-cell size-cell">—</div>
                        <div class="table-cell date-cell">
                            {{ formatDate(folder.updated_at) }}
                        </div>
                        <div class="table-cell actions-cell" @click.stop>
                            <div class="action-buttons">
                                <Button
                                    icon="pi pi-folder-open"
                                    severity="secondary"
                                    text
                                    size="small"
                                    @click="documentNavigation.navigateToFolder(folder)"
                                    v-tooltip.top="'Открыть'"
                                />
                                <Button
                                    icon="pi pi-link"
                                    severity="secondary"
                                    text
                                    size="small"
                                    @click="documentNavigation.copyFolderLink(folder)"
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
                        <div class="table-cell name-cell" @click="downloadDocument(document)">
                            <i :class="getDocumentIcon(document)" class="item-icon"></i>
                            <span class="item-name">{{ document.name }}</span>
                        </div>
                        <div class="table-cell type-cell">
                            {{
                                document.type_name ||
                                getFileTypeByExtension(document.extension || '')
                            }}
                        </div>
                        <div class="table-cell size-cell">
                            {{ formatFileSize(document.size) }}
                        </div>
                        <div class="table-cell date-cell">
                            {{ formatDate(document.updated_at) }}
                        </div>
                        <div class="table-cell actions-cell" @click.stop>
                            <div class="action-buttons">
                                <Button
                                    icon="pi pi-cog"
                                    severity="secondary"
                                    text
                                    size="small"
                                    @click="openEditDocumentDialog(document)"
                                    v-tooltip.top="'Редактировать документ'"
                                />
                            </div>
                        </div>
                    </div>

                    <!-- Сообщение о пустой папке/отсутствии результатов -->
                    <div v-if="documentsStore.currentItems.length === 0" class="empty-state">
                        <div class="empty-state-content">
                            <i
                                :class="
                                    documentsStore.isSearchMode
                                        ? 'pi pi-search'
                                        : 'pi pi-folder-open'
                                "
                                class="empty-icon"
                            ></i>
                            <h4>
                                {{
                                    documentsStore.isSearchMode
                                        ? 'Ничего не найдено'
                                        : 'Папка пуста'
                                }}
                            </h4>
                            <p>
                                {{
                                    documentsStore.isSearchMode
                                        ? 'Попробуйте изменить поисковый запрос'
                                        : 'Создайте новую папку или загрузите документ'
                                }}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Диалог создания папки -->
        <CreateFolderDialog v-model:visible="showCreateFolderDialog" @created="onFolderCreated" />

        <!-- Диалог создания документа -->
        <CreateDocumentDialog
            :visible="showCreateDocumentDialog"
            @update:visible="showCreateDocumentDialog = $event"
            :document-types="documentsStore.documentTypes"
            @created="onDocumentCreated"
        />

        <!-- Диалог добавления версии -->
        <AddVersionDialog
            v-model:visible="showAddVersionDialog"
            :document="selectedDocument"
            @added="onVersionAdded"
        />

        <!-- Диалог редактирования документа -->
        <EditDocumentDialog
            v-model:visible="showEditDocumentDialog"
            :document="selectedDocument"
            @documentDeleted="onDocumentDeleted"
        />

        <!-- Диалог фильтров -->
        <DocumentFiltersDialog
            v-model:visible="showFiltersDialog"
            :document-types="documentsStore.documentTypes"
            :initial-creators="documentsStore.currentFilters.created_by"
            :initial-types="documentsStore.currentFilters.types"
            @apply-filters="handleApplyFilters"
        />

        <!-- Диалог подтверждения удаления -->
        <ConfirmDialog />
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useConfirm } from 'primevue/useconfirm'
import { useDocumentsStore } from '@/refactoring/modules/documents/stores/documentsStore'
import { useFeedbackStore } from '@/refactoring/modules/feedback/stores/feedbackStore'
import { useApiStore } from '@/refactoring/modules/apiStore/stores/apiStore'
import { useDocumentSearch } from '@/refactoring/modules/documents/composables/useDocumentSearch'
import { useDocumentSort } from '@/refactoring/modules/documents/composables/useDocumentSort'
import { useDocumentNavigation } from '@/refactoring/modules/documents/composables/useDocumentNavigation'
import { useErrorHandler } from '@/refactoring/modules/documents/composables/useErrorHandler'
import { ERouteNames } from '@/router/ERouteNames'
import {
    getFileTypeByExtension,
    formatFileSize,
    formatDate,
    getDocumentIcon,
} from '@/refactoring/modules/documents/utils/documentUtils'
import { pathToArray, arrayToPath } from '@/refactoring/modules/documents/utils/pathUtils'
import type {
    IDocument,
    IDocumentFolder,
    IDocumentDetailsResponse,
} from '@/refactoring/modules/documents/types/IDocument'
import CreateFolderDialog from './CreateFolderDialog.vue'
import CreateDocumentDialog from './CreateDocumentDialog.vue'
import AddVersionDialog from './AddVersionDialog.vue'
import EditDocumentDialog from './EditDocumentDialog.vue'
import DocumentFiltersDialog from './DocumentFiltersDialog.vue'
import { BASE_URL } from '@/refactoring/environment/environment'

interface Props {
    path?: string[]
}

const props = withDefaults(defineProps<Props>(), {
    path: () => [],
})

const documentsStore = useDocumentsStore()
const feedbackStore = useFeedbackStore()
const confirm = useConfirm()
const route = useRoute()
const router = useRouter()

const documentSearch = useDocumentSearch()
const documentSort = useDocumentSort()
const documentNavigation = useDocumentNavigation(documentSort)
const { handleError, showSuccess } = useErrorHandler()

const showCreateFolderDialog = ref(false)
const showCreateDocumentDialog = ref(false)

const showAddVersionDialog = ref(false)
const showEditDocumentDialog = ref(false)
const showFiltersDialog = ref(false)
const selectedDocument = ref<IDocument | IDocumentDetailsResponse | null>(null)

const onFolderCreated = async () => {
    showCreateFolderDialog.value = false
    // Обновляем список папок после создания - используем принудительное обновление
    try {
        await documentsStore.forceRefreshDocuments()
    } catch (error) {
        // Fallback на documentSort если основной метод не сработал
        await documentSort.refreshDocuments()
    }
}

const onDocumentCreated = async () => {
    showCreateDocumentDialog.value = false
    // Обновляем список документов после создания - используем принудительное обновление
    try {
        await documentsStore.forceRefreshDocuments()
    } catch (error) {
        // Fallback на documentSort если основной метод не сработал
        await documentSort.refreshDocuments()
    }
}

const onVersionAdded = () => {
    showAddVersionDialog.value = false
    selectedDocument.value = null
}

const onDocumentDeleted = async () => {
    showEditDocumentDialog.value = false
    selectedDocument.value = null
    // Обновляем список после удаления документа - используем принудительное обновление
    try {
        await documentsStore.forceRefreshDocuments()
    } catch (error) {
        // Fallback на documentSort если основной метод не сработал
        await documentSort.refreshDocuments()
    }
}

const openAddVersionDialog = (document: IDocument) => {
    selectedDocument.value = document
    showAddVersionDialog.value = true
}

const openEditDocumentDialog = async (document: IDocument) => {
    try {
        const detailedDocument = await documentsStore.fetchDocumentDetails(document.id)
        selectedDocument.value = detailedDocument
        showEditDocumentDialog.value = true
    } catch (error) {
        selectedDocument.value = document
        showEditDocumentDialog.value = true
    }
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
        accept: async () => {
            try {
                await documentsStore.deleteFolder(folder.id!)
                confirm.close()
            } catch (error) {
                // Ошибка уже обработана в store
            }
        },
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
                // Ошибка уже обработана в store
            }
        },
    })
}

const downloadDocument = (document: IDocument) => {
    const url = document.download_url || document.file_url
    if (!url) {
        handleError(new Error('No download URL'), {
            context: 'DocumentsInterface',
            functionName: 'downloadDocument',
            toastTitle: 'Ошибка',
            toastMessage: 'Не удалось найти ссылку для скачивания документа',
            additionalData: { documentId: document.id },
        })
        return
    }

    try {
        const downloadUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`
        const link = window.document.createElement('a')
        link.href = downloadUrl
        link.download = document.name || 'download'
        link.target = '_blank'

        window.document.body.appendChild(link)
        link.click()
        window.document.body.removeChild(link)

        showSuccess('Успех', 'Скачивание файла началось')
    } catch (error) {
        handleError(error, {
            context: 'DocumentsInterface',
            functionName: 'downloadDocument',
            toastTitle: 'Ошибка',
            toastMessage: 'Не удалось скачать документ',
            additionalData: { documentId: document.id },
        })
    }
}

const initializeFromUrl = async () => {
    try {
        if (props.path && Array.isArray(props.path) && props.path.length > 0) {
            await documentNavigation.initializeFromUrl(props.path)
        } else {
            await documentsStore.fetchDocuments()
        }
    } catch (error) {
        await documentsStore.fetchDocuments()
    }
}

// Обработчики фильтров
const handleApplyFilters = async (filters: { created_by: string[]; types: number[] }) => {
    try {
        await documentsStore.applyFilters(filters)
        showFiltersDialog.value = false
    } catch (error) {
        handleError(error, {
            context: 'DocumentsInterface',
            functionName: 'handleApplyFilters',
            toastTitle: 'Ошибка',
            toastMessage: 'Не удалось применить фильтры',
        })
    }
}

const clearFilters = async () => {
    try {
        await documentsStore.clearFilters()
    } catch (error) {
        handleError(error, {
            context: 'DocumentsInterface',
            functionName: 'clearFilters',
            toastTitle: 'Ошибка',
            toastMessage: 'Не удалось сбросить фильтры',
        })
    }
}

watch(
    () => props.path,
    async (newPath, oldPath) => {
        // Предотвращаем обработку если уже идет навигация
        if (documentsStore.isNavigating) {
            return
        }

        try {
            const targetPath = newPath && newPath.length > 0 ? arrayToPath(newPath) : '/'
            const currentPath = documentsStore.currentPath

            // Проверяем, что путь действительно изменился
            if (targetPath !== currentPath) {
                // Дополнительная проверка - не вызываем фетч, если уже идет навигация
                if (!documentsStore.isNavigating) {
                    // Навигация без обновления URL, так как URL уже изменен
                    await documentsStore.fetchDocuments({ path: targetPath })
                }
            }
        } catch (error) {
            // Игнорируем ошибки в watcher
        }
    },
    { immediate: false, deep: true },
)

onMounted(async () => {
    await documentsStore.fetchDocumentTypes()

    // Загружаем сотрудников для фильтров
    try {
        const apiStore = useApiStore()
        if (apiStore.employees.length === 0) {
            await apiStore.fetchAllEmployees()
        }
    } catch (error) {
        // Не критично, просто фильтры по создателям не будут работать
        console.warn('Не удалось загрузить список сотрудников для фильтров:', error)
    }

    await initializeFromUrl()
})

onUnmounted(() => {
    if (documentsStore.isSearchMode) {
        void documentSearch.clearSearch()
    }
    documentSearch.cleanup()
    documentsStore.cleanup()
})
</script>

<style scoped>
/* Стили для поиска */
.search-container {
    @apply px-4 pb-3 space-y-3;
}

.search-field {
    @apply flex items-center gap-2;
}

.search-input {
    @apply flex-1;
}

.clear-search-btn {
    @apply flex-shrink-0;
}

.search-indicator {
    @apply flex items-center gap-3 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800;
}

.search-text {
    @apply text-sm font-medium text-primary-700 dark:text-primary-300 flex-1;
}

.filters-indicator {
    @apply flex items-center gap-3 p-3 bg-surface-100 dark:bg-surface-800 rounded-lg border border-surface-300 dark:border-surface-600;
}

.filters-text {
    @apply text-sm font-medium text-surface-700 dark:text-surface-300 flex-1;
}

/* Основные стили */
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

.custom-breadcrumbs {
    @apply flex items-center gap-2 text-sm flex-wrap;
}

.breadcrumb-item {
    @apply text-surface-600 dark:text-surface-300 transition-colors whitespace-nowrap;
    max-width: 200px;
}

.breadcrumb-item.clickable {
    @apply cursor-pointer text-primary hover:text-primary-600 hover:underline;
}

.breadcrumb-item.current {
    @apply font-medium text-surface-900 dark:text-surface-0;
}

.breadcrumb-separator {
    @apply text-xs text-surface-400 dark:text-surface-500 mx-1;
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

/* Стили для кнопок сортировки */
.sort-button {
    @apply flex items-center gap-2 text-left w-full border-0 p-0 cursor-pointer transition-colors;
    background: transparent;
    color: inherit;
    font: inherit;
}

.sort-button:hover {
    @apply text-primary;
}

.sort-button.sort-active {
    @apply text-primary;
}

.sort-button span {
    @apply flex-1 text-left;
}

.sort-icon {
    @apply text-xs transition-colors;
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

.name-cell {
    @apply gap-3;
}

.document-row .name-cell {
    @apply cursor-pointer;
}

.document-row .name-cell:hover {
    @apply text-primary;
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

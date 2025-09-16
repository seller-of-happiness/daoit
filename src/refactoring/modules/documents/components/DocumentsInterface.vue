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

            <!-- Поиск документов -->
            <div class="search-container">
                <div class="search-wrapper">
                    <InputGroup class="search-input-group">
                        <InputGroupAddon v-if="searchQuery">
                            <Button
                                icon="pi pi-times"
                                severity="secondary"
                                size="small"
                                :disabled="documentsStore.isLoading"
                                @click="clearSearch"
                                v-tooltip.top="'Очистить поиск'"
                            />
                        </InputGroupAddon>

                        <InputText
                            v-model="searchQuery"
                            placeholder="Поиск документов..."
                            class="search-input"
                            :disabled="documentsStore.isLoading"
                            @keyup.enter="performSearch"
                            @input="onSearchInput"
                        />

                        <InputGroupAddon>
                            <Button
                                icon="pi pi-search"
                                severity="secondary"
                                size="small"
                                :disabled="documentsStore.isLoading"
                                @click="performSearch"
                                v-tooltip.top="'Поиск'"
                            />
                        </InputGroupAddon>
                    </InputGroup>

                    <Button
                        v-if="searchQuery"
                        icon="pi pi-times"
                        label="Сбросить"
                        severity="secondary"
                        size="small"
                        @click="resetSearch"
                        class="reset-search-button"
                    />
                </div>
            </div>

            <!-- Breadcrumbs -->
            <div class="breadcrumbs-container">
                <div class="custom-breadcrumbs">
                    <template v-for="(crumb, index) in documentsStore.breadcrumbs" :key="index">
                        <span
                            v-if="index < documentsStore.breadcrumbs.length - 1"
                            @click="navigateToBreadcrumb(crumb)"
                            class="breadcrumb-item clickable"
                            :title="crumb.name"
                            v-tooltip.top="crumb.name"
                        >
                            {{ truncateBreadcrumbName(crumb.name) }}
                        </span>
                        <span
                            v-else
                            class="breadcrumb-item current"
                            :title="crumb.name"
                            v-tooltip.top="crumb.name"
                        >
                            {{ truncateBreadcrumbName(crumb.name) }}
                        </span>

                        <i
                            v-if="index < documentsStore.breadcrumbs.length - 1"
                            class="pi pi-chevron-right breadcrumb-separator"
                        ></i>
                    </template>
                </div>
            </div>
        </div>

        <!-- Результаты поиска -->
        <div v-if="searchQuery.trim()" class="search-results-info">
            <div class="search-results-header">
                <i class="pi pi-search text-primary mr-2"></i>
                <span>Результаты поиска для: <strong>"{{ searchQuery.trim() }}"</strong></span>
                <span class="search-results-count">
                    (найдено: {{ documentsStore.currentItems.length }})
                </span>
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
                            @click="handleSort('name')"
                            :class="getSortButtonClass('name')"
                        >
                            <i class="sort-icon" :class="getSortIconClass('name')"></i>
                            <span>Название</span>
                        </button>
                    </div>
                    <div class="table-header-cell type-cell">
                        <button
                            class="sort-button"
                            @click="handleSort('extension')"
                            :class="getSortButtonClass('extension')"
                        >
                            <i class="sort-icon" :class="getSortIconClass('extension')"></i>
                            <span>Тип</span>
                        </button>
                    </div>
                    <div class="table-header-cell size-cell">
                        <button
                            class="sort-button"
                            @click="handleSort('size')"
                            :class="getSortButtonClass('size')"
                        >
                            <i class="sort-icon" :class="getSortIconClass('size')"></i>
                            <span>Размер</span>
                        </button>
                    </div>
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
                        <div class="table-cell name-cell" @click="downloadDocument(document)">
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

                    <!-- Сообщение о пустом состоянии -->
                    <div v-if="documentsStore.currentItems.length === 0" class="empty-state">
                        <div class="empty-state-content">
                            <i 
                                :class="searchQuery.trim() ? 'pi pi-search' : 'pi pi-folder-open'"
                                class="empty-icon"
                            ></i>
                            <h4>
                                {{ searchQuery.trim() ? 'Ничего не найдено' : 'Папка пуста' }}
                            </h4>
                            <p>
                                {{ 
                                    searchQuery.trim() 
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

        <!-- Диалог редактирования документа -->
        <EditDocumentDialog
            v-model:visible="showEditDocumentDialog"
            :document="selectedDocument"
            @documentDeleted="onDocumentDeleted"
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
import { ERouteNames } from '@/router/ERouteNames'
import type { IDocument, IDocumentFolder } from '@/refactoring/modules/documents/types/IDocument'
import CreateFolderDialog from './CreateFolderDialog.vue'
import CreateDocumentDialog from './CreateDocumentDialog.vue'
import AddVersionDialog from './AddVersionDialog.vue'
import EditDocumentDialog from './EditDocumentDialog.vue'
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
const showEditDocumentDialog = ref(false)
const selectedDocument = ref<IDocument | null>(null)

// Поиск
const searchQuery = ref<string>('')
const searchTimeout = ref<ReturnType<typeof setTimeout> | null>(null)

// Сортировка
const currentSort = ref<{
    field: 'name' | 'size' | 'extension' | null
    order: 'ascending' | 'descending'
}>({
    field: null,
    order: 'ascending',
})

// Методы сортировки
const handleSort = (field: 'name' | 'size' | 'extension') => {
    if (currentSort.value.field === field) {
        // Если кликнули по тому же полю, меняем порядок
        currentSort.value.order =
            currentSort.value.order === 'ascending' ? 'descending' : 'ascending'
    } else {
        // Если кликнули по новому полю, устанавливаем по возрастанию
        currentSort.value.field = field
        currentSort.value.order = 'ascending'
    }

    // Обновляем данные с новой сортировкой
    refreshDocuments()
}

const getSortButtonClass = (field: string) => {
    return {
        'sort-active': currentSort.value.field === field,
    }
}

const getSortIconClass = (field: string) => {
    if (currentSort.value.field !== field) {
        return 'pi pi-sort-alt text-surface-400'
    }

    return currentSort.value.order === 'ascending'
        ? 'pi pi-sort-up text-primary'
        : 'pi pi-sort-down text-primary'
}

const refreshDocuments = async () => {
    try {
        const payload: any = {}

        if (documentsStore.currentFolderId) {
            payload.folder_id = documentsStore.currentFolderId
        } else {
            payload.path = documentsStore.currentPath
        }

        // Добавляем параметры сортировки, если они установлены
        if (currentSort.value.field) {
            payload.sort_by = currentSort.value.field
            payload.sort_order = currentSort.value.order
        }

        // Добавляем поисковый запрос, если он есть
        if (searchQuery.value.trim()) {
            payload.search = searchQuery.value.trim()
        }

        await documentsStore.fetchDocuments(payload)
    } catch (error) {
        // Error handled in store
    }
}

// Методы поиска
const performSearch = async () => {
    if (searchTimeout.value) {
        clearTimeout(searchTimeout.value)
        searchTimeout.value = null
    }
    
    await refreshDocuments()
}

const onSearchInput = () => {
    // Дебаунс поиска - выполняем поиск через 500мс после остановки ввода
    if (searchTimeout.value) {
        clearTimeout(searchTimeout.value)
    }
    
    searchTimeout.value = setTimeout(() => {
        performSearch()
    }, 500)
}

const clearSearch = async () => {
    searchQuery.value = ''
    await performSearch()
}

const resetSearch = async () => {
    searchQuery.value = ''
    await performSearch()
}

const navigateToBreadcrumb = (crumb: { name: string; path: string; id: string | null }) => {
    if (crumb.id) {
        navigateToFolderId(crumb.id)
    } else {
        navigateToPath(crumb.path)
    }
}

const truncateBreadcrumbName = (name: string, maxLength: number = 30): string => {
    if (name.length <= maxLength) {
        return name
    }
    return name.substring(0, maxLength) + '...'
}

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

const onDocumentDeleted = () => {
    showEditDocumentDialog.value = false
    selectedDocument.value = null
    // Обновляем список документов после удаления
    refreshDocuments()
}

const openAddVersionDialog = (document: IDocument) => {
    selectedDocument.value = document
    showAddVersionDialog.value = true
}

const openEditDocumentDialog = async (document: IDocument) => {
    try {
        // Fetch detailed document information including versions
        const detailedDocument = await documentsStore.fetchDocumentDetails(document.id)
        selectedDocument.value = detailedDocument
        showEditDocumentDialog.value = true
    } catch (error) {
        // Error is already handled in store, but fallback to basic document info
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
        accept: () => {
            return documentsStore.deleteFolder(folder.id!).catch((error) => {
                throw error
            })
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
        const downloadUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`
        const link = window.document.createElement('a')
        link.href = downloadUrl
        link.download = document.name || 'download'
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
        const viewUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`
        console.log(viewUrl)
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
        documentsStore.updateUrl(router)
        // Сброс сортировки и поиска при переходе в папку
        currentSort.value = { field: null, order: 'ascending' }
        searchQuery.value = ''
    } catch (error) {
        // Error handled in store
    }
}

const navigateToPath = async (path: string) => {
    try {
        await documentsStore.navigateToPath(path)
        documentsStore.updateUrl(router)
        // Сброс сортировки и поиска при переходе по пути
        currentSort.value = { field: null, order: 'ascending' }
        searchQuery.value = ''
    } catch (error) {
        // Error handled in store
    }
}

const navigateToFolderId = async (folderId: string) => {
    try {
        await documentsStore.navigateToFolderId(folderId)
        documentsStore.updateUrl(router)
        // Сброс сортировки и поиска при переходе по ID папки
        currentSort.value = { field: null, order: 'ascending' }
        searchQuery.value = ''
    } catch (error) {
        // Error handled in store
    }
}

const navigateUp = async () => {
    try {
        await documentsStore.navigateUp()
        documentsStore.updateUrl(router)
        // Сброс сортировки и поиска при переходе вверх
        currentSort.value = { field: null, order: 'ascending' }
        searchQuery.value = ''
    } catch (error) {
        // Error handled in store
    }
}

const copyFolderLink = (folder: IDocumentFolder) => {
    try {
        let fullUrl: string

        if (folder.path && folder.path !== '/') {
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
                // Сброс сортировки и поиска при изменении пути через URL
                currentSort.value = { field: null, order: 'ascending' }
                searchQuery.value = ''
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
    // Очищаем timeout поиска при размонтировании компонента
    if (searchTimeout.value) {
        clearTimeout(searchTimeout.value)
        searchTimeout.value = null
    }
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

.search-container {
    @apply px-4 pb-3 border-b border-surface-200 dark:border-surface-700;
}

.search-wrapper {
    @apply flex items-center gap-3;
}

.search-input-group {
    @apply flex-1 max-w-md;
}

.search-input {
    @apply flex-1;
}

.reset-search-button {
    @apply ml-2;
}

.search-results-info {
    @apply px-4 py-2 bg-primary-50 dark:bg-primary-900/20 border-b border-primary-200 dark:border-primary-800;
}

.search-results-header {
    @apply flex items-center text-sm text-primary-700 dark:text-primary-300;
}

.search-results-count {
    @apply ml-2 text-surface-600 dark:text-surface-400 font-normal;
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

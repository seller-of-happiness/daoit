/**
 * Composable для управления диалогами документов
 * 
 * Предоставляет общую логику для:
 * - Управления состоянием диалогов создания/редактирования
 * - Обновления данных после операций
 * - Работы с выбранными документами
 */

import { ref, type Ref } from 'vue'
import { useDocumentsStore } from '@/refactoring/modules/documents/stores/documentsStore'
import { useDocumentSort } from './useDocumentSort'
import type {
    IDocument,
    IDocumentDetailsResponse,
} from '@/refactoring/modules/documents/types/IDocument'

export function useDocumentDialogs() {
    const documentsStore = useDocumentsStore()
    const documentSort = useDocumentSort()

    // Состояние диалогов
    const showCreateFolderDialog = ref(false)
    const showCreateDocumentDialog = ref(false)
    const showAddVersionDialog = ref(false)
    const showEditDocumentDialog = ref(false)
    
    // Выбранный документ для операций
    const selectedDocument = ref<IDocument | IDocumentDetailsResponse | null>(null)

    /**
     * Обновляет список документов после операции
     */
    const refreshDocuments = async () => {
        try {
            await documentsStore.forceRefreshDocuments()
        } catch (error) {
            // Fallback на documentSort если основной метод не сработал
            await documentSort.refreshDocuments()
        }
    }

    /**
     * Обработчик создания папки
     */
    const onFolderCreated = async () => {
        showCreateFolderDialog.value = false
        await refreshDocuments()
    }

    /**
     * Обработчик создания документа
     */
    const onDocumentCreated = async () => {
        showCreateDocumentDialog.value = false
        await refreshDocuments()
    }

    /**
     * Обработчик добавления версии
     */
    const onVersionAdded = () => {
        showAddVersionDialog.value = false
        selectedDocument.value = null
    }

    /**
     * Обработчик удаления документа
     */
    const onDocumentDeleted = async () => {
        showEditDocumentDialog.value = false
        selectedDocument.value = null
        await refreshDocuments()
    }

    /**
     * Открывает диалог добавления версии
     */
    const openAddVersionDialog = (document: IDocument) => {
        selectedDocument.value = document
        showAddVersionDialog.value = true
    }

    /**
     * Открывает диалог редактирования документа
     */
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

    /**
     * Закрывает все диалоги и очищает выбранный документ
     */
    const closeAllDialogs = () => {
        showCreateFolderDialog.value = false
        showCreateDocumentDialog.value = false
        showAddVersionDialog.value = false
        showEditDocumentDialog.value = false
        selectedDocument.value = null
    }

    return {
        // Состояние диалогов
        showCreateFolderDialog,
        showCreateDocumentDialog,
        showAddVersionDialog,
        showEditDocumentDialog,
        selectedDocument: selectedDocument as Ref<IDocument | IDocumentDetailsResponse | null>,

        // Обработчики событий
        onFolderCreated,
        onDocumentCreated,
        onVersionAdded,
        onDocumentDeleted,

        // Методы управления диалогами
        openAddVersionDialog,
        openEditDocumentDialog,
        closeAllDialogs,

        // Утилиты
        refreshDocuments,
    }
}
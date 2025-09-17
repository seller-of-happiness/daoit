/**
 * Composable для действий с документами
 * 
 * Предоставляет общую логику для:
 * - Скачивания документов и версий
 * - Просмотра документов
 * - Удаления документов и версий
 * - Работы с подтверждениями
 */

import { useConfirm } from 'primevue/useconfirm'
import { useDocumentsStore } from '@/refactoring/modules/documents/stores/documentsStore'
import { useErrorHandler } from './useErrorHandler'
import { BASE_URL } from '@/refactoring/environment/environment'
import type {
    IDocument,
    IDocumentVersion,
    IDocumentDetailsResponse,
} from '@/refactoring/modules/documents/types/IDocument'

export function useDocumentActions() {
    const documentsStore = useDocumentsStore()
    const confirm = useConfirm()
    const { handleError, showSuccess } = useErrorHandler()

    /**
     * Скачивает документ
     */
    const downloadDocument = (document: IDocument | IDocumentDetailsResponse) => {
        const url = document.download_url || document.file_url
        if (!url) {
            handleError(new Error('No download URL'), {
                context: 'useDocumentActions',
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
                context: 'useDocumentActions',
                functionName: 'downloadDocument',
                toastTitle: 'Ошибка',
                toastMessage: 'Не удалось скачать документ',
                additionalData: { documentId: document.id },
            })
        }
    }

    /**
     * Скачивает версию документа
     */
    const downloadVersion = (version: IDocumentVersion, documentName?: string) => {
        const url = version.download_url || version.file_url || version.file
        if (!url) {
            handleError(new Error('No download URL'), {
                context: 'useDocumentActions',
                functionName: 'downloadVersion',
                toastTitle: 'Ошибка',
                toastMessage: 'Не удалось найти ссылку для скачивания версии',
                additionalData: { versionId: version.id },
            })
            return
        }

        try {
            const downloadUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`
            const link = window.document.createElement('a')
            link.href = downloadUrl
            link.download = `${documentName || 'document'}_v${version.version}` || 'download'
            link.target = '_blank'

            window.document.body.appendChild(link)
            link.click()
            window.document.body.removeChild(link)

            showSuccess('Успех', 'Скачивание версии началось')
        } catch (error) {
            handleError(error, {
                context: 'useDocumentActions',
                functionName: 'downloadVersion',
                toastTitle: 'Ошибка',
                toastMessage: 'Не удалось скачать версию документа',
                additionalData: { versionId: version.id },
            })
        }
    }

    /**
     * Просматривает документ в новом окне
     */
    const viewDocument = (document: IDocument | IDocumentDetailsResponse) => {
        const url = document.file_url || document.download_url
        if (!url) {
            handleError(new Error('No view URL'), {
                context: 'useDocumentActions',
                functionName: 'viewDocument',
                toastTitle: 'Ошибка',
                toastMessage: 'Не удалось найти ссылку для просмотра документа',
                additionalData: { documentId: document.id },
            })
            return
        }

        try {
            const viewUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`
            window.open(viewUrl, '_blank')
        } catch (error) {
            handleError(error, {
                context: 'useDocumentActions',
                functionName: 'viewDocument',
                toastTitle: 'Ошибка',
                toastMessage: 'Не удалось открыть документ для просмотра',
                additionalData: { documentId: document.id },
            })
        }
    }

    /**
     * Подтверждение и удаление документа
     */
    const confirmDeleteDocument = (
        document: IDocument | IDocumentDetailsResponse,
        onSuccess?: () => void
    ) => {
        confirm.require({
            message: `Вы уверены, что хотите удалить документ "${document.name}"? Это действие необратимо.`,
            header: 'Подтверждение удаления',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Удалить',
            rejectLabel: 'Отмена',
            acceptClass: 'p-button-danger',
            accept: async () => {
                try {
                    await documentsStore.deleteDocument(document.id)
                    confirm.close()
                    onSuccess?.()
                } catch (error) {
                    // Ошибка уже обработана в store
                }
            },
        })
    }

    /**
     * Подтверждение и удаление версии документа
     */
    const confirmDeleteVersion = (
        document: IDocument | IDocumentDetailsResponse,
        version: IDocumentVersion,
        onSuccess?: () => void
    ) => {
        confirm.require({
            message: `Вы уверены, что хотите удалить версию ${version.version}?`,
            header: 'Подтверждение удаления',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Удалить',
            rejectLabel: 'Отмена',
            acceptClass: 'p-button-danger',
            accept: async () => {
                try {
                    await documentsStore.deleteDocumentVersion(document.id, version.id)
                    confirm.close()
                    onSuccess?.()
                } catch (error) {
                    // Ошибка уже обработана в store
                }
            },
        })
    }

    return {
        downloadDocument,
        downloadVersion,
        viewDocument,
        confirmDeleteDocument,
        confirmDeleteVersion,
    }
}
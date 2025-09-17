/**
 * Composable для действий с папками
 * 
 * Предоставляет общую логику для:
 * - Удаления папок с подтверждением
 * - Навигации по папкам
 * - Копирования ссылок на папки
 */

import { useConfirm } from 'primevue/useconfirm'
import { useDocumentsStore } from '@/refactoring/modules/documents/stores/documentsStore'
import type { IDocumentFolder } from '@/refactoring/modules/documents/types/IDocument'

export function useFolderActions() {
    const documentsStore = useDocumentsStore()
    const confirm = useConfirm()

    /**
     * Подтверждение и удаление папки
     */
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

    return {
        confirmDeleteFolder,
    }
}
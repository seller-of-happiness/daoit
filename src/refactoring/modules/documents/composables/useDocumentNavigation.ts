/**
 * Composable для навигации по документам
 *
 * Предоставляет логику для:
 * - Навигации по папкам
 * - Работы с breadcrumbs
 * - Копирования ссылок
 * - Обработки URL
 */

import { useRouter } from 'vue-router'
import { useDocumentsStore } from '@/refactoring/modules/documents/stores/documentsStore'
import { useFeedbackStore } from '@/refactoring/modules/feedback/stores/feedbackStore'
import { ERouteNames } from '@/router/ERouteNames'
import { pathToArray } from '@/refactoring/modules/documents/utils/pathUtils'
import type { IDocumentFolder } from '@/refactoring/modules/documents/types/IDocument'
import {
    NavigationService,
    type IBreadcrumb,
} from '@/refactoring/modules/documents/services/NavigationService'

export function useDocumentNavigation(documentSort?: any) {
    const router = useRouter()
    const documentsStore = useDocumentsStore()
    const feedbackStore = useFeedbackStore()
    const navigationService = new NavigationService()

    /**
     * Обновляет URL в соответствии с текущим состоянием
     */
    const updateUrl = (): void => {
        navigationService.updateUrl(router, documentsStore.currentPath)
    }

    /**
     * Навигация к папке
     */
    const navigateToFolder = async (folder: IDocumentFolder): Promise<void> => {
        try {
            await documentsStore.navigateToFolder(folder)
            // Сбрасываем сортировку при навигации
            if (documentSort?.resetSort) {
                documentSort.resetSort()
            }
            // Обновляем URL только после успешной навигации
            updateUrl()
        } catch (error) {}
    }

    /**
     * Навигация по пути
     */
    const navigateToPath = async (path: string): Promise<void> => {
        try {
            await documentsStore.navigateToPath(path)
            // Сбрасываем сортировку при навигации
            if (documentSort?.resetSort) {
                documentSort.resetSort()
            }
            // Обновляем URL только после успешной навигации
            updateUrl()
        } catch (error) {}
    }

    /**
     * Навигация по ID папки
     */
    const navigateToFolderId = async (folderId: string): Promise<void> => {
        try {
            await documentsStore.navigateToFolderId(folderId)
            // Сбрасываем сортировку при навигации
            if (documentSort?.resetSort) {
                documentSort.resetSort()
            }
            // Обновляем URL только после успешной навигации
            updateUrl()
        } catch (error) {}
    }

    /**
     * Навигация вверх (к родительской папке)
     */
    const navigateUp = async (): Promise<void> => {
        try {
            await documentsStore.navigateUp()
            // Сбрасываем сортировку при навигации
            if (documentSort?.resetSort) {
                documentSort.resetSort()
            }
            // Обновляем URL только после успешной навигации
            updateUrl()
        } catch (error) {}
    }

    /**
     * Навигация по breadcrumb
     */
    const navigateToBreadcrumb = async (crumb: IBreadcrumb): Promise<void> => {
        if (crumb.id) {
            await navigateToFolderId(crumb.id)
        } else {
            await navigateToPath(crumb.path)
        }
    }

    /**
     * Сокращает имя breadcrumb для отображения
     */
    const truncateBreadcrumbName = (name: string, maxLength: number = 30): string => {
        if (name.length <= maxLength) {
            return name
        }
        return name.substring(0, maxLength) + '...'
    }

    /**
     * Копирует ссылку на папку в буфер обмена
     */
    const copyFolderLink = async (folder: IDocumentFolder): Promise<void> => {
        try {
            let fullUrl: string

            if (folder.path && folder.path !== '/') {
                const pathArray = pathToArray(folder.path)
                const routeParams = {
                    name: ERouteNames.DOCUMENTS_FOLDER,
                    params: { pathMatch: pathArray },
                }
                fullUrl = `${window.location.origin}${router.resolve(routeParams).href}`
            } else {
                fullUrl = `${window.location.origin}${router.resolve({ name: ERouteNames.DOCUMENTS }).href}`
            }

            await copyToClipboard(fullUrl)

            feedbackStore.showToast({
                type: 'success',
                title: 'Успех',
                message: 'Ссылка на папку скопирована в буфер обмена',
                time: 3000,
            })
        } catch (error) {
            feedbackStore.showToast({
                type: 'error',
                title: 'Ошибка',
                message: 'Не удалось скопировать ссылку на папку',
                time: 5000,
            })
        }
    }

    /**
     * Инициализация из URL
     */
    const initializeFromUrl = async (pathArray?: string[]): Promise<void> => {
        try {
            if (pathArray && Array.isArray(pathArray) && pathArray.length > 0) {
                const targetPath = pathArray.join('/')
                await documentsStore.fetchDocuments({ path: targetPath })
            } else {
                await documentsStore.fetchDocuments()
            }
        } catch (error) {
            await documentsStore.fetchDocuments()
        }
    }

    /**
     * Копирует текст в буфер обмена
     */
    const copyToClipboard = async (text: string): Promise<void> => {
        try {
            await navigator.clipboard.writeText(text)
        } catch (error) {
            const textArea = document.createElement('textarea')
            textArea.value = text
            document.body.appendChild(textArea)
            textArea.select()
            document.execCommand('copy')
            document.body.removeChild(textArea)
        }
    }

    /**
     * Проверяет, является ли путь корневым
     */
    const isRootPath = (): boolean => {
        return documentsStore.isRootPath
    }

    /**
     * Получает текущий путь
     */
    const getCurrentPath = (): string => {
        return documentsStore.currentPath
    }

    /**
     * Получает breadcrumbs
     */
    const getBreadcrumbs = (): IBreadcrumb[] => {
        return documentsStore.breadcrumbs
    }

    return {
        // Методы навигации
        navigateToFolder,
        navigateToPath,
        navigateToFolderId,
        navigateUp,
        navigateToBreadcrumb,

        // Утилиты
        truncateBreadcrumbName,
        copyFolderLink,
        initializeFromUrl,
        copyToClipboard,
        updateUrl,

        // Геттеры
        isRootPath,
        getCurrentPath,
        getBreadcrumbs,
    }
}

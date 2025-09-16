/**
 * Сервис для управления навигацией в документах
 * 
 * Отвечает за:
 * - Обновление URL при навигации
 * - Управление breadcrumbs
 * - Кеширование путей папок
 */

import { ERouteNames } from '@/router/ERouteNames'
import { pathToArray } from '@/refactoring/modules/documents/utils/pathUtils'
import type { IDocumentFolder } from '@/refactoring/modules/documents/types/IDocument'

export interface IBreadcrumb {
    name: string
    path: string
    id: string | null
}

export class NavigationService {
    private _urlUpdateTimeout: ReturnType<typeof setTimeout> | null = null

    /**
     * Обновляет breadcrumbs на основе данных из API
     */
    updateBreadcrumbs(
        currentFolder?: IDocumentFolder,
        parentFolders?: IDocumentFolder[],
        virtualPath?: string,
        parentPaths?: string[] | string | null,
        currentPath?: string
    ): IBreadcrumb[] {
        // Всегда начинаем с корневого элемента
        const breadcrumbs: IBreadcrumb[] = [{ name: 'Документы', path: '/', id: null }]

        // Если есть полная цепочка папок из API, используем её
        if (currentFolder && parentFolders) {
            const fullChain = [...parentFolders, currentFolder].filter((folder) => folder.name)
            
            breadcrumbs.push(...fullChain.map((folder) => ({
                name: folder.name,
                path: folder.folder_id || folder.path,
                id: folder.folder_id || null,
            })))
            
            return breadcrumbs
        }

        // Иначе используем virtual_path
        if (!virtualPath || virtualPath === 'Документы' || virtualPath === '/') {
            return breadcrumbs
        }

        // Разделяем virtual_path по слешам
        const folderNames = virtualPath
            .split('/')
            .map((name) => name.trim())
            .filter(Boolean)

        // Нормализуем parentPaths в массив
        let parentPathsArray: string[] = []
        if (Array.isArray(parentPaths)) {
            parentPathsArray = parentPaths
        } else if (typeof parentPaths === 'string') {
            parentPathsArray = [parentPaths]
        }

        // Добавляем каждую папку как отдельный breadcrumb
        folderNames.forEach((folderName, index) => {
            let breadcrumbPath: string

            if (index === folderNames.length - 1) {
                // Для последней (текущей) папки используем реальный путь из API
                breadcrumbPath = currentPath || folderName
            } else if (index < parentPathsArray.length) {
                // Для родительских папок используем соответствующий путь из массива path_parent
                breadcrumbPath = parentPathsArray[index]
            } else {
                // Fallback: составляем путь
                breadcrumbPath = folderNames.slice(0, index + 1).join('/')
            }

            breadcrumbs.push({
                name: folderName,
                path: breadcrumbPath,
                id: null,
            })
        })

        return breadcrumbs
    }

    /**
     * Обновляет URL при навигации
     */
    updateUrl(router: any, currentPath: string): void {
        try {
            const currentPathArray = pathToArray(currentPath)

            if (currentPathArray.length === 0) {
                router.replace({ name: ERouteNames.DOCUMENTS }).catch(() => {})
            } else {
                router.replace({
                    name: ERouteNames.DOCUMENTS_FOLDER,
                    params: { pathMatch: currentPathArray },
                }).catch(() => {})
            }
        } catch (error) {
            // Ignore navigation errors
        }
    }

    /**
     * Очистка ресурсов
     */
    cleanup(): void {
        if (this._urlUpdateTimeout) {
            clearTimeout(this._urlUpdateTimeout)
            this._urlUpdateTimeout = null
        }
    }
}
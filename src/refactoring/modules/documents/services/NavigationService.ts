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
    private _folderPathCache: Map<string, string> = new Map()
    private _urlUpdateTimeout: ReturnType<typeof setTimeout> | null = null

    /**
     * Обновляет breadcrumbs на основе виртуального пути
     */
    updateBreadcrumbsFromVirtualPath(
        virtualPath: string,
        parentPaths?: string[] | string | null,
        currentPath?: string
    ): IBreadcrumb[] {
        // Всегда начинаем с корневого элемента
        const breadcrumbs: IBreadcrumb[] = [{ name: 'Документы', path: '/', id: null }]

        // Если это корень, больше ничего не добавляем
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
            // Обратная совместимость: если пришла строка, делаем массив из одного элемента
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
                // Fallback: пытаемся найти в кеше или составляем путь
                const parentVirtualPath = folderNames.slice(0, index + 1).join('/')
                breadcrumbPath = this._folderPathCache.get(parentVirtualPath) || parentVirtualPath
            }

            breadcrumbs.push({
                name: folderName,
                path: breadcrumbPath,
                id: null,
            })
        })

        // Кешируем все пути из parentPathsArray для будущего использования
        if (parentPathsArray.length > 0) {
            folderNames.forEach((folderName, index) => {
                if (index < parentPathsArray.length) {
                    const virtualPath = folderNames.slice(0, index + 1).join('/')
                    this._folderPathCache.set(virtualPath, parentPathsArray[index])
                }
            })
        }

        return breadcrumbs
    }

    /**
     * Обновляет breadcrumbs на основе цепочки папок из API
     */
    updateFolderChainFromApi(
        currentFolder: IDocumentFolder,
        parentFolders: IDocumentFolder[] = []
    ): IBreadcrumb[] {
        const fullChain = [...parentFolders, currentFolder].filter((folder) => folder.name)

        return [
            { name: 'Документы', path: '/', id: null },
            ...fullChain.map((folder) => ({
                name: folder.name,
                path: folder.folder_id || folder.path,
                id: folder.folder_id || null,
            })),
        ]
    }

    /**
     * Кеширует путь папки
     */
    cacheFolderPath(virtualPath: string, path: string): void {
        this._folderPathCache.set(virtualPath, path)
    }

    /**
     * Получает путь из кеша
     */
    getCachedPath(virtualPath: string): string | undefined {
        return this._folderPathCache.get(virtualPath)
    }

    /**
     * Обновляет URL при навигации
     */
    updateUrl(router: any, currentPath: string): void {
        try {
            const currentRoute = router.currentRoute.value

            if (this._urlUpdateTimeout) {
                clearTimeout(this._urlUpdateTimeout)
            }

            this._urlUpdateTimeout = setTimeout(() => {
                try {
                    const currentPathArray = pathToArray(currentPath)
                    const currentPathMatch = currentRoute.params.pathMatch

                    let needsUpdate = false

                    if (currentPathArray.length === 0) {
                        needsUpdate =
                            currentRoute.name !== ERouteNames.DOCUMENTS || !!currentPathMatch
                    } else {
                        const expectedPathMatch = currentPathArray.join('/')
                        const actualPathMatch = Array.isArray(currentPathMatch)
                            ? currentPathMatch.join('/')
                            : currentPathMatch || ''

                        needsUpdate =
                            currentRoute.name !== ERouteNames.DOCUMENTS_FOLDER ||
                            actualPathMatch !== expectedPathMatch
                    }

                    if (needsUpdate) {
                        if (currentPathArray.length === 0) {
                            router.replace({ name: ERouteNames.DOCUMENTS }).catch((error: any) => {
                                if (error.name !== 'NavigationDuplicated') {
                                    console.warn('Navigation warning:', error)
                                }
                            })
                        } else {
                            router
                                .replace({
                                    name: ERouteNames.DOCUMENTS_FOLDER,
                                    params: { pathMatch: currentPathArray },
                                })
                                .catch((error: any) => {
                                    if (error.name !== 'NavigationDuplicated') {
                                        console.warn('Navigation warning:', error)
                                    }
                                })
                        }
                    }
                } catch (innerError) {
                    // Игнорируем ошибки обновления URL
                }
            }, 100) // Увеличиваем задержку для предотвращения гонки условий
        } catch (error) {
            // Игнорируем ошибки навигации
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
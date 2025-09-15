/**
 * News Store - управление новостями из RSS-лент с интеграцией API
 *
 * Основные функции:
 * - Загрузка новостей из RSS-фидов
 * - Интеграция с API для комментариев и лайков
 * - Локальное кеширование RSS-контента
 * - Обработка ошибок и логирование
 */

import axios from 'axios'
import { defineStore } from 'pinia'
import type { INewsPost } from '@/refactoring/modules/news/types/INewsPost'
import { useFeedbackStore } from '@/refactoring/modules/feedback/stores/feedbackStore'
import { logger } from '@/refactoring/utils/eventLogger'

// RSS-фиды для получения новостей
const RSS_FEEDS: string[] = [
    'https://naked-science.ru/article/category/medicine/feed',
]

// Публичный CORS proxy для обхода ограничений
const getCorsProxyUrl = (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`

// Определяем режим разработки
const isDev = typeof import.meta !== 'undefined' && !!(import.meta as any).env && (import.meta as any).env.DEV

// Базовый URL API
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

/**
 * Генерирует отрицательный ID на основе строки
 * Используется для区分 RSS-постов от возможных локальных постов
 */
const hashToNegativeId = (s: string): number => {
    let hash = 0
    for (let i = 0; i < s.length; i++) {
        hash = (hash << 5) - hash + s.charCodeAt(i)
    }
    const id = Math.abs(hash) % 1_000_000_000
    return -id
}

/**
 * Парсит RSS XML в массив новостных постов
 * @param xmlText - XML-текст RSS-ленты
 * @returns Массив объектов INewsPost
 */
const parseRssXml = (xmlText: string): INewsPost[] => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xmlText, 'application/xml')
    const items = Array.from(doc.getElementsByTagName('item'))

    /**
     * Создает информативное краткое описание из HTML-контента
     */
    const createExcerpt = (html: string): string => {
        if (!html) return ''

        const tempDiv = document.createElement('div')
        tempDiv.innerHTML = html

        // Удаляем ненужные элементы для превью
        const elementsToRemove = tempDiv.querySelectorAll(
            'header, figure, figcaption, h1, [data-block="share"]'
        )
        elementsToRemove.forEach(el => el.remove())

        // Получаем чистый текст
        const text = tempDiv.textContent || ''
        const cleanText = text.replace(/\s+/g, ' ').trim()

        // Создаем информативное описание длиной 250-300 символов
        if (cleanText.length > 300) {
            const lastDotIndex = cleanText.lastIndexOf('.', 300)
            if (lastDotIndex > 200) {
                return cleanText.slice(0, lastDotIndex + 1)
            }
            return cleanText.slice(0, 280) + '...'
        }

        return cleanText
    }

    return items.map((itm) => {
        /**
         * Вспомогательная функция для получения текста по тегу
         */
        const getText = (tag: string): string => {
            const el = itm.getElementsByTagName(tag)[0]
            return el ? el.textContent?.trim() ?? '' : ''
        }

        // Получаем контент из turbo:content (приоритет) или других источников
        let content = ''
        const turboContent = itm.getElementsByTagName('turbo:content')[0]
        if (turboContent && turboContent.textContent) {
            content = turboContent.textContent.trim()
        }

        if (!content) {
            content = getText('description') || getText('content:encoded')
        }

        const link = getText('link')
        const guid = getText('guid') || link || Math.random().toString(36).slice(2)
        const title = getText('title') || 'Без названия'
        const pubDate = getText('pubDate') || ''
        const author = getText('author') || getText('dc:creator') || ''
        const id = hashToNegativeId(guid)

        const post: INewsPost = {
            id,
            title,
            content,
            excerpt: createExcerpt(content),
            created_at: pubDate || new Date().toISOString(),
            author: author || 'RSS',
            link,
            is_liked: false,
            likes_count: 0,
            views_count: 0,
            source: 'rss',
        }

        return post
    })
}

export const useNewsStore = defineStore('newsStore', {
    state: () => ({
        items: [] as INewsPost[],
        nextCursor: null as string | null,
        current: null as INewsPost | null,
        myItems: [] as INewsPost[],
        myNextCursor: null as string | null,
        departmentItems: [] as INewsPost[],
        departmentNextCursor: null as string | null,
        rssCacheTimestamp: 0 as number,
        rssCacheTtlMs: 1000 * 60 * 5, // 5 минут кеширования
    }),

    actions: {
        /**
         * Загружает новости из RSS-лент с обработкой ошибок
         * @param _cursor - Не используется (оставлено для совместимости)
         */
        async fetchNews(_cursor?: string) {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true

            try {
                this.items = await this.fetchRssFeedsIfNeeded()

                // Сортировка по дате (новые сверху)
                this.items.sort((a, b) => {
                    const timeA = a.created_at ? Date.parse(a.created_at) : 0
                    const timeB = b.created_at ? Date.parse(b.created_at) : 0
                    return timeB - timeA
                })

                this.nextCursor = null
            } catch (error) {
                logger.error('fetchRssNews_error', {
                    file: 'newsStore',
                    function: 'fetchNews',
                    condition: `❌ Ошибка загрузки RSS новостей: ${error}`,
                })

                feedbackStore.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: 'Не удалось загрузить новости',
                    time: 5000,
                })
                throw error
            } finally {
                feedbackStore.isGlobalLoading = false
            }
        },

        /**
         * Поиск новости по ID в локальном списке
         */
        async fetchNewsById(id: number) {
            const foundItem = this.items.find((i) => i.id === id)
            this.current = foundItem ?? null
            return this.current
        },

        /**
         * Добавление лайка через API
         * @param id - ID новости (может быть отрицательным для RSS)
         */
        async like(id: number) {
            const feedbackStore = useFeedbackStore()

            try {
                await axios.post(`${API_BASE_URL}/api/news/post/${id}/like/`)

                // Обновляем локальное состояние
                const item = this.items.find((i) => i.id === id)
                if (item) {
                    item.is_liked = true
                    item.likes_count = (item.likes_count || 0) + 1
                }
                if (this.current && this.current.id === id) {
                    this.current.is_liked = true
                    this.current.likes_count = (this.current.likes_count || 0) + 1
                }
            } catch (error) {
                logger.error('likeNews_error', {
                    file: 'newsStore',
                    function: 'like',
                    condition: `❌ Ошибка добавления лайка: ${error}`,
                })

                feedbackStore.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: 'Не удалось поставить лайк',
                    time: 3000,
                })
                throw error
            }
        },

        /**
         * Удаление лайка через API
         * @param id - ID новости (может быть отрицательным для RSS)
         */
        async unlike(id: number) {
            const feedbackStore = useFeedbackStore()

            try {
                await axios.post(`${API_BASE_URL}/api/news/post/${id}/unlike/`)

                // Обновляем локальное состояние
                const item = this.items.find((i) => i.id === id)
                if (item) {
                    item.is_liked = false
                    item.likes_count = Math.max(0, (item.likes_count || 0) - 1)
                }
                if (this.current && this.current.id === id) {
                    this.current.is_liked = false
                    this.current.likes_count = Math.max(0, (this.current.likes_count || 0) - 1)
                }
            } catch (error) {
                logger.error('unlikeNews_error', {
                    file: 'newsStore',
                    function: 'unlike',
                    condition: `❌ Ошибка удаления лайка: ${error}`,
                })

                feedbackStore.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: 'Не удалось убрать лайк',
                    time: 3000,
                })
                throw error
            }
        },

        /**
         * Добавление комментария через API
         * @param id - ID новости (может быть отрицательным для RSS)
         * @param content - Текст комментария
         */
        async addComment(id: number, content: string) {
            const feedbackStore = useFeedbackStore()

            try {
                await axios.post(`${API_BASE_URL}/api/news/post/${id}/comment/`, {
                    content: content.trim()
                })

                // Показываем успешное уведомление
                feedbackStore.showToast({
                    type: 'success',
                    title: 'Успешно',
                    message: 'Комментарий добавлен',
                    time: 3000,
                })
            } catch (error) {
                logger.error('addComment_error', {
                    file: 'newsStore',
                    function: 'addComment',
                    condition: `❌ Ошибка добавления комментария: ${error}`,
                })

                feedbackStore.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: 'Не удалось добавить комментарий',
                    time: 3000,
                })
                throw error
            }
        },

        /**
         * Локальное увеличение счетчика просмотров
         */
        incrementViewsLocally(id: number) {
            const increment = (item: INewsPost | undefined) => {
                if (item) item.views_count += 1
            }

            increment(this.items.find((i) => i.id === id))

            if (this.current && this.current.id === id) {
                increment(this.current)
            }
        },

        /**
         * Загрузка RSS-лент с кешированием, fallback-стратегией и обработкой ошибок
         */
        async fetchRssFeedsIfNeeded(): Promise<INewsPost[]> {
            const feedbackStore = useFeedbackStore()
            const now = Date.now()

            // Используем кеш, если не истек
            if (now - this.rssCacheTimestamp < this.rssCacheTtlMs) {
                return this.items.filter((i) => i.source === 'rss')
            }

            const allPosts: INewsPost[] = []
            const httpClient = axios.create({ timeout: 10000 })

            for (const feed of RSS_FEEDS) {
                const attempts: string[] = []

                // В режиме разработки используем Vite proxy
                if (isDev) {
                    try {
                        const url = new URL(feed)
                        attempts.push(`/rss${url.pathname}${url.search}`)
                    } catch {
                        // ignore
                    }
                }

                // Прямой запрос и fallback через CORS proxy
                attempts.push(feed, getCorsProxyUrl(feed))

                for (const url of attempts) {
                    try {
                        const response = await httpClient.get(url, { responseType: 'text' })
                        const xmlText = typeof response.data === 'string' ? response.data : String(response.data)
                        const parsedPosts = parseRssXml(xmlText)

                        if (parsedPosts.length > 0) {
                            allPosts.push(...parsedPosts)
                            break
                        }
                    } catch (error) {
                        console.warn(`Не удалось загрузить RSS из ${url}:`, error)
                    }
                }
            }

            if (allPosts.length === 0) {
                const errorMsg = 'Не удалось загрузить ни один RSS-фид'
                logger.error('fetchRssFeeds_error', {
                    file: 'newsStore',
                    function: 'fetchRssFeedsIfNeeded',
                    condition: errorMsg,
                })

                feedbackStore.showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: errorMsg,
                    time: 5000,
                })
                throw new Error(errorMsg)
            }

            this.rssCacheTimestamp = now
            return allPosts
        },
    },
})

/*
 * Хранилище для работы с новостями
 *
 * Основные функции:
 * - Загрузка списков новостей (общие, мои, подразделения) с поддержкой cursor-пагинации
 * - Загрузка детальной новости по ID и хранение в current
 * - Управление реакциями: лайк / снятие лайка
 * - Работа с комментариями: добавление комментария
 * - Управление вложениями: загрузка и удаление файлов
 * - CRUD операций над новостями: создание, обновление, удаление
 * - Локальное обновление счётчиков просмотров для улучшения UX
 *
 * Особенности:
 * - Поддерживает разные ленты (общая / мои / подразделение) и хранит их курсоры next
 * - При частичном обновлении (PATCH) синхронизирует данные во всех списках и current
 * - Действия с лайками обновляют локальное состояние для мгновенной обратной связи
 * - Списки могут возвращаться как { results, next } или как простой массив — оба формата поддержаны
 *
 * Используемые типы:
 * - IActualPost — модель новости
 * - ICreateOrUpdateNewsPayload — полезная нагрузка для создания/обновления
 *
 * Конечные точки (ожидаемые):
 * - GET  /api/news/post/                 — общая лента (поддержка cursor)
 * - GET  /api/news/post/my/              — «мои» новости (поддержка cursor)
 * - GET  /api/news/post/department/      — лента подразделения (поддержка cursor)
 * - GET  /api/news/post/{id}/            — детальная новость
 * - POST /api/news/post/                 — создание
 * - PATCH /api/news/post/{id}/           — обновление
 * - DELETE /api/news/post/{id}/          — удаление
 * - POST /api/news/post/{id}/like/       — поставить лайк
 * - POST /api/news/post/{id}/unlike/     — снять лайк
 * - POST /api/news/post/{id}/comment/    — добавить комментарий
 * - POST /api/news/post/{id}/attachments/            — загрузка вложения (multipart/form-data)
 * - DELETE /api/news/post/{id}/attachments/{aid}/    — удаление вложения
 */
import axios from 'axios'
import { defineStore } from 'pinia'
import { BASE_URL } from '@/refactoring/environment/environment'
import type { IActualPost } from '@/refactoring/modules/actual/types/IActualPost'
import type { ICreateOrUpdateActualPayload } from '@/refactoring/modules/actual/types/ICreateOrUpdateActualPayload'

// types moved to separate files under types/

export const useActualStore = defineStore('actualStore', {
    state: () => ({
        items: [] as IActualPost[],
        nextCursor: null as string | null,
        current: null as IActualPost | null,
        myItems: [] as IActualPost[],
        myNextCursor: null as string | null,
        departmentItems: [] as IActualPost[],
        departmentNextCursor: null as string | null,
    }),
    actions: {
        async fetchNews(cursor?: string) {
            const params: Record<string, any> = {}
            if (cursor) params.cursor = cursor
            const res = await axios.get(`${BASE_URL}/api/news/post/`, { params })
            const results = res.data.results ?? res.data
            this.items = cursor ? [...this.items, ...results] : results
            this.nextCursor = res.data.next ?? null
        },
        async fetchMyNews(cursor?: string) {
            const params: Record<string, any> = {}
            if (cursor) params.cursor = cursor
            const res = await axios.get(`${BASE_URL}/api/news/post/my/`, { params })
            const results = res.data.results ?? res.data
            this.myItems = cursor ? [...this.myItems, ...results] : results
            this.myNextCursor = res.data.next ?? null
        },
        async fetchDepartmentNews(cursor?: string) {
            const params: Record<string, any> = {}
            if (cursor) params.cursor = cursor
            const res = await axios.get(`${BASE_URL}/api/news/post/department/`, { params })
            const results = res.data.results ?? res.data
            this.departmentItems = cursor ? [...this.departmentItems, ...results] : results
            this.departmentNextCursor = res.data.next ?? null
        },
        async fetchNewsById(id: number) {
            const res = await axios.get(`${BASE_URL}/api/news/post/${id}/`)
            this.current = res.data
        },
        async like(id: number) {
            await axios.post(`${BASE_URL}/api/news/post/${id}/like/`)
            const item = this.items.find((i: IActualPost) => i.id === id)
            if (item) {
                item.is_liked = true
                item.likes_count += 1
            }
            if (this.current && this.current.id === id) {
                this.current.is_liked = true
                this.current.likes_count += 1
            }
            const myItem = this.myItems.find((i: IActualPost) => i.id === id)
            if (myItem) {
                myItem.is_liked = true
                myItem.likes_count += 1
            }
            const deptItem = this.departmentItems.find((i: IActualPost) => i.id === id)
            if (deptItem) {
                deptItem.is_liked = true
                deptItem.likes_count += 1
            }
        },
        async unlike(id: number) {
            await axios.post(`${BASE_URL}/api/news/post/${id}/unlike/`)
            const item = this.items.find((i: IActualPost) => i.id === id)
            if (item) {
                item.is_liked = false
                item.likes_count = Math.max(0, item.likes_count - 1)
            }
            if (this.current && this.current.id === id) {
                this.current.is_liked = false
                this.current.likes_count = Math.max(0, this.current.likes_count - 1)
            }
            const myItem = this.myItems.find((i: IActualPost) => i.id === id)
            if (myItem) {
                myItem.is_liked = false
                myItem.likes_count = Math.max(0, myItem.likes_count - 1)
            }
            const deptItem = this.departmentItems.find((i: IActualPost) => i.id === id)
            if (deptItem) {
                deptItem.is_liked = false
                deptItem.likes_count = Math.max(0, deptItem.likes_count - 1)
            }
        },
        async addComment(id: number, content: string) {
            await axios.post(`${BASE_URL}/api/news/post/${id}/comment/`, { content })
            await this.fetchNewsById(id)
        },
        async createNews(payload: ICreateOrUpdateActualPayload) {
            const res = await axios.post(`${BASE_URL}/api/news/post/`, payload)
            // Опционально добавляем в начало общего списка
            if (Array.isArray(this.items)) this.items = [res.data, ...this.items]
            return res.data as IActualPost
        },
        async updateNews(id: number, payload: ICreateOrUpdateActualPayload) {
            const res = await axios.patch(`${BASE_URL}/api/news/post/${id}/`, payload)
            if (this.current && this.current.id === id) this.current = res.data
            // Обновляем в списках, если пост присутствует
            const updateInList = (list: IActualPost[]) => {
                const idx = list.findIndex((i) => i.id === id)
                if (idx !== -1) list[idx] = res.data
            }
            updateInList(this.items)
            updateInList(this.myItems)
            updateInList(this.departmentItems)
            return res.data as IActualPost
        },
        async deleteNews(id: number) {
            await axios.delete(`${BASE_URL}/api/news/post/${id}/`)
            this.items = this.items.filter((i: IActualPost) => i.id !== id)
            this.myItems = this.myItems.filter((i: IActualPost) => i.id !== id)
            this.departmentItems = this.departmentItems.filter((i: IActualPost) => i.id !== id)
            if (this.current?.id === id) this.current = null
        },
        async uploadAttachment(id: number, file: File) {
            const formData = new FormData()
            formData.append('file', file)
            await axios.post(`${BASE_URL}/api/news/post/${id}/attachments/`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            })
            await this.fetchNewsById(id)
        },
        async deleteAttachment(id: number, attachmentId: number) {
            await axios.delete(`${BASE_URL}/api/news/post/${id}/attachments/${attachmentId}/`)
            await this.fetchNewsById(id)
        },
        incrementViewsLocally(id: number) {
            const incrementInList = (list: IActualPost[]) => {
                const item = list.find((i: IActualPost) => i.id === id)
                if (item) item.views_count += 1
            }
            if (this.current && this.current.id === id) this.current.views_count += 1
            incrementInList(this.items)
            incrementInList(this.myItems)
            incrementInList(this.departmentItems)
        },
    },
})

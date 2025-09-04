import axios from 'axios'
import { defineStore } from 'pinia'
import { BASE_URL } from '@/refactoring/environment/environment'
import {
    ICreateImprovementPayload,
    IImprovementFilters,
    IImprovementSuggestion,
    IUpdateImprovementPayload,
} from '@/refactoring/modules/improvements/types/IImprovement'

/*
 * Хранилище предложений по улучшению
 *
 * Основные функции:
 * - Загрузка и фильтрация списка предложений (с пагинацией через cursor)
 * - Создание/редактирование/удаление предложений
 * - Голосование (лайк/дизлайк) с мгновенным UX и синхронизацией с сервером
 *
 * Особенности:
 * - Сохраняет локальные голоса пользователя в localStorage
 * - Имеет геттеры для удобного получения количества голосов и проверки возможности голосовать
 * - Синхронизирует быстрые фильтры с параметрами API
 */
export const useImprovementsStore = defineStore('improvementsStore', {
    state: () => ({
        items: [] as IImprovementSuggestion[],
        nextCursor: null as string | null,
        filters: {
            status: [],
            mine: false,
            // my_department удаляем из использования согласно новым правилам фильтрации
            my_department: false,
            to_my_department: false,
        } as IImprovementFilters,
        localVotes: {} as Record<number, number>,
        userVotes: {} as Record<number, -1 | 0 | 1>,
    }),
    getters: {
        /**
         * Возвращает суммарное число голосов: серверные + локальные изменения
         */
        countVotes: (state) => (id: number) => {
            const serverVotes = (state.items.find((i) => i.id === id)?.votes ?? 0) as number
            const local = state.localVotes[id] || 0
            return serverVotes + local
        },
        /**
         * Проверяет, может ли пользователь проголосовать за элемент (ещё не голосовал)
         */
        canVote: (state) => (id: number) => (state.userVotes[id] ?? 0) === 0,
    },
    actions: {
        /** Загружает локальные голоса из localStorage */
        loadVotesFromStorage() {
            try {
                this.localVotes = JSON.parse(localStorage.getItem('improvementsVotes') || '{}')
            } catch {
                this.localVotes = {}
            }
            try {
                this.userVotes = JSON.parse(localStorage.getItem('improvementsUserVotes') || '{}')
            } catch {
                this.userVotes = {}
            }
        },
        /** Сохраняет локальные голоса в localStorage */
        persistVotes() {
            localStorage.setItem('improvementsVotes', JSON.stringify(this.localVotes))
            localStorage.setItem('improvementsUserVotes', JSON.stringify(this.userVotes))
        },
        /**
         * Загружает список предложений с учётом фильтров и курсора пагинации
         */
        async fetchSuggestions(cursor?: string) {
            const params: Record<string, any> = {}
            if (this.filters.status.length) params.status = this.filters.status
            if (this.filters.mine) params.mine = 1
            // Интерпретируем «моего отделения» как адресованные в отделение пользователя
            if (this.filters.my_department) params.to_my_department = 1
            if (this.filters.to_my_department) params.to_my_department = 1
            if (cursor) params.cursor = cursor
            const res = await axios.get(`${BASE_URL}/api/improvements/suggestion/`, { params })
            const results = res.data.results ?? res.data
            this.items = cursor ? [...this.items, ...results] : results
            this.nextCursor = res.data.next ?? null
        },
        /** Создаёт предложение и обновляет список */
        async createSuggestion(payload: ICreateImprovementPayload) {
            await axios.post(`${BASE_URL}/api/improvements/suggestion/`, payload)
            await this.fetchSuggestions()
        },
        /** Обновляет предложение и перечитывает список */
        async updateSuggestion(id: number, payload: Partial<IUpdateImprovementPayload>) {
            await axios.patch(`${BASE_URL}/api/improvements/suggestion/${id}/`, payload)
            await this.fetchSuggestions()
        },
        /** Удаляет предложение и перечитывает список */
        async deleteSuggestion(id: number) {
            await axios.delete(`${BASE_URL}/api/improvements/suggestion/${id}/`)
            await this.fetchSuggestions()
        },
        /** Выполняет голосование с мгновенным UX и синхронизацией */
        async vote(id: number, value: 1 | -1) {
            if (!this.canVote(id)) return
            this.localVotes[id] = (this.localVotes[id] || 0) + value
            this.userVotes[id] = value
            this.persistVotes()
            try {
                await axios.post(`${BASE_URL}/api/improvements/suggestion/${id}/vote/`, { value })
            } finally {
                await this.fetchSuggestions()
            }
        },
        /** Лайк */
        async voteUp(id: number) {
            await this.vote(id, 1)
        },
        /** Дизлайк */
        async voteDown(id: number) {
            await this.vote(id, -1)
        },
    },
})

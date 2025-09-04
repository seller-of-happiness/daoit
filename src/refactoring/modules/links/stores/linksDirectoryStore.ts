import axios from 'axios'
import { defineStore } from 'pinia'
import { BASE_URL } from '@/refactoring/environment/environment'
import { useFeedbackStore } from '@/refactoring/modules/feedback/stores/feedbackStore'
import { logger } from '@/refactoring/utils/eventLogger'
import type {
    IUsefulLink,
    IUsefulLinksStoreState,
} from '@/refactoring/modules/links/types/IUsefulLink'

export const useLinksDirectoryStore = defineStore('linksDirectory', {
    state: (): IUsefulLinksStoreState => ({
        nextUsefulLinksCursor: null,
        links: [],
        filters: { search: '' },
    }),
    getters: {
        // Убираем группировку, просто сортируем по имени
        sortedLinks(state) {
            return state.links.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
        },
    },
    actions: {
        async fetchUsefulLinks(cursor?: string): Promise<void> {
            const feedbackStore = useFeedbackStore()
            feedbackStore.isGlobalLoading = true
            try {
                const params: Record<string, any> = {}
                // Бэкенд ожидает параметр `q` для поиска
                if (this.filters.search) params.q = this.filters.search
                if (cursor) params.cursor = cursor

                const response = await axios.get(`${BASE_URL}/api/links/useful-link/`, { params })
                const results: IUsefulLink[] = response.data.results ?? response.data
                this.links = cursor ? [...this.links, ...results] : results
                this.nextUsefulLinksCursor = response.data.next ?? null
            } catch (error) {
                logger.error('fetchUsefulLinks_error', {
                    file: 'linksDirectoryStore',
                    function: 'fetchUsefulLinks',
                    condition: `❌ Ошибка загрузки полезных ссылок: ${error}`,
                })
                useFeedbackStore().showToast({
                    type: 'error',
                    title: 'Ошибка',
                    message: 'Не удалось загрузить полезные ссылки',
                    time: 7000,
                })
                throw error
            } finally {
                feedbackStore.isGlobalLoading = false
            }
        },

        resetFilters() {
            this.filters.search = ''
            void this.fetchUsefulLinks()
        },
    },
})

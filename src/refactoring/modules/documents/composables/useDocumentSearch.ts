/**
 * Composable для поиска документов
 * 
 * Предоставляет логику для:
 * - Поиска документов с дебаунсом
 * - Управления состоянием поиска
 * - Очистки поиска
 */

import { ref, type Ref } from 'vue'
import { useDocumentsStore } from '@/refactoring/modules/documents/stores/documentsStore'

export interface SearchOptions {
    /** Задержка дебаунса в миллисекундах */
    debounceDelay?: number
    /** Минимальная длина запроса для поиска */
    minLength?: number
}

export function useDocumentSearch(options: SearchOptions = {}) {
    const documentsStore = useDocumentsStore()
    
    const searchQuery = ref('')
    const searchTimeout = ref<ReturnType<typeof setTimeout> | null>(null)

    const defaultOptions = {
        debounceDelay: 300,
        minLength: 3,
    }

    const config = { ...defaultOptions, ...options }

    /**
     * Обработчик ввода в поисковое поле
     */
    const onSearchInput = (event: Event): void => {
        const target = event.target as HTMLInputElement
        const query = target.value.trim()

        searchQuery.value = query

        // Очищаем предыдущий таймер
        if (searchTimeout.value) {
            clearTimeout(searchTimeout.value)
        }

        // Если запрос пустой, сразу очищаем поиск
        if (query.length === 0) {
            clearSearch()
            return
        }

        // Если запрос слишком короткий, не выполняем поиск
        if (query.length < config.minLength) {
            return
        }

        // Устанавливаем новый таймер для дебаунса
        searchTimeout.value = setTimeout(async () => {
            await documentsStore.searchDocuments(query)
        }, config.debounceDelay)
    }

    /**
     * Выполняет поиск немедленно
     */
    const search = async (query?: string): Promise<void> => {
        const searchTerm = query || searchQuery.value

        if (searchTerm.length < config.minLength) {
            return
        }

        await documentsStore.searchDocuments(searchTerm)
    }

    /**
     * Очищает поиск и возвращается к обычному просмотру
     */
    const clearSearch = async (): Promise<void> => {
        // Очищаем таймер
        if (searchTimeout.value) {
            clearTimeout(searchTimeout.value)
            searchTimeout.value = null
        }

        searchQuery.value = ''
        await documentsStore.clearSearch()
    }

    /**
     * Очистка ресурсов
     */
    const cleanup = (): void => {
        if (searchTimeout.value) {
            clearTimeout(searchTimeout.value)
            searchTimeout.value = null
        }
    }

    return {
        // Состояние
        searchQuery: searchQuery as Ref<string>,
        
        // Методы
        onSearchInput,
        search,
        clearSearch,
        cleanup,
        
        // Геттеры из store
        get isSearchMode() {
            return documentsStore.isSearchMode
        },
        
        get storeSearchQuery() {
            return documentsStore.searchQuery
        },
    }
}
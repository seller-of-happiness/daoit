<template>
    <div class="grid grid-cols-12 gap-6">
        <!-- Заголовок + поиск -->
        <div
            class="col-span-12 flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-surface-200 dark:border-surface-700 px-4 md:px-6 py-3"
        >
            <h3 class="text-xl font-semibold text-surface-900 dark:text-surface-0">
                Полезные ссылки
            </h3>
            <div class="flex items-center gap-2 w-full md:w-96">
                <app-inputtext
                    v-model="linksStore.filters.search"
                    placeholder="Поиск по названию или описанию"
                    class="w-full"
                    @keyup.enter="onSearch"
                />
                <Button label="Найти" @click="onSearch" />
                <Button label="Сброс" severity="secondary" outlined @click="onReset" />
            </div>
        </div>

        <!-- Список ссылок -->
        <div class="col-span-12">
            <div
                class="grid gap-4 xl:grid-cols-3 lg:grid-cols-2 md:grid-cols-2 grid-cols-1 md:px-6 md:pt-6 pt-4 px-4"
            >
                <div
                    v-for="link in linksStore.sortedLinks"
                    :key="`link-${link.id}`"
                    class="rounded-xl border border-surface-200 dark:border-surface-800 hover:shadow-md transition-shadow bg-surface-0 dark:bg-surface-900"
                >
                    <a
                        :href="link.url"
                        target="_blank"
                        rel="noopener"
                        class="text-lg font-semibold hover:text-linkHover transition-colors truncate flex gap-4 p-4"
                    >
                        <img
                            v-if="link.logo"
                            :src="withBase(link.logo) || undefined"
                            alt="logo"
                            class="w-12 h-12 rounded object-contain bg-surface-50 dark:bg-surface-800"
                        />
                        <div class="flex-1 min-w-0">
                            <div class="flex items-start justify-between gap-3">
                                {{ link.name }}
                            </div>
                            <p
                                class="mt-2 text-sm text-surface-600 dark:text-surface-300 line-clamp-3"
                            >
                                {{ link.description }}
                            </p>
                        </div>
                    </a>
                </div>
            </div>
        </div>

        <!-- Загрузить еще -->
        <div class="col-span-12 flex justify-center py-4" v-if="linksStore.nextUsefulLinksCursor">
            <Button label="Показать ещё" @click="loadMore" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useLinksDirectoryStore } from '@/refactoring/modules/links/stores/linksDirectoryStore'
import { BASE_URL } from '@/refactoring/environment/environment'

const linksStore = useLinksDirectoryStore()

onMounted(() => {
    void linksStore.fetchUsefulLinks()
})

const onSearch = () => {
    void linksStore.fetchUsefulLinks()
}

const onReset = () => {
    linksStore.resetFilters()
}

const loadMore = () => {
    if (linksStore.nextUsefulLinksCursor) {
        // backend отдаёт абсолютный next, поддержим оба варианта
        const next = linksStore.nextUsefulLinksCursor
        const cursorParam = new URL(next, window.location.origin).searchParams.get('cursor')
        void linksStore.fetchUsefulLinks(cursorParam || next)
    }
}

const withBase = (path: string | null) => {
    if (!path) return null
    if (path.startsWith('http://') || path.startsWith('https://')) return path
    return `${BASE_URL}${path}`
}
</script>

<style scoped>
.line-clamp-3 {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
</style>

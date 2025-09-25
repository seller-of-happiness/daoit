<script setup lang="ts">
/**
 * NewsDetail.vue - Компонент детального просмотра новости
 *
 * Функциональность:
 * - Отображение полного содержимого RSS-новости
 * - Навигация между новостями
 * - Адаптивный дизайн
 */

import { onMounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useNewsStore } from '@/refactoring/modules/news/stores/newsStore'
import { ERouteNames } from '@/router/ERouteNames'

// Инициализация сторов и роутера
const route = useRoute()
const news = useNewsStore()
const { current, items } = storeToRefs(news)

/**
 * Загрузка данных при монтировании компонента
 */
onMounted(async () => {
    const id = Number(route.params.id)
    news.incrementViewsLocally(id) // Увеличиваем счетчик просмотров локально
    await news.fetchNewsById(id) // Загружаем текущую новость

    // Если список новостей пуст, загружаем его
    if (!items.value?.length) {
        void news.fetchNews()
    }
})

/**
 * Текущий пост новости
 */
const post = computed(() => current.value)

/**
 * Индекс текущего поста в общем списке
 */
const currentIndex = computed(() =>
    items.value.findIndex((i) => i.id === (post.value?.id || -1))
)

/**
 * Предыдущий пост в списке (для навигации)
 */
const prevPost = computed(() =>
    currentIndex.value > 0 ? items.value[currentIndex.value - 1] : null
)

/**
 * Следующий пост в списке (для навигации)
 */
const nextPost = computed(() =>
    currentIndex.value >= 0 && currentIndex.value < items.value.length - 1
        ? items.value[currentIndex.value + 1]
        : null
)

/**
 * Форматированный контент с заменой переносов строк на <br>
 */
const formattedContent = computed(() =>
    (post.value?.content || '').replace(/\n/g, '<br/>')
)

/**
 * Наблюдатель за изменением ID в URL для обновления контента без перезагрузки
 */
watch(
    () => route.params.id,
    async (newId: string | string[] | undefined, oldId: string | string[] | undefined) => {
        if (newId && newId !== oldId) {
            const id = Number(Array.isArray(newId) ? newId[0] : newId)
            if (!Number.isNaN(id)) {
                await news.fetchNewsById(id)
                window.scrollTo({ top: 0, behavior: 'smooth' }) // Скролл к верху
            }
        }
    }
)
</script>

<template>
    <div class="grid grid-cols-12 gap-6">
        <div class="col-span-12 card p-6 flex flex-col gap-4">
            <!-- Заголовок новости -->
            <h2 class="text-2xl font-bold">{{ post?.title }}</h2>

            <!-- Автор новости -->
            <div class="text-surface-600 dark:text-surface-300">
                Автор: <span class="italic opacity-70">{{ post?.author }}</span>
            </div>

            <!-- Содержимое новости с HTML-разметкой -->
            <div class="prose prose-sm dark:prose-invert" v-html="formattedContent"></div>

            <!-- Навигация по соседним новостям -->
            <div v-if="prevPost || nextPost" class="news-navigation grid grid-cols-12 gap-4">
                <router-link
                    v-if="prevPost"
                    :to="{ name: ERouteNames.NEWS_DETAIL, params: { id: prevPost?.id } }"
                    class="col-span-12 md:col-span-6 card p-4 flex items-center gap-3 transition-all duration-200 hover:shadow-lg"
                >
                    <i class="pi pi-arrow-left text-surface-600" />
                    <div class="text-sm flex-1">
                        <div class="text-surface-500 mb-1">Предыдущая новость</div>
                        <div class="font-medium text-surface-900 dark:text-surface-100 line-clamp-2">
                            {{ prevPost?.title }}
                        </div>
                    </div>
                </router-link>

                <router-link
                    v-if="nextPost"
                    :to="{ name: ERouteNames.NEWS_DETAIL, params: { id: nextPost?.id } }"
                    class="col-span-12 md:col-span-6 card p-4 flex items-center gap-3 transition-all duration-200 md:justify-end hover:shadow-lg"
                    :class="{ 'md:col-start-7': !prevPost }"
                >
                    <div class="text-sm flex-1 text-right">
                        <div class="text-surface-500 mb-1">Следующая новость</div>
                        <div class="font-medium text-surface-900 dark:text-surface-100 line-clamp-2">
                            {{ nextPost?.title }}
                        </div>
                    </div>
                    <i class="pi pi-arrow-right text-surface-600" />
                </router-link>
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss">
.prose {
    color: var(--text-color);

    :deep(img) {
        max-width: 100%;
        height: auto;
        border-radius: 0.5rem;
        margin: 1rem auto;
        display: block;
    }

    :deep(figure) {
        margin: 1.5rem 0;
        text-align: center;
    }

    :deep(figcaption) {
        font-size: 0.875rem;
        color: #6b7280;
        margin-top: 0.5rem;
        font-style: italic;
    }

    :deep(a) {
        color: #3b82f6;
        text-decoration: underline;

        &:hover {
            color: #2563eb;
        }
    }

    :deep(p) {
        margin-bottom: 1rem;
        line-height: 1.6;
    }

    :deep(header) {
        margin-bottom: 1.5rem;
    }

    :deep(h1) {
        font-size: 1.875rem;
        font-weight: bold;
        margin: 1rem 0;
    }
}

// Стили для навигации между новостями
.news-navigation {
    .card {
        transition: all 0.2s ease;
        cursor: pointer;

        &:hover {
            background-color: var(--primary-color);
            opacity: 0.8;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);

            .dark & {
                background-color: #374151;
            }
        }
    }
}

// Адаптивность для мобильных устройств
@media (max-width: 768px) {
    .news-navigation {
        .card {
            padding: 1rem;

            .text-sm {
                font-size: 0.875rem;
            }
        }
    }

    .prose {
        :deep(h1) {
            font-size: 1.5rem;
        }

        :deep(img) {
            margin: 0.5rem auto;
        }
    }
}
</style>

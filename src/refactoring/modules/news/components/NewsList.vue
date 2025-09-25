<template>
    <div class="grid grid-cols-12 gap-6">
        <div class="col-span-12">
            <h2 class="text-2xl font-bold mb-6">Новости</h2>
        </div>

        <!-- Список новостей -->
        <div class="col-span-12">
            <div class="grid gap-6 grid-cols-1 min-[1500px]:grid-cols-2">
                <!-- Карточка новости - вся кликабельна -->
                <div
                    v-for="post in items"
                    :key="post.id"
                    class="card card--news p-4 flex flex-col gap-3 cursor-pointer"
                    @click="open(post.id)"
                >
                    <!-- Заголовок новости -->
                    <h3 class="text-xl font-semibold line-clamp-2">
                        <router-link
                            :to="{ name: ERouteNames.NEWS_DETAIL, params: { id: post.id } }"
                            class="transition-colors hover:text-linkHover text-surface-900 dark:text-surface-0"
                            @click.stop
                        >
                            {{ post.title }}
                        </router-link>
                    </h3>

                    <!-- Краткое описание новости -->
                    <p class="news-excerpt line-clamp-3">
                        {{ post.excerpt }}
                    </p>

                    <!-- Мета-информация: автор и статистика -->
                    <div class="flex items-center justify-between text-sm text-surface-600 dark:text-surface-300">
                        <span>
                            <i class="pi pi-user mr-1" />
                            <span class="text-surface-900 dark:text-surface-0">
                                {{ post.author }}
                            </span>
                        </span>
                    </div>

                    <!-- Кнопки действий -->
                    <div class="flex justify-between items-center mt-2">
                        <Button
                            size="small"
                            label="Читать"
                            @click.stop="open(post.id)"
                            severity="secondary"
                        />
                    </div>
                </div>
            </div>

            <!-- Кнопка загрузки дополнительных новостей -->
            <div class="flex justify-center py-6" v-if="nextCursor">
                <Button label="Показать ещё" @click="loadMore" icon="pi pi-chevron-down" />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
/**
 * NewsList.vue - Компонент списка новостей
 *
 * - Отображение сетки новостей из RSS-источников
 * - Интерактивные карточки с кликом по всей области
 * - Пагинация и подгрузка дополнительных новостей
 */

import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useNewsStore } from '@/refactoring/modules/news/stores/newsStore'
import { ERouteNames } from '@/router/ERouteNames'

// Инициализация стора и роутера
const news = useNewsStore()
const router = useRouter()

// Получаем данные из стора
const { items, nextCursor } = storeToRefs(news)

/**
 * Загрузка данных при монтировании компонента
 */
onMounted(() => {
    void news.fetchNews()
})

/**
 * Загрузка дополнительных новостей
 */
const loadMore = () => {
    if (nextCursor.value) {
        void news.fetchNews(nextCursor.value)
    }
}

/**
 * Открытие детальной страницы новости
 * @param id - ID новости
 */
const open = (id: number) => {
    router.push({ name: ERouteNames.NEWS_DETAIL, params: { id } })
}
</script>

<style scoped lang="scss">
.card {
    &--news {
        margin-bottom: 0;
        transition: all 0.2s ease;
        cursor: pointer;

        &:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
            background-color: var(--primary-color);


            .text-surface-900,
            .text-surface-600,
            .text-surface-300,
            .text-surface-0 {
                color: white !important;
            }


            .pi {
                color: white !important;
            }


            .p-button-secondary {
                background-color: white !important;
                color: var(--primary-color) !important;
                border-color: white !important;

                &:hover {
                    background-color: #f8fafc !important;
                    color: var(--primary-color) !important;
                }
            }


            .p-button-text {
                color: white !important;

                &:hover {
                    background-color: rgba(255, 255, 255, 0.1) !important;
                }
            }

            .dark & {
                background-color: var(--primary-color);

                .text-surface-900,
                .text-surface-600,
                .text-surface-300,
                .text-surface-0 {
                    color: white !important;
                }

                .pi {
                    color: white !important;
                }
            }
        }
    }
}

.line-clamp-2 {
    display: -webkit-box;
    line-clamp: 2;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.line-clamp-3 {
    display: -webkit-box;
    line-clamp: 3;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    line-height: 1.5;
}

// Стиль для краткого описания новости
.news-excerpt {
    font-size: 0.95rem;
    line-height: 1.6;
    color: #4b5563;

    .dark & {
        color: #d1d5db;
    }
}

// Адаптивность для мобильных устройств
@media (max-width: 768px) {
    .grid-cols-1 {
        grid-template-columns: 1fr;
    }

    .card--news {
        padding: 1rem;

        .text-xl {
            font-size: 1.1rem;
        }
    }

    .flex.justify-between {
        flex-direction: column;
        gap: 0.5rem;
    }
}
</style>

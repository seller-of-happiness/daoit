<script setup lang="ts">
/**
 * NewsDetail.vue - Компонент детального просмотра новости
 *
 * Функциональность:
 * - Отображение полного содержимого RSS-новости
 * - Навигация между новостями
 * - Система комментариев через API
 * - Лайки через API
 * - Адаптивный дизайн
 */

import { onMounted, computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useNewsStore } from '@/refactoring/modules/news/stores/newsStore'
import { ERouteNames } from '@/router/ERouteNames'

// Инициализация сторов и роутера
const route = useRoute()
const news = useNewsStore()
const { current, items } = storeToRefs(news)

// Реактивные переменные
const comment = ref('') // Текст нового комментария
const likedComments = ref<Set<number>>(new Set()) // Множество ID лайкнутых комментариев

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
 * Переключение лайка для текущего поста через API
 */
const toggleLike = () => {
    if (!post.value) return
    void (post.value.is_liked ? news.unlike(post.value.id) : news.like(post.value.id))
}

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

/**
 * Отправка нового комментария через API
 */
const sendComment = async () => {
    if (!post.value || !comment.value.trim()) return
    await news.addComment(post.value.id, comment.value.trim())
    comment.value = '' // Очищаем поле ввода после отправки
}

/**
 * Ответ на комментарий (добавляет имя автора в поле ввода)
 * @param author - Имя автора комментария
 */
const replyTo = (author: string) => {
    const name = (author || '').trim()
    if (!name) return

    // Добавляем имя автора если его еще нет в начале
    if (!comment.value.startsWith(`${name}, `)) {
        comment.value = `${name}, ${comment.value}`.trim()
    }
}

/**
 * Генерация инициалов из полного имени для аватара
 * @param fullName - Полное имя пользователя
 * @returns Инициалы (2 буквы) или fallback символ
 */
const getInitials = (fullName: string | undefined): string => {
    if (!fullName) return '?'
    const parts = fullName.split(' ').filter(Boolean)
    const first = parts[0]?.[0] || ''
    const last = parts[1]?.[0] || ''
    return (first + last).toUpperCase() || fullName[0]?.toUpperCase() || '?'
}

/**
 * Проверка, лайкнут ли комментарий
 * @param id - ID комментария
 * @returns Boolean - лайкнут ли комментарий
 */
const isCommentLiked = (id: number): boolean => likedComments.value.has(id)

/**
 * Переключение лайка для комментария (локальная реализация)
 * @param id - ID комментария
 */
const toggleCommentLike = (id: number) => {
    if (likedComments.value.has(id)) {
        likedComments.value.delete(id)
    } else {
        likedComments.value.add(id)
    }
}
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

            <!-- Статистика и управление лайками -->
            <div class="flex items-center gap-4 text-sm text-surface-600 dark:text-surface-300">
                <span><i class="pi pi-eye mr-1" /> {{ post?.views_count }}</span>
                <span class="flex items-center gap-1">
                    <i class="pi pi-heart" :class="post?.is_liked ? 'text-red-500' : ''" />
                    {{ post?.likes_count }}
                </span>
                <Button
                    size="small"
                    :icon="post?.is_liked ? 'pi pi-heart-fill' : 'pi pi-heart'"
                    text
                    @click="toggleLike"
                    :title="post?.is_liked ? 'Убрать лайк' : 'Поставить лайк'"
                />
            </div>

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

            <Divider />

            <!-- Секция комментариев -->
            <h3 class="text-xl font-semibold m-0">Комментарии</h3>
            <div class="flex flex-col gap-4 max-h-[420px] overflow-y-auto pr-2">
                <div v-for="c in post?.comments || []" :key="c.id" class="flex items-start gap-3">
                    <!-- Аватар автора комментария -->
                    <div
                        class="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden bg-surface-200 dark:bg-surface-700 text-surface-900 dark:text-surface-0 font-semibold select-none"
                    >
                        <img
                            v-if="(c as any).avatar"
                            :src="(c as any).avatar"
                            alt="avatar"
                            class="w-full h-full object-cover"
                        />
                        <span v-else>{{ getInitials(c.author) }}</span>
                    </div>

                    <!-- Карточка комментария -->
                    <div
                        class="relative flex-1 p-3 rounded-lg bg-surface-100 dark:bg-surface-800 shadow-sm"
                    >
                        <!-- Кнопка лайка для комментария -->
                        <button
                            type="button"
                            class="absolute top-2 right-2 text-surface-600 dark:text-surface-300 hover:text-linkHover transition-colors"
                            @click="toggleCommentLike(c.id)"
                            :aria-pressed="isCommentLiked(c.id)"
                            :title="isCommentLiked(c.id) ? 'Убрать лайк' : 'Нравится'"
                        >
                            <i
                                class="pi"
                                :class="
                                    isCommentLiked(c.id) ? 'pi-heart-fill text-red-500' : 'pi-heart'
                                "
                            />
                        </button>

                        <!-- Шапка комментария: автор и время -->
                        <div class="text-sm text-surface-700 dark:text-surface-200 mb-2">
                            <span class="font-medium">{{ c.author }}</span>
                            <span class="opacity-70 text-xs italic ml-2">
                                {{ new Date(c.created_at).toLocaleString() }}</span
                            >
                        </div>

                        <!-- Текст комментария -->
                        <div class="whitespace-pre-line leading-5 mb-2">{{ c.content }}</div>

                        <!-- Кнопка ответа -->
                        <button
                            type="button"
                            class="text-sm text-linkHover hover:underline"
                            @click="replyTo(c.author)"
                        >
                            Ответить
                        </button>
                    </div>
                </div>
            </div>

            <!-- Форма добавления комментария -->
            <div class="flex flex-col sm:flex-row items-stretch sm:items-start gap-2">
                <FloatLabel variant="on" class="flex-1">
                    <Textarea
                        v-model="comment"
                        rows="3"
                        class="w-full"
                        inputId="newsComment"
                        placeholder="Напишите ваш комментарий..."
                        :disabled="!post"
                    />
                </FloatLabel>
                <div class="flex flex-col sm:flex-row items-stretch sm:items-start gap-2 mt-4">
                <Button
                    size="small"
                    label="Отправить"
                    class="w-full sm:w-auto"
                    @click="sendComment"
                    :disabled="!comment.trim() || !post"
                    icon="pi pi-send"
                />
                </div>
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

// Стили для комментариев
.comment-card {
    position: relative;

    .like-button {
        opacity: 0.6;
        transition: opacity 0.2s ease;

        &:hover {
            opacity: 1;
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

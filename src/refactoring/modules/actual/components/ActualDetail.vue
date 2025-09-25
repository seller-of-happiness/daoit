<template>
    <div class="grid grid-cols-12 gap-6">
        <div class="col-span-12 card p-6 flex flex-col gap-4">
            <h2 class="text-2xl font-bold">{{ post?.title }}</h2>
            <!-- Навигация перенесена вниз -->
            <div class="text-surface-600 dark:text-surface-300">
                Автор: <span class="italic opacity-70">{{ post?.author }}</span>
            </div>
            <div class="prose prose-sm dark:prose-invert" v-html="formattedContent"></div>
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
                />
            </div>

            <!-- Навигация по соседним новостям (внизу) -->
            <div v-if="prevPost || nextPost" class="grid grid-cols-12 gap-4 mt-2">
                <router-link
                    v-if="prevPost"
                    :to="{ name: ERouteNames.ACTUAL_DETAIL, params: { id: prevPost?.id } }"
                    class="col-span-12 md:col-span-6 card p-3 flex items-center gap-3 hover:shadow transition-colors duration-200 ease-in-out w-full md:w-auto md:max-w-sm rounded hover:bg-surface-100 dark:hover:bg-surface-700"
                >
                    <i class="pi pi-arrow-left" />
                    <div class="text-sm">
                        <div class="opacity-70">Предыдущая</div>
                        <div class="font-medium break-words whitespace-normal">
                            {{ prevPost?.title }}
                        </div>
                    </div>
                </router-link>
                <router-link
                    v-if="nextPost"
                    :to="{ name: ERouteNames.ACTUAL_DETAIL, params: { id: nextPost?.id } }"
                    class="col-span-12 md:col-span-6 card p-3 flex items-center justify-end gap-3 hover:shadow transition-colors duration-200 ease-in-out w-full md:w-auto md:max-w-sm ml-auto rounded text-right hover:bg-surface-100 dark:hover:bg-surface-700"
                    :class="{ 'md:col-start-7': !prevPost }"
                >
                    <div class="text-sm">
                        <div class="opacity-70">Следующая</div>
                        <div class="font-medium break-words whitespace-normal">
                            {{ nextPost?.title }}
                        </div>
                    </div>
                    <i class="pi pi-arrow-right" />
                </router-link>
            </div>

            <Divider />

            <h3 class="text-xl font-semibold">Вложения</h3>
            <div class="flex flex-col gap-2">
                <div v-if="post?.attachments?.length" class="flex flex-col gap-2">
                    <div
                        v-for="a in post?.attachments || []"
                        :key="a.id"
                        class="flex items-center justify-between border rounded p-2"
                    >
                        <a :href="a.file" target="_blank" class="text-primary">{{
                                fileName(a.file)
                            }}</a>
                        <Button
                            v-if="canManage"
                            size="small"
                            icon="pi pi-trash"
                            severity="danger"
                            text
                            @click="deleteAttachment(a.id)"
                        />
                    </div>
                </div>
                <div v-else class="text-surface-600 dark:text-surface-300">Нет вложений</div>
                <div v-if="canManage" class="flex items-center gap-2">
                    <input
                        ref="fileInputRef"
                        type="file"
                        class="hidden"
                        @change="handleFileChange"
                    />
                    <Button
                        size="small"
                        label="Добавить файл"
                        icon="pi pi-plus"
                        @click="triggerFile"
                    />
                </div>
            </div>

            <div class="flex gap-2" v-if="canManage">
                <Button label="Редактировать" size="small" icon="pi pi-pencil" @click="editPost" />
                <Button
                    label="Удалить"
                    size="small"
                    icon="pi pi-trash"
                    severity="danger"
                    @click="removePost"
                />
            </div>

            <Divider />

            <h3 class="text-xl font-semibold">Комментарии</h3>
            <div class="flex flex-col gap-4 max-h-[420px] overflow-y-auto pr-2">
                <div v-for="c in post?.comments || []" :key="c.id" class="flex items-start gap-3">
                    <!-- Аватар автора -->
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
                        <!-- Кнопка лайка в правом верхнем углу -->
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

                        <!-- Шапка: автор и время -->
                        <div class="text-sm text-surface-700 dark:text-surface-200 mb-2">
                            <span class="font-medium">{{ c.author }}</span>
                            <span class="opacity-70 text-xs italic ml-2">
                                {{ new Date(c.created_at).toLocaleString() }}</span
                            >
                        </div>

                        <!-- Текст комментария -->
                        <div class="whitespace-pre-line leading-5 mb-2">{{ c.content }}</div>

                        <!-- Ссылка Ответить -->
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
            <!-- Поле ввода сообщения перенесено вниз -->
            <div class="flex flex-col sm:flex-row items-stretch sm:items-start gap-2">
                <FloatLabel variant="on" class="flex-1">
                    <Textarea v-model="comment" rows="3" class="w-full" inputId="newsComment" />
                    <label for="newsComment">Сообщение</label>
                </FloatLabel>
                <Button
                    size="small"
                    label="Отправить"
                    class="w-full sm:w-auto"
                    @click="sendComment"
                />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onMounted, computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useActualStore } from '@/refactoring/modules/actual/stores/actualStore'
import { useUserStore } from '@/refactoring/modules/user/stores/userStore'
import { ERouteNames } from '@/router/ERouteNames'

const route = useRoute()
const router = useRouter()
const actual = useActualStore()
const userStore = useUserStore()
const { current, items } = storeToRefs(actual)

const comment = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)
const likedComments = ref<Set<number>>(new Set())

onMounted(async () => {
    const id = Number(route.params.id)
    actual.incrementViewsLocally(id)
    await actual.fetchNewsById(id)
    if (!items.value?.length) void actual.fetchNews()
})

const post = computed(() => current.value)
const currentIndex = computed(() => items.value.findIndex((i) => i.id === (post.value?.id || -1)))
const prevPost = computed(() =>
    currentIndex.value > 0 ? items.value[currentIndex.value - 1] : null,
)
const nextPost = computed(() =>
    currentIndex.value >= 0 && currentIndex.value < items.value.length - 1
        ? items.value[currentIndex.value + 1]
        : null,
)
const formattedContent = computed(() => (post.value?.content || '').replace(/\n/g, '<br/>'))
const toggleLike = () => {
    if (!post.value) return
    void (post.value.is_liked ? actual.unlike(post.value.id) : actual.like(post.value.id))
}
// Обновляем контент при изменении id в URL, чтобы новость менялась без перезагрузки
watch(
    () => route.params.id,
    async (newId: string | string[] | undefined, oldId: string | string[] | undefined) => {
        if (newId && newId !== oldId) {
            const id = Number(Array.isArray(newId) ? newId[0] : newId)
            if (!Number.isNaN(id)) {
                await actual.fetchNewsById(id)
                window.scrollTo({ top: 0, behavior: 'smooth' })
            }
        }
    },
)
const sendComment = async () => {
    if (!post.value || !comment.value.trim()) return
    await actual.addComment(post.value.id, comment.value.trim())
    comment.value = ''
}
const replyTo = (author: string) => {
    const name = (author || '').trim()
    if (!name) return
    // Добавим имя автора в начало сообщения, если его там ещё нет
    if (!comment.value.startsWith(`${name}, `)) {
        comment.value = `${name}, ${comment.value}`.trim()
    }
}
const getInitials = (fullName: string | undefined) => {
    if (!fullName) return '?'
    const parts = fullName.split(' ').filter(Boolean)
    const first = parts[0]?.[0] || ''
    const last = parts[1]?.[0] || ''
    return (first + last).toUpperCase() || fullName[0]?.toUpperCase() || '?'
}
const isCommentLiked = (id: number) => likedComments.value.has(id)
const toggleCommentLike = (id: number) => {
    if (likedComments.value.has(id)) likedComments.value.delete(id)
    else likedComments.value.add(id)
}
const editPost = () => {
    if (!post.value) return
    router.push({ name: ERouteNames.ACTUAL_EDIT, params: { id: post.value.id } })
}
const removePost = async () => {
    if (!post.value) return
    await actual.deleteNews(post.value.id)
    await router.push({ name: ERouteNames.ACTUAL })
}

// Право на редактирование/удаление только у пользователей с правами менеджера
const canManage = computed(() => Boolean(post.value) && Boolean(userStore.user?.is_manager))

const triggerFile = () => fileInputRef.value?.click()
const handleFileChange = async (e: Event) => {
    const input = e.target as HTMLInputElement
    if (!input.files || !input.files[0] || !post.value) return
    await actual.uploadAttachment(post.value.id, input.files[0])
    input.value = ''
}
const deleteAttachment = async (attachmentId: number) => {
    if (!post.value) return
    await actual.deleteAttachment(post.value.id, attachmentId)
}
const fileName = (url: string) => {
    try {
        const parts = url.split('?')[0].split('/')
        return decodeURIComponent(parts[parts.length - 1])
    } catch {
        return 'file'
    }
}
</script>

<template>
    <div class="grid grid-cols-12 gap-6">
        <div class="col-span-12 top flex justify-between">
            <h2 class="text-2xl font-bold mb-4">Актуальное</h2>
            <Button v-if="canCreate" icon="pi pi-plus" label="Создать" @click="createPost" />
        </div>
        <!-- Контейнер контента и фильтров: до 1500px вертикально (фильтр сверху), с >=1500px — горизонтально с фикс. сайдбаром -->
        <div class="col-span-12 flex flex-col min-[1500px]:flex-row min-[1500px]:items-start gap-6">
            <!-- Список новостей -->
            <div class="flex-1 min-w-0 order-2 min-[1500px]:order-1">
                <div class="grid gap-6 grid-cols-1 min-[1500px]:grid-cols-2">
                    <div
                        v-for="post in displayItems"
                        :key="post.id"
                        class="card card--news p-4 flex flex-col gap-3"
                    >
                        <h3 class="text-xl font-semibold line-clamp-2">
                            <router-link
                                :to="{ name: ERouteNames.ACTUAL_DETAIL, params: { id: post.id } }"
                                class="transition-colors hover:text-linkHover text-surface-900 dark:text-surface-0"
                            >
                                {{ post.title }}
                            </router-link>
                        </h3>
                        <p class="text-sm text-surface-600 dark:text-surface-300 line-clamp-3">
                            {{ post.content }}
                        </p>
                        <div
                            class="flex items-center justify-between text-sm text-surface-600 dark:text-surface-300"
                        >
                            <span>
                                <i class="pi pi-user mr-1" />
                                <button
                                    type="button"
                                    class="transition-colors hover:text-linkHover text-surface-900 dark:text-surface-0 underline-offset-2 hover:underline cursor-pointer"
                                    @click="selectAuthorByName(post.author)"
                                >
                                    {{ post.author }}
                                </button>
                            </span>
                            <span class="flex items-center gap-3">
                                <span><i class="pi pi-eye mr-1" /> {{ post.views_count }}</span>
                                <span class="flex items-center gap-1">
                                    <i
                                        class="pi pi-heart"
                                        :class="post.is_liked ? 'text-red-500' : ''"
                                    />
                                    {{ post.likes_count }}
                                </span>
                            </span>
                        </div>
                        <div class="flex justify-between items-center mt-2">
                            <Button size="small" label="Читать" @click="open(post.id)" />
                            <Button
                                size="small"
                                :icon="post.is_liked ? 'pi pi-heart-fill' : 'pi pi-heart'"
                                text
                                @click="toggleLike(post)"
                            />
                        </div>
                    </div>
                </div>
                <div class="flex justify-center py-6" v-if="activeNextCursor">
                    <Button label="Показать ещё" @click="loadMore" />
                </div>
                <!-- Закрываем контейнер списка новостей (flex-1) перед сайдбаром -->
            </div>

            <!-- Сайдбар фильтров фиксированной ширины -->
            <div
                class="w-full min-[1500px]:w-[320px] min-[1500px]:shrink-0 order-1 min-[1500px]:order-2 min-[1500px]:sticky min-[1500px]:top-20"
            >
                <div class="card p-4 flex flex-col gap-4">
                    <h3 class="text-lg font-semibold">Фильтры</h3>
                    <div class="flex flex-col gap-2">
                        <label class="text-sm font-medium">Раздел</label>
                        <div class="flex flex-wrap gap-2">
                            <button
                                type="button"
                                class="px-2 py-1 rounded border border-surface-300 dark:border-surface-700 text-sm uppercase transition-all duration-300"
                                :class="
                                    tab === 'all'
                                        ? 'bg-surface-100 dark:bg-surface-800 text-linkHover'
                                        : 'bg-transparent text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-linkHover'
                                "
                                @click="switchTab('all')"
                            >
                                Все
                            </button>
                            <button
                                type="button"
                                class="px-2 py-1 rounded border border-surface-300 dark:border-surface-700 text-sm uppercase transition-all duration-300"
                                :class="
                                    tab === 'my'
                                        ? 'bg-surface-100 dark:bg-surface-800 text-linkHover'
                                        : 'bg-transparent text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-linkHover'
                                "
                                @click="switchTab('my')"
                            >
                                Мои
                            </button>
                            <button
                                type="button"
                                class="px-2 py-1 rounded border border-surface-300 dark:border-surface-700 text-sm uppercase transition-all duration-300"
                                :class="
                                    tab === 'dept'
                                        ? 'bg-surface-100 dark:bg-surface-800 text-linkHover'
                                        : 'bg-transparent text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-linkHover'
                                "
                                @click="switchTab('dept')"
                            >
                                Моё подразделение
                            </button>
                        </div>
                    </div>

                    <div class="flex flex-col gap-2 mt-2">
                        <FloatLabel variant="on">
                            <Dropdown
                                v-model="selectedAuthorId"
                                :options="employeeOptions"
                                optionLabel="label"
                                optionValue="value"
                                filter
                                filterBy="label"
                                filterPlaceholder="Поиск автора"
                                showClear
                                :inputId="'newsAuthorDropdown'"
                                class="w-full"
                            />
                            <label for="newsAuthorDropdown">Автор</label>
                        </FloatLabel>
                    </div>

                    <div class="flex flex-col gap-2">
                        <FilterDate
                            v-model:date-start="dateFrom"
                            v-model:date-end="dateTo"
                            :withTime="false"
                        />
                    </div>

                    <div class="flex gap-2 mt-5">
                        <Button label="Сбросить" severity="secondary" @click="resetFilters" />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useActualStore } from '@/refactoring/modules/actual/stores/actualStore'
import { useUserStore } from '@/refactoring/modules/user/stores/userStore'
import { useApiStore } from '@/refactoring/modules/apiStore/stores/apiStore'
import { ERouteNames } from '@/router/ERouteNames'
import FilterDate from '@/components/tableFilters/FilterDate.vue'

const actual = useActualStore()
const userStore = useUserStore()
const apiStore = useApiStore()
const { items, nextCursor, myItems, myNextCursor, departmentItems, departmentNextCursor } =
    storeToRefs(actual)
const router = useRouter()

const tab = ref<'all' | 'my' | 'dept'>('all')
const selectedAuthorId = ref<string | null>(null)
const dateFrom = ref<Date | null>(null)
const dateTo = ref<Date | null>(null)

onMounted(() => {
    void Promise.all([
        actual.fetchNews(),
        actual.fetchMyNews(),
        actual.fetchDepartmentNews(),
        apiStore.employees?.length ? Promise.resolve() : apiStore.fetchAllEmployees(),
    ])
})

const activeItems = computed(() =>
    tab.value === 'all' ? items.value : tab.value === 'my' ? myItems.value : departmentItems.value,
)
const employeeOptions = computed(() =>
    (apiStore.employees || [])
        .map((e: any) => {
            const id = e?.id ?? e?.uuid ?? e?.employee_id ?? e?.user_id
            const fullName =
                e?.full_name ??
                e?.fullName ??
                e?.name ??
                [e?.last_name, e?.first_name, e?.middle_name].filter(Boolean).join(' ')
            return {
                label: fullName || 'Без имени',
                value: id != null ? String(id) : undefined,
                raw: e,
            }
        })
        .filter((opt: any) => opt.value !== undefined),
)
const selectedAuthorName = computed(
    () =>
        employeeOptions.value?.find((e: any) => e.value === selectedAuthorId.value)?.label || null,
)
const selectAuthorByName = (name: string | null) => {
    if (!name) return
    const found = employeeOptions.value?.find((e: any) => e.label === name)
    selectedAuthorId.value = found?.value ?? null
    if (tab.value !== 'all') tab.value = 'all'
}
const displayItems = computed(() => {
    const list = activeItems.value
    const from = dateFrom.value
    const to = dateTo.value
    const authorName = selectedAuthorName.value
    return list.filter((post: any) => {
        const createdDate = post.created_at ? new Date(post.created_at) : null
        if (from && createdDate && createdDate < from) return false
        if (to && createdDate && createdDate > to) return false
        if (authorName && post.author !== authorName) return false
        return true
    })
})
const activeNextCursor = computed(() =>
    tab.value === 'all'
        ? nextCursor.value
        : tab.value === 'my'
            ? myNextCursor.value
            : departmentNextCursor.value,
)

const loadMore = () => {
    if (tab.value === 'all' && nextCursor.value) void actual.fetchNews(nextCursor.value)
    if (tab.value === 'my' && myNextCursor.value) void actual.fetchMyNews(myNextCursor.value)
    if (tab.value === 'dept' && departmentNextCursor.value)
        void actual.fetchDepartmentNews(departmentNextCursor.value)
}
const open = (id: number) => {
    router.push({ name: ERouteNames.ACTUAL_DETAIL, params: { id } })
}
const toggleLike = (post: any) => {
    void (post.is_liked ? actual.unlike(post.id) : actual.like(post.id))
}
const switchTab = (t: 'all' | 'my' | 'dept') => {
    tab.value = t
}
const createPost = () => {
    router.push({ name: ERouteNames.ACTUAL_CREATE })
}

const canCreate = computed(() => Boolean(userStore.user?.is_manager))
const resetFilters = () => {
    selectedAuthorId.value = null
    dateFrom.value = null
    dateTo.value = null
}
</script>

<style scoped lang="scss">
.card {
    &--news {
        margin-bottom: 0;
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
}
</style>

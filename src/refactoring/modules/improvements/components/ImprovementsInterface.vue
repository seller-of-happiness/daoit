<template>
    <div class="grid grid-cols-12 gap-6">
        <!-- Top bar -->
        <div class="col-span-12 flex items-center justify-between gap-4">
            <div class="flex items-center gap-3">
                <Dropdown
                    v-model="sortBy"
                    :options="sortOptions"
                    optionLabel="label"
                    optionValue="value"
                    class="w-48"
                />
            </div>
            <Button label="Новое предложение" icon="pi pi-plus" @click="showCreate = true" />
        </div>
        <div class="col-span-12 flex flex-col min-[1500px]:flex-row min-[1500px]:items-start gap-6">
            <!-- List -->
            <div class="flex-1 min-w-0 order-2 min-[1500px]:order-1">
                <div class="card p-4">
                    <div class="space-y-3">
                        <div
                            v-for="item in visibleItems"
                            :key="item.id"
                            class="relative bg-surface-100 dark:bg-surface-800 shadow-sm rounded-lg overflow-hidden"
                        >
                            <div class="flex">
                                <div class="flex-1 p-4">
                                    <div class="flex items-center justify-between mb-1">
                                        <h3
                                            class="text-lg font-semibold text-gray-900 dark:text-gray-100"
                                        >
                                            {{ item.title }}
                                        </h3>
                                        <div class="flex items-center gap-2">
                                            <Tag
                                                :value="getStatusLabel(item.status)"
                                                :severity="getStatusSeverity(item.status)"
                                            />
                                            <Button
                                                icon="pi pi-pencil"
                                                rounded
                                                text
                                                v-if="canEdit(item)"
                                                @click="openEdit(item)"
                                                v-tooltip.bottom="
                                                    canEdit(item)
                                                        ? 'Редактировать'
                                                        : 'Недостаточно прав'
                                                "
                                            />
                                            <Button
                                                icon="pi pi-trash"
                                                rounded
                                                text
                                                severity="danger"
                                                v-if="isCreator(item)"
                                                @click="onDelete(item)"
                                                v-tooltip.bottom="
                                                    isCreator(item)
                                                        ? 'Удалить'
                                                        : 'Можно удалить только своё'
                                                "
                                            />
                                        </div>
                                    </div>
                                    <p class="text-gray-700 dark:text-gray-300 line-clamp-2">
                                        {{ item.text }}
                                    </p>
                                    <div
                                        class="mt-3 flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400"
                                    >
                                        <span class="flex items-center gap-2"
                                            ><i class="pi pi-user"></i>{{ authorName(item) }}</span
                                        >
                                        <span class="flex items-center gap-2"
                                            ><i class="pi pi-calendar"></i
                                            >{{ formatDate(item.created_at || '') }}</span
                                        >
                                        <span
                                            v-if="item.department?.name"
                                            class="flex items-center gap-2"
                                            ><i class="pi pi-building"></i
                                            >{{ item.department?.name }}</span
                                        >
                                        <span v-if="item.answer" class="flex items-center gap-2"
                                            ><i class="pi pi-comment"></i>{{ item.answer }}</span
                                        >
                                    </div>
                                </div>
                                <div
                                    class="w-24 dark:bg-surface-800 flex flex-col items-center justify-center gap-1 border-l border-surface-200 dark:border-surface-700 py-2"
                                >
                                    <Button
                                        icon="pi pi-thumbs-up"
                                        text
                                        :severity="'primary'"
                                        class="focus:ring-0 focus:outline-none focus:border-0"
                                        @click="upvote(item.id)"
                                    />
                                    <div class="font-bold">{{ getVotes(item.id) }}</div>
                                    <Button
                                        icon="pi pi-thumbs-down"
                                        text
                                        :severity="'danger'"
                                        class="focus:ring-0 focus:outline-none focus:border-0"
                                        @click="downvote(item.id)"
                                    />
                                </div>
                            </div>
                        </div>

                        <div
                            v-if="isLoading"
                            class="p-8 text-center text-gray-500 flex items-center justify-center gap-2"
                        >
                            <i class="pi pi-spinner pi-spin" /> Загрузка...
                        </div>
                        <div v-else-if="!visibleItems.length" class="p-8 text-center text-gray-500">
                            Ничего не найдено
                        </div>
                    </div>
                </div>

                <div v-if="nextCursor" class="text-center mt-6">
                    <Button label="Загрузить ещё" outlined @click="loadMore" />
                </div>
            </div>

            <!-- Sidebar filters -->
            <div
                class="w-full min-[1500px]:w-[320px] min-[1500px]:shrink-0 order-1 min-[1500px]:order-2 min-[1500px]:sticky min-[1500px]:top-20"
            >
                <div class="card p-4 flex flex-col gap-4">
                    <div class="flex items-center gap-2 text-sm text-gray-500 mb-3">
                        <i class="pi pi-filter"></i>
                        <span>Фильтры</span>
                    </div>

                    <div class="mb-4">
                        <div class="text-xs uppercase tracking-wider text-gray-500 mb-2">
                            Статусы
                        </div>
                        <div class="flex flex-wrap gap-2">
                            <Button
                                v-for="opt in statusOptions"
                                :key="opt.value ?? 'all'"
                                :label="opt.label"
                                size="small"
                                :outlined="!isStatusActive(opt.value)"
                                :severity="
                                    isStatusActive(opt.value)
                                        ? getStatusSeverity(opt.value as any)
                                        : 'secondary'
                                "
                                @click="toggleStatus(opt.value)"
                            />
                        </div>
                    </div>

                    <div class="mb-2">
                        <div class="text-xs uppercase tracking-wider text-gray-500 mb-2">
                            Быстрые фильтры
                        </div>
                        <div class="flex flex-wrap gap-2">
                            <Button
                                label="Все"
                                size="small"
                                :outlined="quickFilter !== 'all'"
                                :severity="quickFilter === 'all' ? 'primary' : 'secondary'"
                                @click="setQuickFilter('all')"
                            />
                            <Button
                                label="Только мои"
                                size="small"
                                :outlined="quickFilter !== 'mine'"
                                :severity="quickFilter === 'mine' ? 'primary' : 'secondary'"
                                @click="setQuickFilter('mine')"
                            />
                            <Button
                                label="Моего отделения"
                                size="small"
                                :outlined="quickFilter !== 'my_department'"
                                :severity="
                                    quickFilter === 'my_department' ? 'primary' : 'secondary'
                                "
                                @click="setQuickFilter('my_department')"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Create dialog -->
        <ImprovementsCreateDialog
            v-model:visible="showCreate"
            header="Новое предложение"
            :model="form"
            :departments="departments as any"
            @submit="onCreateSubmit"
        />

        <!-- Edit dialog -->
        <ImprovementsEditDialog
            v-model:visible="showEdit"
            :model="editForm"
            :status-options="statusSelectOptions"
            @submit="onEditSubmit"
        />
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useImprovementsStore } from '@/refactoring/modules/improvements/stores/improvementsStore'
import { useApiStore } from '@/refactoring/modules/apiStore/stores/apiStore'
import ImprovementsCreateDialog from '@/refactoring/modules/improvements/components/ImprovementsCreateDialog.vue'
import ImprovementsEditDialog from '@/refactoring/modules/improvements/components/ImprovementsEditDialog.vue'

const improvements = useImprovementsStore()
const apiStore = useApiStore()
const { items, nextCursor, filters } = storeToRefs(improvements)
const quickFilter = ref<'all' | 'mine' | 'my_department'>('all')
const setQuickFilter = (val: 'all' | 'mine' | 'my_department') => {
    quickFilter.value = val
    // синхронизируем с бэкенд-флагами
    filters.value.mine = val === 'mine'
    filters.value.my_department = val === 'my_department'
    filters.value.to_my_department = false
}
const { departments } = storeToRefs(apiStore)

const showCreate = ref(false)
const isLoading = ref(false)
const form = ref<{ title: string; text: string; department: string | null }>({
    title: '',
    text: '',
    department: null,
})
const showEdit = ref(false)
const editForm = ref<{ id: number | null; status: string | null; answer: string | null }>({
    id: null,
    status: null,
    answer: null,
})
const search = ref('')

type SortKey = 'recent' | 'votes'
const sortBy = ref<SortKey>('recent')
const sortOptions = [
    { label: 'Сначала новые', value: 'recent' },
    { label: 'По голосам', value: 'votes' },
]

const statusOptions = [
    { label: 'Новое', value: 'new' },
    { label: 'В работе', value: 'in_progress' },
    { label: 'Отклонено', value: 'rejected' },
    { label: 'Выполнено', value: 'done' },
]
const statusSelectOptions = [
    { label: 'Новое', value: 'new' },
    { label: 'В работе', value: 'in_progress' },
    { label: 'Отклонено', value: 'rejected' },
    { label: 'Выполнено', value: 'done' },
]

// локальные голоса теперь управляет стор
improvements.loadVotesFromStorage()
const getVotes = (id: number) => improvements.countVotes(id)
const upvote = async (id: number) => {
    await improvements.voteUp(id)
}
const downvote = async (id: number) => {
    await improvements.voteDown(id)
}

const onCreateSubmit = async (payload: {
    title: string
    text: string
    department: { id: string }
}) => {
    await improvements.createSuggestion(payload)
    showCreate.value = false
    form.value = { title: '', text: '', department: null }
}

const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
}

const formatDate = (dateString: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    })
}

const formatDateTime = (dateString: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

const isCreator = (row: any) => {
    const user = JSON.parse(localStorage.getItem('user') || 'null')
    if (!user) return false
    return row.created_by?.id ? row.created_by.id === user.id : false
}

const canEdit = (_row: any) => {
    const user = JSON.parse(localStorage.getItem('user') || 'null')
    if (!user) return false
    return Boolean(user?.is_manager)
}

const openEdit = (row: any) => {
    if (!canEdit(row)) return
    editForm.value = { id: row.id, status: row.status, answer: row.answer ?? null }
    showEdit.value = true
}

const onEditSubmit = async (payload: { status: string | null; answer: string }) => {
    if (!editForm.value.id) return
    await improvements.updateSuggestion(editForm.value.id, {
        status: (payload.status ?? undefined) as any,
        answer: payload.answer,
    })
    showEdit.value = false
}

const onDelete = async (row: any) => {
    if (!isCreator(row)) return
    await improvements.deleteSuggestion(row.id)
}

const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
        new: 'Новое',
        in_progress: 'В работе',
        rejected: 'Отклонено',
        done: 'Выполнено',
    }
    return statusMap[status] || status
}

const getStatusSeverity = (status: string) => {
    const severityMap: Record<string, string> = {
        new: 'info',
        in_progress: 'warn',
        rejected: 'danger',
        done: 'success',
    }
    return severityMap[status] || 'info'
}

// Resolve author name from various possible shapes
const authorName = (row: any): string => {
    // Common shapes: created_by is id (number/string), or object with {full_name, name}
    const creator = row?.created_by
    if (!creator && row?.author) return String(row.author)
    if (typeof creator === 'object' && creator) {
        return creator.full_name || creator.name || creator.username || 'Не указан'
    }
    // If id, try find in employees store
    const id = creator != null ? String(creator) : null
    if (id && Array.isArray(apiStore.employees)) {
        const match = (apiStore.employees as any[]).find((e) => {
            const eid = e?.id ?? e?.uuid ?? e?.employee_id ?? e?.user_id
            return eid != null && String(eid) === id
        })
        if (match) {
            const fullName =
                match?.full_name ||
                match?.fullName ||
                match?.name ||
                [match?.last_name, match?.first_name, match?.middle_name].filter(Boolean).join(' ')
            return fullName || 'Не указан'
        }
    }
    return 'Не указан'
}

// Status toggles (store expects array of statuses)
const isStatusActive = (status: string | null) => {
    if (status === null) return filters.value.status.length === 0
    return filters.value.status.includes(status as any)
}
const toggleStatus = (status: string | null) => {
    if (status === null) {
        filters.value.status = []
    } else {
        const idx = filters.value.status.indexOf(status as any)
        if (idx === -1) filters.value.status.push(status as any)
        else filters.value.status.splice(idx, 1)
    }
}

// Watch filters and refetch
watch(
    () => [
        filters.value.status.slice(),
        filters.value.mine,
        filters.value.my_department,
        filters.value.to_my_department,
    ],
    async () => {
        isLoading.value = true
        await improvements.fetchSuggestions()
        isLoading.value = false
    },
    { deep: false },
)

const visibleItems = computed(() => {
    let list = [...items.value]
    // поиск отключен по ТЗ
    // Клиентская фильтрация «Моего отделения»: по department.id элемента = department.id пользователя
    if (filters.value.my_department) {
        const user = JSON.parse(localStorage.getItem('user') || 'null')
        const userDeptId = user?.department?.id ? String(user.department.id).toLowerCase() : null
        if (userDeptId) {
            list = list.filter(
                (i: any) => String(i?.department?.id || '').toLowerCase() === userDeptId,
            )
        } else {
            // если у пользователя нет отдела — показываем пусто (или можно не фильтровать)
            list = []
        }
    }
    if (sortBy.value === 'votes') {
        list.sort((a: any, b: any) => getVotes(b.id) - getVotes(a.id))
    } else {
        list.sort(
            (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
        )
    }
    return list
})

const loadMore = async () => {
    if (!nextCursor.value) return
    isLoading.value = true
    await improvements.fetchSuggestions(nextCursor.value)
    isLoading.value = false
}

onMounted(async () => {
    isLoading.value = true
    await improvements.fetchSuggestions()
    if (!apiStore.departments?.length) {
        await apiStore.fetchAllDepartments()
    }
    if (!apiStore.employees?.length) {
        try {
            if (!apiStore.employees?.length) {
                await apiStore.fetchAllEmployees()
            }
        } catch {}
    }
    isLoading.value = false
})
</script>

<style scoped>
.line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
</style>

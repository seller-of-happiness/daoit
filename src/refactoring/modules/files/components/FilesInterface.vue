<template>
    <div class="grid grid-cols-12 gap-6">
        <!-- Заголовок -->
        <div
            class="col-span-12 flex items-center justify-between border-b border-surface-200 dark:border-surface-700 px-4 md:px-6 py-3"
        >
            <h3 class="text-xl font-semibold text-surface-900 dark:text-surface-0">Файлы</h3>
            <Button icon="pi pi-upload" label="Загрузить файл" @click="uploadVisible = true" />
        </div>

        <!-- Контент -->
        <div class="col-span-12 grid grid-cols-12 gap-6 content-start">
            <div class="col-span-12 xl:col-span-12 space-y-6">
                <!-- Последние файлы -->
                <section>
                    <h4 class="section-title">Последние добавленные</h4>
                    <div class="grid gap-4 grid-cols-1 md:grid-cols-4">
                        <recent-file-card
                            v-for="f in lastFour"
                            :key="`last-${f.id}`"
                            :file="f"
                            @remove="remove"
                        />
                    </div>
                </section>

                <!-- Все файлы с фильтрами -->
                <section>
                    <div
                        class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3"
                    >
                        <h4 class="section-title mb-0">Все файлы</h4>
                        <div class="flex flex-wrap items-center gap-2">
                            <Button
                                :severity="filter === 'my' ? undefined : 'secondary'"
                                text
                                size="small"
                                @click="filter = 'my'"
                                >Мои</Button
                            >
                            <Button
                                :severity="filter === 'department' ? undefined : 'secondary'"
                                text
                                size="small"
                                @click="filter = 'department'"
                                >Моего подразделения</Button
                            >
                            <Button
                                :severity="filter === 'company' ? undefined : 'secondary'"
                                text
                                size="small"
                                @click="filter = 'company'"
                                >Вся компания</Button
                            >
                            <Button
                                :severity="filter === 'all' ? undefined : 'secondary'"
                                text
                                size="small"
                                @click="filter = 'all'"
                                >Все</Button
                            >
                        </div>
                    </div>
                    <files-list-table :files="filteredAll" @remove="remove" />
                </section>

                <!-- Файлы других подразделений -->
                <section>
                    <h4 class="section-title">Файлы других подразделений</h4>
                    <div class="space-y-6">
                        <div
                            v-for="(group, gi) in filesStore.otherDepartments"
                            :key="`grp-${gi}`"
                            class="card p-0"
                        >
                            <div
                                class="px-4 md:px-6 py-3 font-semibold border-b border-surface-200 dark:border-surface-800"
                            >
                                {{ group.department }}
                            </div>
                            <div class="files-grid p-4 md:p-6">
                                <file-card
                                    v-for="f in group.files"
                                    :key="`other-${f.id}`"
                                    :file="f"
                                    hide-remove
                                    @remove="remove"
                                />
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>

        <upload-file-modal v-model:visible="uploadVisible" />
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useFilesStore } from '@/refactoring/modules/files/stores/filesStore'
import FileCard from '@/refactoring/modules/files/components/FileCard.vue'
import UploadFileModal from '@/refactoring/modules/files/components/UploadFileModal.vue'
import FilesListTable from '@/refactoring/modules/files/components/FilesListTable.vue'
import RecentFileCard from '@/refactoring/modules/files/components/RecentFileCard.vue'

const filesStore = useFilesStore()

const uploadVisible = ref(false)
const filter = ref<'my' | 'department' | 'company' | 'all'>('all')

onMounted(() => {
    void filesStore.fetchAllLists()
})

// Последние четыре файла по дате создания
const lastFour = computed(() => {
    const list = filesStore.visibleFiles
        .slice()
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return list.slice(0, 4)
})

// Базовый список с учётом фильтра владельца/подразделения/компании
const baseList = computed(() => {
    let list = filesStore.visibleFiles
    if (filter.value === 'my') {
        // На бэке owner — строка (ФИО/логин); сравнение по owner оставим как есть
        const user = JSON.parse(localStorage.getItem('user') || 'null')
        const fio = user ? `${user.last_name} ${user.first_name} ${user.middle_name}`.trim() : null
        if (fio) list = list.filter((f) => f.owner?.includes(user.last_name))
        else list = list.filter(() => false)
    } else if (filter.value === 'department') {
        const user = JSON.parse(localStorage.getItem('user') || 'null')
        const depName = user?.department?.name
        if (depName) list = list.filter((f) => f.department === depName)
        else list = list.filter(() => false)
    } else if (filter.value === 'company') {
        list = list.filter((f) => f.visibility === 'company' || f.visibility === 'root')
    }
    return list
})

// Итоговый список с учётом фильтра владельца/подразделения/компании
const filteredAll = computed(() => {
    return baseList.value
})

const remove = async (id: number) => {
    await filesStore.deleteFile(id)
}
</script>

<style scoped>
.section-title {
    @apply text-lg font-semibold text-surface-900 dark:text-surface-0 mb-3;
}
.files-grid {
    @apply grid gap-4 xl:grid-cols-4 lg:grid-cols-3 md:grid-cols-2 grid-cols-1;
}
</style>

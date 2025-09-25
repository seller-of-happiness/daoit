<template>
<!--    <div class="grid grid-cols-12 gap-8">
        <div class="card col-span-12">
            <Toolbar class="mb-6">
                <template #end>
                    <Button
                        :disabled="loadingCategories"
                        label="Добавить"
                        severity="info"
                        icon="pi pi-plus"
                        class="mr-2"
                        @click="router.push({ name: 'create-admin-adverse-event-categories' })"
                    />
                </template>
            </Toolbar>
            <DataTable
                :paginator="true"
                :rowsPerPageOptions="[5, 10, 25]"
                :rows="5"
                :value="filteredEventCategories"
                dataKey="id"
                tableStyle="min-width: 50rem"
            >
                <template #empty> Данные отсутствуют </template>
                <Column field="action" style="width: 150px">
                    <template #header>
                        <p class="font-bold">Управление</p>
                    </template>
                    <template #body="{ data }">
                        <div class="flex gap-1">
                            <Button
                                title="удалить"
                                icon="pi pi-trash"
                                outlined
                                rounded
                                severity="danger"
                                size="small"
                                @click="() => deleteAction(data)"
                                :disabled="loadingCategories"
                            />
                            <Button
                                title="редактировать"
                                icon="pi pi-pen-to-square"
                                severity="secondary"
                                size="small"
                                @click="
                                    () =>
                                        router.push({
                                            name: 'edit-admin-adverse-event-categories',
                                            params: { id: data.id },
                                        })
                                "
                                :disabled="loadingCategories"
                            />
                        </div>
                    </template>
                </Column>
                <Column field="number">
                    <template #header>
                        <p class="font-bold mb-0">ID</p>
                    </template>
                    <template #body="{ data }">
                        <Skeleton v-if="loadingCategories"></Skeleton>
                        <div v-else>{{ data.id }}</div>
                    </template>
                </Column>
                <Column field="species">
                    <template #header>
                        <p class="font-bold">Название</p>
                    </template>
                    <template #body="{ data }">
                        <Skeleton v-if="loadingCategories"></Skeleton>
                        <div v-else>{{ data.name }}</div>
                    </template>
                </Column>
                <Column field="description">
                    <template #header>
                        <p class="font-bold">Описание</p>
                    </template>
                    <template #body="{ data }">
                        <Skeleton v-if="loadingCategories"></Skeleton>
                        <div v-else>{{ data.description }}</div>
                    </template>
                </Column>
            </DataTable>
        </div>

        <Toast position="top-center" group="tc" />
        <Dialog
            v-model:visible="deletePopup"
            :style="{ width: '450px' }"
            header="Подтвердите действие"
            :modal="true"
        >
            <div class="flex items-center gap-4">
                <i class="pi pi-exclamation-triangle !text-3xl" />
                <span v-if="selectedElements && !Object.keys(currentElement).length"
                    >Удалить выбранные элементы?</span
                >
                <span v-else>Удалить выбранный элемент?</span>
            </div>
            <template #footer>
                <Button label="No" icon="pi pi-times" text @click="deletePopup = false" />
                <Button
                    label="Yes"
                    icon="pi pi-check"
                    @click="() => confirmDeleteAction({ fetchDelete: deleteEventCategoryById })"
                />
            </template>
        </Dialog>
        <router-view></router-view>
    </div>-->
</template>

<script setup>
/*import { useEventCategoriesStore } from '@/stores/admin/AdverseEventCategories'
import { storeToRefs } from 'pinia'
import { useToast } from 'primevue/usetoast'
import { useRouter } from 'vue-router'
/!*import { useCrudStore } from '@/stores/crud'*!/

const router = useRouter()
const toast = useToast()

const eventCategories = useEventCategoriesStore()
const { deleteEventCategoryById } = eventCategories
const { loadingCategories, filteredEventCategories } = storeToRefs(eventCategories)

/!*const crud = useCrudStore()*!/
const { deleteAction, confirmDeleteAction } = crud
const { selectedElements, currentElement, deletePopup } = storeToRefs(crud)*/
</script>

<style lang="scss" scoped></style>

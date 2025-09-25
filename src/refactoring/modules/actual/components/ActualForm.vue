<template>
    <div class="grid grid-cols-12 gap-6">
        <div class="col-span-12 card p-6 flex flex-col gap-4">
            <h2 class="text-2xl font-bold">
                {{ isEdit ? 'Редактировать новость' : 'Создать новость' }}
            </h2>

            <div class="grid grid-cols-12 gap-4">
                <div class="col-span-12">
                    <FloatLabel variant="on">
                        <InputText
                            id="newsTitle"
                            v-model="title"
                            class="w-full"
                            :invalid="titleError"
                        />
                        <label for="newsTitle">Заголовок</label>
                    </FloatLabel>
                    <small v-if="titleError" class="text-red-500">Укажите заголовок</small>
                </div>
                <div class="col-span-12">
                    <FloatLabel variant="on">
                        <Textarea
                            id="newsContent"
                            v-model="content"
                            rows="10"
                            class="w-full"
                            :invalid="contentError"
                        />
                        <label for="newsContent">Содержимое</label>
                    </FloatLabel>
                    <small v-if="contentError" class="text-red-500">Укажите текст новости</small>
                </div>
            </div>

            <div class="flex gap-2 justify-end">
                <Button label="Отмена" text icon="pi pi-times" @click="goBack" />
                <Button
                    :label="isEdit ? 'Сохранить' : 'Создать'"
                    icon="pi pi-check"
                    @click="submit"
                />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useActualStore } from '@/refactoring/modules/actual/stores/actualStore'
import { ERouteNames } from '@/router/ERouteNames'

const route = useRoute()
const router = useRouter()
const actual = useActualStore()
const { current } = storeToRefs(actual)

const isEdit = computed(() => Boolean(route.params.id))

const title = ref<string>('')
const content = ref<string>('')

const titleError = ref<boolean>(false)
const contentError = ref<boolean>(false)

onMounted(async () => {
    if (isEdit.value) {
        const id = Number(route.params.id)
        if (!Number.isNaN(id)) {
            await actual.fetchNewsById(id)
            if (current.value) {
                title.value = current.value.title ?? ''
                content.value = current.value.content ?? ''
            }
        }
    }
})

const validate = () => {
    titleError.value = !title.value.trim()
    contentError.value = !content.value.trim()
    return !(titleError.value || contentError.value)
}

const submit = async () => {
    if (!validate()) return
    try {
        const payload: Record<string, any> = {
            title: title.value.trim(),
            content: content.value.trim(),
        }
        if (isEdit.value) {
            const id = Number(route.params.id)
            await actual.updateNews(id, payload as any)
            await router.push({ name: ERouteNames.ACTUAL_DETAIL, params: { id } })
        } else {
            const created = await actual.createNews(payload as any)
            await router.push({ name: ERouteNames.ACTUAL_DETAIL, params: { id: created?.id } })
        }
    } catch (e) {
        // no-op: backend errors are expected to be handled globally or by interceptors
    }
}

const goBack = () => {
    if (isEdit.value && current.value?.id) {
        router.push({ name: ERouteNames.ACTUAL_DETAIL, params: { id: current.value.id } })
    } else {
        router.push({ name: ERouteNames.ACTUAL })
    }
}
</script>

<style scoped>
.text-red-500 {
    color: #ef4444;
}
</style>

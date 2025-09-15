<template>
    <Dialog
        :visible="visible"
        @update:visible="onVisibleChange"
        header="Редактировать предложение"
        modal
        :style="{ width: '600px' }"
    >
        <div class="flex flex-col gap-4">
            <div>
                <label class="block font-bold mb-2" for="impr-status">Статус</label>
                <Dropdown
                    id="impr-status"
                    v-model="local.status"
                    :options="statusOptions"
                    optionLabel="label"
                    optionValue="value"
                    class="w-full"
                    showClear
                />
            </div>
            <div>
                <label class="block font-bold mb-2" for="impr-answer">Ответ</label>
                <Textarea id="impr-answer" v-model="local.answer" rows="6" class="w-full" />
            </div>
            <div class="flex justify-end gap-2">
                <Button
                    label="Отмена"
                    text
                    icon="pi pi-times"
                    @click="emit('update:visible', false)"
                />
                <Button label="Сохранить" icon="pi pi-check" @click="onSubmit" />
            </div>
        </div>
    </Dialog>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue'

interface EditModel {
    id: number | null
    status: string | null
    answer: string | null
}

const props = defineProps<{
    model: EditModel
    statusOptions: Array<{ label: string; value: string }>
    visible: boolean
}>()

const emit = defineEmits<{
    (e: 'update:visible', value: boolean): void
    (e: 'submit', payload: { status: string | null; answer: string | null }): void
}>()

const local = reactive<EditModel>({ id: null, status: null, answer: null })

watch(
    () => props.model,
    (val) => {
        local.id = val?.id ?? null
        local.status = val?.status ?? null
        local.answer = val?.answer ?? null
    },
    { immediate: true, deep: true },
)

const statusOptions = computed(() => props.statusOptions || [])

const onSubmit = () => {
    emit('submit', { status: local.status, answer: local.answer ?? '' })
}

const onVisibleChange = (value: boolean) => {
    emit('update:visible', value)
}
</script>

<style scoped></style>

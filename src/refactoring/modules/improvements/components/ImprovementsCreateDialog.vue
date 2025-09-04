<template>
    <Dialog
        :visible="visible"
        @update:visible="onVisibleChange"
        :header="header || 'Новое предложение'"
        modal
        :style="{ width: '700px' }"
    >
        <div class="flex flex-col gap-4">
            <div>
                <label class="block font-bold mb-2" for="impr-title">Заголовок</label>
                <InputText id="impr-title" v-model="local.title" class="w-full" />
            </div>
            <div>
                <label class="block font-bold mb-2" for="impr-text">Текст</label>
                <Textarea id="impr-text" v-model="local.text" rows="8" class="w-full" />
            </div>
            <div>
                <label class="block font-bold mb-2" for="impr-dept">Подразделение</label>
                <Dropdown
                    id="impr-dept"
                    v-model="local.department"
                    :options="departments"
                    optionLabel="name"
                    optionValue="id"
                    placeholder="Выберите подразделение"
                    class="w-full"
                    showClear
                />
            </div>
            <div class="flex justify-end gap-2">
                <Button
                    label="Отмена"
                    text
                    icon="pi pi-times"
                    @click="emit('update:visible', false)"
                />
                <Button label="Создать" icon="pi pi-check" @click="onSubmit" />
            </div>
        </div>
    </Dialog>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'

const props = defineProps<{
    visible: boolean
    header?: string
    model: { title: string; text: string; department: string | null }
    departments: Array<{ id: string; name: string }>
}>()

const emit = defineEmits<{
    (e: 'update:visible', value: boolean): void
    (e: 'submit', payload: { title: string; text: string; department: { id: string } | null }): void
}>()

const local = reactive<{ title: string; text: string; department: string | null }>({
    title: '',
    text: '',
    department: null,
})

watch(
    () => props.model,
    (val) => {
        local.title = val?.title ?? ''
        local.text = val?.text ?? ''
        local.department = (val?.department as any) ?? null
    },
    { immediate: true, deep: true },
)

const onSubmit = () => {
    const deptId = local.department != null ? String(local.department) : null
    emit('submit', {
        title: local.title.trim(),
        text: local.text.trim(),
        department: deptId ? { id: deptId } : (null as any),
    })
}

const onVisibleChange = (value: boolean) => {
    emit('update:visible', value)
}
</script>

<style scoped></style>

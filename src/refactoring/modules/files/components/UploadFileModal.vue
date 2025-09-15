<template>
    <Dialog
        :visible="visible"
        modal
        :draggable="false"
        :closable="!filesStore.isUploading"
        header="Загрузить файл"
        class="w-full md:w-[600px]"
        @update:visible="onUpdateVisible"
    >
        <div class="flex flex-col gap-3">
            <div class="flex flex-col gap-2">
                <label class="text-sm">Название</label>
                <app-inputtext v-model="name" placeholder="Название файла" />
            </div>
            <div class="flex flex-col gap-2">
                <label class="text-sm">Описание</label>
                <app-inputtext
                    v-model="description"
                    placeholder="Краткое описание (необязательно)"
                />
            </div>
            <div class="flex flex-col gap-2">
                <label class="text-sm">Видимость</label>
                <select v-model="visibility" class="p-inputtext p-component">
                    <option value="self">Только мне</option>
                    <option value="department">Моё подразделение</option>
                    <option value="company">Вся компания</option>
                    <option value="root">Корневая папка</option>
                </select>
            </div>
            <div class="flex flex-col gap-2">
                <label class="text-sm">Файл</label>
                <input type="file" class="p-inputtext p-component" @change="onFile" />
            </div>

            <div class="flex justify-end gap-2 mt-2">
                <Button
                    label="Отмена"
                    severity="secondary"
                    text
                    :disabled="filesStore.isUploading"
                    @click="emit('update:visible', false)"
                />
                <Button
                    :label="filesStore.isUploading ? 'Загрузка…' : 'Загрузить'"
                    :disabled="!canSubmit || filesStore.isUploading"
                    @click="upload"
                />
            </div>
        </div>
    </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useFilesStore } from '@/refactoring/modules/files/stores/filesStore'
import type { FileVisibility } from '@/refactoring/modules/files/types/FileVisibility'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ (e: 'update:visible', value: boolean): void }>()

const filesStore = useFilesStore()

const name = ref('')
const description = ref('')
const visibility = ref<FileVisibility>('self')
const file = ref<File | null>(null)

watch(
    () => props.visible,
    (v) => {
        if (!v) {
            name.value = ''
            description.value = ''
            visibility.value = 'self'
            file.value = null
        }
    },
)

const onUpdateVisible = (v: boolean) => emit('update:visible', v)

const onFile = (e: Event) => {
    const input = e.target as HTMLInputElement
    file.value = input.files?.[0] ?? null
}

const canSubmit = computed(() => !!file.value && name.value.trim().length > 0)

const upload = async () => {
    if (!canSubmit.value) return
    await filesStore.uploadFile({
        name: name.value.trim(),
        description: description.value.trim(),
        file: file.value as File,
        visibility: visibility.value,
    })
    emit('update:visible', false)
}
</script>

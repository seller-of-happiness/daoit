<template>
    <Dialog
        v-model:visible="dialogVisible"
        modal
        header="Создать папку"
        :style="{ width: '450px' }"
        @hide="resetForm"
    >
        <form @submit.prevent="handleSubmit" class="create-folder-form">
            <div class="form-field">
                <label for="folderName" class="field-label required">Название папки</label>
                <InputText
                    id="folderName"
                    v-model="form.name"
                    :class="{ 'p-invalid': errors.name }"
                    placeholder="Введите название папки"
                    class="w-full"
                    autofocus
                />
                <small v-if="errors.name" class="p-error">{{ errors.name }}</small>
            </div>

            <div class="form-field">
                <label for="folderVisibility" class="field-label required">Видимость</label>
                <Dropdown
                    id="folderVisibility"
                    v-model="form.visibility"
                    :options="visibilityOptions"
                    option-label="label"
                    option-value="value"
                    placeholder="Выберите уровень видимости"
                    class="w-full"
                />
                <small v-if="errors.visibility" class="p-error">{{ errors.visibility }}</small>
            </div>

            <div class="form-actions">
                <Button
                    type="button"
                    label="Отмена"
                    severity="secondary"
                    @click="dialogVisible = false"
                />
                <Button
                    type="submit"
                    label="Создать"
                    :loading="isLoading"
                    :disabled="!isFormValid"
                />
            </div>
        </form>
    </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useDocumentsStore } from '@/refactoring/modules/documents/stores/documentsStore'
import { useFormValidation } from '@/refactoring/modules/documents/composables/useFormValidation'
import { useErrorHandler } from '@/refactoring/modules/documents/composables/useErrorHandler'

interface Props {
    visible: boolean
}

interface Emits {
    (e: 'update:visible', value: boolean): void
    (e: 'created'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const documentsStore = useDocumentsStore()
const { errors, documentRules, validateForm, clearErrors, hasErrors } = useFormValidation()
const { handleError, showSuccess } = useErrorHandler()

const dialogVisible = computed({
    get: () => props.visible,
    set: (value) => emit('update:visible', value),
})

// Форма
const form = ref({
    name: '',
    visibility: 'creator' as 'creator' | 'public' | 'private' | 'department',
})

const isLoading = ref(false)

// Опции видимости
const visibilityOptions = [
    { label: 'Создатель (только мне)', value: 'creator' },
    { label: 'Публичная (доступна всем)', value: 'public' },
    { label: 'Отдел (доступна отделу)', value: 'department' },
    { label: 'Приватная (только мне)', value: 'private' },
]

const isFormValid = computed(
    () => !hasErrors.value && form.value.name.trim() && form.value.visibility,
)

// Обработчики
const handleSubmit = async () => {
    const isValid = validateForm(form.value, documentRules.createFolder)
    if (!isValid) return

    isLoading.value = true

    try {
        const path = documentsStore.currentPath === '/' ? '/' : documentsStore.currentPath

        await documentsStore.createFolder({
            name: form.value.name.trim(),
            path: path,
            visibility: form.value.visibility,
        })

        // Сообщение об успехе уже показывается в store
        emit('created')
        resetForm()
    } catch (error) {
        handleError(error, {
            context: 'CreateFolderDialog',
            functionName: 'handleSubmit',
            toastTitle: 'Ошибка',
            toastMessage: 'Не удалось создать папку',
            additionalData: { folderName: form.value.name },
        })
    } finally {
        isLoading.value = false
    }
}

const resetForm = () => {
    form.value = {
        name: '',
        visibility: 'creator',
    }

    clearErrors()
}

watch(
    () => props.visible,
    (visible) => {
        if (!visible) {
            resetForm()
        }
    },
)
</script>

<style scoped>
.create-folder-form {
    @apply space-y-4;
}

.form-field {
    @apply space-y-2;
}

.field-label {
    @apply block text-sm font-medium text-surface-700 dark:text-surface-200;
}

.field-label.required::after {
    content: ' *';
    color: var(--p-red-500);
}

.form-actions {
    @apply flex justify-end gap-2 pt-4 border-t border-surface-200 dark:border-surface-700;
}

.p-error {
    @apply text-xs;
    color: var(--p-red-500);
}
</style>

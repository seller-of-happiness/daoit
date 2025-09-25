<script setup lang="ts">
/*
 * Компонент: FileAttach — универсальный виджет прикрепления файлов
 *
 * Назначение:
 * - Позволяет пользователю выбирать несколько файлов через системный диалог.
 * - Держит локальный список выбранных файлов и синхронизирует его с пропом `files` через v-model (update:files).
 * - Опционально показывает кнопку «Отправить» и вызывает переданный обработчик `onSubmit`.
 * - Отображает прогресс текущей загрузки, считывая состояние из filesStore (Pinia).
 *
 * Взаимодействие:
 * - Вход: props.files (двусторонняя привязка), props.disabled, props.accept, props.showSubmit, props.submitLabel, props.target, props.onSubmit.
 * - Выход: emit('update:files', File[]).
 * - Интеграция с filesStore: чтение uploadState.active и uploadState.pct для прогресс-бара.
 *
 * UX:
 * - Кнопка «Загрузить файл» открывает системный диалог выбора файлов.
 * - После выбора файлы добавляются к уже выбранным; список визуализируется с возможностью удаления каждого файла.
 * - При активной загрузке отображается прогресс-бар.
 */

import { useFilesStore } from '@/refactoring/modules/files/stores/filesStore'

import { computed, ref, watch } from 'vue'

const props = defineProps<{
    /** Двусторонняя привязка выбранных файлов */
    files?: File[]
    /** Отключение (например, isViewMode || !can_edit) */
    disabled?: boolean
    /** accept для input[type=file] */
    accept?: string
    /** Показывать кнопку отправки и вызывать onSubmit */
    showSubmit?: boolean
    /** Текст кнопки отправки */
    submitLabel?: string
    /** Таргет (для аналитики/логирования, опционально) */
    target?: 'responsibility-complete' | 'support-create' | 'support-update' | null
    /** Колбэк отправки (например, завершение задачи или submit формы) */
    onSubmit?: () => void | Promise<void>
}>()


const fileStore = useFilesStore()
const busy = computed<boolean>(() => fileStore.uploadState.active) // busy — признак активной загрузки (для показа ProgressBar)
const pct = computed<number>(() => fileStore.uploadState.pct) // pct — текущий прогресс загрузки (0..100) для ProgressBar
const internal = ref<File[]>(props.files ?? []) // internal — локальный список выбранных файлов (UI-источник правды)
const fileInputRef = ref<HTMLInputElement | null>(null) // fileInputRef — ref на скрытый <input type="file"> для programmatic click()


const emit = defineEmits<{
    (e: 'update:files', v: File[]): void
}>()

/**
 * Watcher: props.files → internal
 *
 * Назначение:
 * - Держит локальный список `internal` в синхронизации с внешним `props.files`.
 *
 * Триггер:
 * - Любое изменение props.files (в т.ч. при монтировании).
 *
 * Логика:
 * - Если пришёл массив — копируем его; иначе сбрасываем в пустой [].
 *
 * Побочные эффекты:
 * - Нет (только локальное состояние).
 */
watch(
    () => props.files,
    (v) => { internal.value = Array.isArray(v) ? v : [] },
    { immediate: true },
)

/**
 * Назначение:
 * - Открыть системный диалог выбора файлов.
 *
 * Логика:
 * - Если `props.disabled` — выход.
 * - Иначе `fileInputRef.click()`.
 *
 * Возвращает: void
 */
const openDialog = () => {
    if (props.disabled) return
    fileInputRef.value?.click()
}

/**
 * Назначение:
 * - Обработать выбор файлов из системного диалога.
 *
 * Вход:
 * - e — событие change от <input type="file">.
 *
 * Логика:
 * - Если файлов нет — выход.
 * - Добавить выбранные файлы к `internal`.
 * - Эмитить 'update:files' с актуальным `internal`.
 * - Сбросить input.value = '' (чтобы повторный выбор тех же файлов сработал).
 *
 * Возвращает: void
 */
const onSelected = (e: Event) => {
    const input = e.target as HTMLInputElement
    if (!input.files?.length) return
    internal.value = [...internal.value, ...Array.from(input.files)]
    emit('update:files', internal.value)
    input.value = ''
}

/**
 * Назначение:
 * - Удалить файл по индексу из локального списка.
 *
 * Вход:
 * - idx — индекс удаляемого файла в `internal`.
 *
 * Логика:
 * - Если `props.disabled` — выход.
 * - splice по индексу → emit('update:files', internal).
 *
 * Возвращает: void
 */
const removeAt = (idx: number) => {
    if (props.disabled) return
    internal.value.splice(idx, 1)
    emit('update:files', internal.value)
}
</script>


<template>
    <div class="file-attach w-fill">
        <div class="flex flex-wrap items-center gap-3">
            <Button
                icon="pi pi-upload"
                label="Загрузить файл"
                :disabled="disabled"
                @click="openDialog"
            />
            <input
                ref="fileInputRef"
                type="file"
                class="hidden"
                multiple
                :accept="accept"
                @change="onSelected"
            />


            <Button
                v-if="showSubmit"
                :label="submitLabel || 'Отправить'"
                icon="pi pi-check"
                :disabled="disabled"
                @click="onSubmit && onSubmit()"
            />
        </div>


        <ul v-if="internal.length" class="mt-3 space-y-2">
            <li
                v-for="(f, i) in internal"
                :key="`${f.name}-${i}`"
                class="flex items-center justify-between px-3 py-2 rounded-lg bg-surface-100 dark:bg-surface-800"
            >
                <span class="truncate text-sm">{{ f.name }}</span>
                <Button
                    icon="pi pi-times"
                    rounded
                    text
                    severity="danger"
                    :disabled="disabled"
                    @click="removeAt(i)"
                    aria-label="Удалить файл"
                />
            </li>
        </ul>

        <!-- ПРОГРЕСС -->
        <div v-if="busy" class="w-full mt-2 ">
            <ProgressBar :value="pct" :showValue="true" />
    </div>
    </div>
</template>

<style scoped>
.file-attach {
    width: 100%;
}
</style>

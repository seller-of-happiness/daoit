<script setup lang="ts">
/*
 * Компонент: FileList — список уже прикреплённых файлов
 *
 * Назначение:
 * - Отображает коллекцию ранее загруженных файлов.
 * - Позволяет скачать файл и (опционально) запросить его удаление.
 *
 * Взаимодействие и поток данных:
 * - Вход: props.items (IExistingFile[]), props.disabled (блокировка удаления), props.title (заголовок).
 * - Выход: emit('remove', id:number) — уведомляет родителя о намерении удалить файл.
 *
 * UX/Доступность:
 * - Секция имеет aria-label.
 * - Кнопки снабжены aria-метками.
 * - Скачивание открывается в новой вкладке с "noopener" для безопасности.
 *
 * Зависимости:
 * - Тип IExistingFile (id: number, file: string(URL)).
 */

import type { IExistingFile } from '@/refactoring/modules/files/types/IExistingFile'

const props = defineProps<{
    /** Заголовок блока */
    title?: string
    /** Массив уже прикреплённых файлов */
    items: IExistingFile[]
    /** Отключение удаления (обычно на основе viewMode родителя) */
    disabled?: boolean
}>()

const emit = defineEmits<{
    /** Сообщаем наружу id файла, который пользователь просит удалить */
    (e: 'remove', id: number): void
}>()

/**
 * Назначение:
 * - Получить человекочитаемое имя файла из URL.
 *
 * Логика:
 * - Берёт подстроку после последнего '/'.
 * - Пытается декодировать через decodeURIComponent (на случай %20 и т.п.).
 * - В случае ошибки декодирования возвращает исходную строку.
 *
 * Параметры:
 * - u: string — исходный URL.
 *
 * Возвращает:
 * - string — имя файла.
 */
const fileNameFromUrl = (u: string): string => {
    try { return decodeURIComponent(u.split('/').pop() || u) } catch { return u }
}

/**
 * Назначение:
 * - Открыть файл в новой вкладке для скачивания/просмотра.
 *
 * Логика:
 * - window.open(u, '_blank', 'noopener') — безопасное открытие без доступа к window.opener.
 *
 * Параметры:
 * - u: string — URL файла.
 *
 * Возвращает:
 * - void
 */
const downloadFile = (u: string) => window.open(u, '_blank', 'noopener')

/**
 * Назначение:
 * - Сообщить родителю о намерении удалить конкретный файл.
 *
 * Логика:
 * - Эмитит событие 'remove' с идентификатором файла.
 *
 * Параметры:
 * - id: number — IExistingFile.id.
 *
 * Возвращает:
 * - void
 */
const markRemove = (id: number) => emit('remove', id)
</script>

<template>
    <section class="file-list">
        <h3 class="file-list__heading">Прикреплённые файлы</h3>
        <header class="file-list__header" v-if="title">
            <h4 class="file-list__title">{{ title }}</h4>
        </header>

        <ul v-if="items.length" class="file-list__items space-y-2 mb-4">
            <li v-for="f in items" :key="f.id" class="file-list__item flex items-center justify-between px-3 py-2 rounded-lg bg-surface-100 dark:bg-surface-800">
                <span class="file-list__name" :title="f.file">{{ fileNameFromUrl(f.file) }}</span>
                <div class="file-list__actions">
                    <Button
                        class="file-list__btn file-list__btn--download"
                        icon="pi pi-download"
                        text
                        aria-label="Скачать"
                        @click="downloadFile(f.file)"
                    />
                    <Button
                        v-if="!disabled"
                        class="file-list__btn file-list__btn--remove"
                        icon="pi pi-trash"
                        text
                        severity="danger"
                        aria-label="Удалить"
                        @click="markRemove(f.id)"
                    />
                </div>
            </li>
        </ul>

        <p v-else class="file-list__empty">Файлы отсутствуют</p>
    </section>
</template>

<style scoped lang="scss">
:deep(.file-list__heading) {
    @apply font-semibold text-sm md:text-base mb-2;
}
</style>

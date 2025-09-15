<template>
    <div class="card p-0 overflow-hidden">
        <div
            class="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-xs sm:text-sm text-surface-600 dark:text-surface-300 border-b border-surface-200 dark:border-surface-800 flex items-center"
        >
            <div class="w-8"></div>
            <div class="flex-1">Название</div>
            <div class="w-56 hidden md:block">Владелец</div>
            <div class="w-28 hidden lg:block">Размер</div>
            <div class="w-36 hidden md:block">Дата</div>
            <div class="w-10"></div>
        </div>
        <ul>
            <li
                v-for="f in files"
                :key="f.id"
                class="px-3 sm:px-4 md:px-6 py-2 sm:py-3 flex items-center gap-2 sm:gap-3 border-t border-surface-100 dark:border-surface-800"
            >
                <i :class="iconByFile(f)" class="text-base sm:text-lg text-primary w-6 sm:w-8"></i>
                <a
                    :href="fileUrl(f)"
                    target="_blank"
                    rel="noopener"
                    class="flex-1 truncate hover:text-linkHover text-sm sm:text-base"
                    >{{ f.name }}</a
                >
                <div
                    class="w-40 md:w-56 hidden md:block truncate text-surface-600 dark:text-surface-300"
                >
                    {{ f.owner }}
                </div>
                <div class="w-24 lg:w-28 hidden lg:block text-surface-600 dark:text-surface-300">
                    —
                </div>
                <div class="w-28 md:w-36 hidden md:block text-surface-600 dark:text-surface-300">
                    {{ formatDate(f.updated_at || f.created_at) }}
                </div>
                <div class="w-10 flex justify-end">
                    <Button
                        icon="pi pi-trash"
                        severity="danger"
                        text
                        rounded
                        @click="$emit('remove', f.id)"
                    />
                </div>
            </li>
        </ul>
    </div>
</template>

<script setup lang="ts">
import type { IEmployeeFile } from '@/refactoring/modules/files/types/IEmployeeFile'
import { BASE_URL } from '@/refactoring/environment/environment'

defineProps<{ files: IEmployeeFile[] }>()
defineEmits<{ (e: 'remove', id: number): void }>()

const fileUrl = (f: IEmployeeFile): string => {
    const path = f.file
    if (!path) return '#'
    if (path.startsWith('http')) return path
    return `${BASE_URL}${path}`
}

const iconByFile = (f: IEmployeeFile): string => {
    const getExtFromName = (): string => {
        const lower = (f.name || '').toLowerCase()
        const idx = lower.lastIndexOf('.')
        return idx > -1 ? lower.slice(idx + 1) : ''
    }
    const getExtFromPath = (): string => {
        const p = (f.file || '').toLowerCase()
        const match = p.match(/\.([a-z0-9]+)(?:\?|#|$)/)
        return match ? match[1] : ''
    }
    const ext = getExtFromName() || getExtFromPath()
    switch (ext) {
        case 'pdf':
            return 'pi pi-file-pdf'
        case 'doc':
        case 'docx':
            return 'pi pi-file-word'
        case 'xls':
        case 'xlsx':
        case 'csv':
            return 'pi pi-file-excel'
        case 'jpg':
        case 'jpeg':
        case 'png':
        case 'gif':
        case 'webp':
        case 'svg':
            return 'pi pi-image'
        case 'zip':
        case 'rar':
        case '7z':
            return 'pi pi-box'
        case 'mp4':
        case 'mov':
        case 'avi':
        case 'mkv':
            return 'pi pi-video'
        case 'mp3':
        case 'wav':
        case 'ogg':
            return 'pi pi-volume-up'
        default:
            return 'pi pi-file'
    }
}

const formatDate = (iso: string): string => {
    try {
        return new Date(iso).toLocaleDateString()
    } catch {
        return iso
    }
}
</script>

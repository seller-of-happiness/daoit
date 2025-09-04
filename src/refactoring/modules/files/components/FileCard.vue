<template>
    <div class="card p-4 flex gap-3 items-start">
        <i :class="iconClass" class="text-2xl text-primary"></i>
        <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-3">
                <a
                    :href="fileUrl"
                    target="_blank"
                    rel="noopener"
                    class="font-semibold hover:text-linkHover truncate"
                    >{{ file.name }}</a
                >
                <div class="flex items-center gap-2">
                    <span class="badge" :class="badgeClass">{{ visibilityLabel }}</span>
                    <Button
                        v-if="!hideRemove"
                        icon="pi pi-trash"
                        severity="danger"
                        text
                        rounded
                        @click="$emit('remove', file.id)"
                    />
                </div>
            </div>
            <div class="text-sm text-surface-600 dark:text-surface-300 mt-1 line-clamp-2">
                {{ file.description }}
            </div>
            <div class="text-xs text-surface-500 mt-2">
                {{ file.owner }} • {{ file.department || '—' }}
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { IEmployeeFile } from '@/refactoring/modules/files/types/IEmployeeFile'
import { BASE_URL } from '@/refactoring/environment/environment'

const props = defineProps<{ file: IEmployeeFile; hideRemove?: boolean }>()

const fileUrl = computed(() => {
    const path = props.file.file
    if (!path) return '#'
    if (path.startsWith('http')) return path
    return `${BASE_URL}${path}`
})

const visibilityLabel = computed(() => {
    switch (props.file.visibility) {
        case 'self':
            return 'Мне'
        case 'department':
            return 'Подразделение'
        case 'company':
            return 'Компания'
        case 'root':
            return 'Корень'
        default:
            return props.file.visibility
    }
})

const badgeClass = computed(() => {
    switch (props.file.visibility) {
        case 'self':
            return 'badge-gray'
        case 'department':
            return 'badge-blue'
        case 'company':
            return 'badge-green'
        case 'root':
            return 'badge-orange'
        default:
            return 'badge-gray'
    }
})

const iconClass = computed(() => {
    const getExtFromName = (): string => {
        const lower = (props.file.name || '').toLowerCase()
        const idx = lower.lastIndexOf('.')
        return idx > -1 ? lower.slice(idx + 1) : ''
    }

    const getExtFromPath = (): string => {
        const p = (props.file.file || '').toLowerCase()
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
        case 'ppt':
        case 'pptx':
            return 'pi pi-file'
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
        case 'txt':
        case 'md':
        case 'json':
            return 'pi pi-file'
        default:
            return 'pi pi-file'
    }
})
</script>

<style scoped>
.line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
.badge {
    font-size: 0.75rem; /* text-xs */
    padding: 0.25rem 0.5rem; /* px-2 py-1 */
    border-radius: 0.25rem; /* rounded */
    white-space: nowrap;
}
.badge-gray {
    background-color: var(--p-surface-200);
    color: var(--p-surface-700);
}
.app-dark .badge-gray {
    background-color: var(--p-surface-800);
    color: var(--p-surface-200);
}
.badge-blue {
    background-color: var(--p-blue-100);
    color: var(--p-blue-700);
}
.badge-green {
    background-color: var(--p-green-100);
    color: var(--p-green-700);
}
.badge-orange {
    background-color: var(--p-orange-100);
    color: var(--p-orange-700);
}
</style>

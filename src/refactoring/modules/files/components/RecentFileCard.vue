<template>
    <div class="card p-4 cursor-pointer" role="link" @click="download">
        <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
                <i :class="iconClass" class="text-2xl text-primary"></i>
                <span class="font-semibold hover:text-linkHover truncate">{{ file.name }}</span>
            </div>
            <Button
                icon="pi pi-cog"
                severity="secondary"
                text
                rounded
                @click.stop="$emit('edit', file)"
            />
        </div>
        <div class="text-xs text-surface-500 mt-2 truncate">{{ file.owner }}</div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { IEmployeeFile } from '@/refactoring/modules/files/types/IEmployeeFile'
import { BASE_URL } from '@/refactoring/environment/environment'

const props = defineProps<{ file: IEmployeeFile }>()
defineEmits<{ 
  (e: 'remove', id: number): void
  (e: 'edit', file: IEmployeeFile): void
}>()

const fileUrl = computed(() => {
    const path = props.file.file
    if (!path) return '#'
    if (path.startsWith('http')) return path
    return `${BASE_URL}${path}`
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
})

const download = () => {
    const url = fileUrl.value
    if (!url || url === '#') return
    const link = document.createElement('a')
    link.href = url
    link.download = props.file.name
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
}
</script>

<style scoped lang="scss">
.card {
    margin-bottom: 0 !important;
}
</style>

<template>
    <Dialog
        :visible="visible"
        modal
        :draggable="false"
        :closable="!filesStore.isUploading"
        :header="`Редактирование документа «${file?.name || ''}»`"
        class="w-full md:w-[800px]"
        @update:visible="onUpdateVisible"
    >
        <div v-if="file" class="flex flex-col gap-6">
            <!-- Основная информация о файле -->
            <div class="card p-4 bg-surface-50 dark:bg-surface-800">
                <div class="flex items-center gap-3 mb-3">
                    <i :class="iconClass" class="text-2xl text-primary"></i>
                    <div>
                        <h5 class="font-semibold text-lg">{{ file.name }}</h5>
                        <p class="text-sm text-surface-600 dark:text-surface-300">
                            {{ file.description || 'Нет описания' }}
                        </p>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <span class="font-medium">Владелец:</span> {{ file.owner }}
                    </div>
                    <div>
                        <span class="font-medium">Подразделение:</span> {{ file.department || '—' }}
                    </div>
                    <div>
                        <span class="font-medium">Создан:</span> {{ formatDate(file.created_at) }}
                    </div>
                    <div>
                        <span class="font-medium">Обновлен:</span> {{ formatDate(file.updated_at) }}
                    </div>
                </div>
            </div>

            <!-- Табы -->
            <Tabs value="0">
                <TabList>
                    <Tab value="0">История изменений</Tab>
                    <Tab value="1">Новая версия</Tab>
                    <Tab value="2">Управление</Tab>
                </TabList>
                <TabPanels>
                    <!-- История изменений -->
                    <TabPanel value="0">
                    <div class="space-y-4">
                        <div class="flex justify-between items-center">
                            <h6 class="font-semibold">Версии файла</h6>
                            <Button 
                                icon="pi pi-refresh" 
                                text 
                                size="small"
                                @click="loadVersionHistory"
                                :loading="loadingVersions"
                            />
                        </div>
                        
                        <div v-if="loadingVersions" class="text-center py-4">
                            <i class="pi pi-spinner pi-spin"></i>
                            <p class="mt-2 text-surface-600">Загрузка истории...</p>
                        </div>
                        
                        <div v-else-if="versions.length === 0" class="text-center py-8 text-surface-500">
                            <i class="pi pi-history text-4xl mb-3"></i>
                            <p>История изменений пока пуста</p>
                        </div>
                        
                        <div v-else class="space-y-3">
                            <div 
                                v-for="(version, index) in versions" 
                                :key="version.id"
                                class="border border-surface-200 dark:border-surface-700 rounded-lg p-4"
                            >
                                <div class="flex justify-between items-start mb-2">
                                    <div class="flex items-center gap-2">
                                        <span class="badge" :class="index === 0 ? 'badge-green' : 'badge-gray'">
                                            {{ index === 0 ? 'Текущая' : `v${versions.length - index}` }}
                                        </span>
                                        <span class="font-medium">{{ version.name }}</span>
                                    </div>
                                    <div class="flex gap-2">
                                        <Button 
                                            icon="pi pi-download" 
                                            text 
                                            size="small"
                                            @click="downloadVersion(version)"
                                        />
                                        <Button 
                                            v-if="index !== 0"
                                            icon="pi pi-undo" 
                                            text 
                                            size="small"
                                            @click="restoreVersion(version)"
                                        />
                                    </div>
                                </div>
                                <div class="text-sm text-surface-600 dark:text-surface-300">
                                    <div>{{ version.owner }} • {{ formatDate(version.created_at) }}</div>
                                    <div v-if="version.description" class="mt-1">{{ version.description }}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    </TabPanel>

                    <!-- Загрузка новой версии -->
                    <TabPanel value="1">
                    <div class="space-y-4">
                        <div class="flex flex-col gap-2">
                            <label class="text-sm font-medium">Описание изменений</label>
                            <InputText 
                                v-model="versionDescription" 
                                placeholder="Что изменилось в новой версии?" 
                            />
                        </div>
                        <div class="flex flex-col gap-2">
                            <label class="text-sm font-medium">Новый файл</label>
                            <input 
                                type="file" 
                                class="p-inputtext p-component" 
                                @change="onNewVersionFile"
                                :disabled="filesStore.isUploading"
                            />
                        </div>
                        <div class="flex justify-end">
                            <Button 
                                :label="filesStore.isUploading ? 'Загрузка...' : 'Загрузить новую версию'"
                                :disabled="!newVersionFile || filesStore.isUploading"
                                @click="uploadNewVersion"
                            />
                        </div>
                    </div>
                    </TabPanel>

                    <!-- Управление файлом -->
                    <TabPanel value="2">
                    <div class="space-y-6">
                        <!-- Редактирование метаданных -->
                        <div class="space-y-4">
                            <h6 class="font-semibold">Редактирование информации</h6>
                            <div class="grid grid-cols-1 gap-4">
                                <div class="flex flex-col gap-2">
                                    <label class="text-sm font-medium">Название</label>
                                    <InputText v-model="editedName" />
                                </div>
                                <div class="flex flex-col gap-2">
                                    <label class="text-sm font-medium">Описание</label>
                                    <InputText v-model="editedDescription" />
                                </div>
                                <div class="flex flex-col gap-2">
                                    <label class="text-sm font-medium">Видимость</label>
                                    <select v-model="editedVisibility" class="p-inputtext p-component">
                                        <option value="self">Только мне</option>
                                        <option value="department">Моё подразделение</option>
                                        <option value="company">Вся компания</option>
                                        <option value="root">Корневая папка</option>
                                    </select>
                                </div>
                            </div>
                            <div class="flex justify-end gap-2">
                                <Button 
                                    label="Отменить" 
                                    severity="secondary" 
                                    text
                                    @click="resetEditing"
                                />
                                <Button 
                                    label="Сохранить изменения"
                                    @click="saveMetadata"
                                    :disabled="!hasMetadataChanges"
                                />
                            </div>
                        </div>

                        <!-- Опасная зона -->
                        <div class="border-t border-surface-200 dark:border-surface-700 pt-6">
                            <h6 class="font-semibold text-red-600 mb-4">Опасная зона</h6>
                            <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                                <div class="flex justify-between items-center">
                                    <div>
                                        <h6 class="font-medium text-red-800 dark:text-red-200">Удалить файл</h6>
                                        <p class="text-sm text-red-600 dark:text-red-300">
                                            Это действие нельзя отменить. Файл будет удален навсегда.
                                        </p>
                                    </div>
                                    <Button 
                                        label="Удалить" 
                                        severity="danger"
                                        @click="confirmDelete = true"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    </TabPanel>
                </TabPanels>
            </Tabs>
        </div>

        <!-- Диалог подтверждения удаления -->
        <Dialog
            v-model:visible="confirmDelete"
            modal
            header="Подтверждение удаления"
            class="w-full md:w-[400px]"
        >
            <div class="space-y-4">
                <div class="flex items-center gap-3">
                    <i class="pi pi-exclamation-triangle text-2xl text-red-500"></i>
                    <div>
                        <p class="font-medium">Вы уверены, что хотите удалить файл?</p>
                        <p class="text-sm text-surface-600">{{ file?.name }}</p>
                    </div>
                </div>
                <div class="flex justify-end gap-2">
                    <Button 
                        label="Отмена" 
                        severity="secondary" 
                        text
                        @click="confirmDelete = false"
                    />
                    <Button 
                        label="Удалить" 
                        severity="danger"
                        @click="deleteFile"
                    />
                </div>
            </div>
        </Dialog>
    </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useFilesStore } from '@/refactoring/modules/files/stores/filesStore'
import type { IEmployeeFile } from '@/refactoring/modules/files/types/IEmployeeFile'
import type { FileVisibility } from '@/refactoring/modules/files/types/FileVisibility'
import { BASE_URL } from '@/refactoring/environment/environment'

const props = defineProps<{ 
    visible: boolean
    file: IEmployeeFile | null
}>()

const emit = defineEmits<{ 
    (e: 'update:visible', value: boolean): void
    (e: 'deleted'): void
    (e: 'updated'): void
}>()

const filesStore = useFilesStore()

// Состояние компонента
const versions = ref<IEmployeeFile[]>([])
const loadingVersions = ref(false)
const confirmDelete = ref(false)

// Новая версия
const versionDescription = ref('')
const newVersionFile = ref<File | null>(null)

// Редактирование метаданных
const editedName = ref('')
const editedDescription = ref('')
const editedVisibility = ref<FileVisibility>('self')

// Вычисляемые свойства
const iconClass = computed(() => {
    if (!props.file) return 'pi pi-file'
    
    const getExtFromName = (): string => {
        const lower = (props.file?.name || '').toLowerCase()
        const idx = lower.lastIndexOf('.')
        return idx > -1 ? lower.slice(idx + 1) : ''
    }
    
    const ext = getExtFromName()
    
    switch (ext) {
        case 'pdf': return 'pi pi-file-pdf'
        case 'doc':
        case 'docx': return 'pi pi-file-word'
        case 'xls':
        case 'xlsx':
        case 'csv': return 'pi pi-file-excel'
        case 'ppt':
        case 'pptx': return 'pi pi-file'
        case 'jpg':
        case 'jpeg':
        case 'png':
        case 'gif':
        case 'webp':
        case 'svg': return 'pi pi-image'
        case 'zip':
        case 'rar':
        case '7z': return 'pi pi-box'
        case 'mp4':
        case 'mov':
        case 'avi':
        case 'mkv': return 'pi pi-video'
        case 'mp3':
        case 'wav':
        case 'ogg': return 'pi pi-volume-up'
        default: return 'pi pi-file'
    }
})

const hasMetadataChanges = computed(() => {
    if (!props.file) return false
    return editedName.value !== props.file.name ||
           editedDescription.value !== props.file.description ||
           editedVisibility.value !== props.file.visibility
})

// Методы
const onUpdateVisible = (v: boolean) => emit('update:visible', v)

const formatDate = (iso: string): string => {
    try {
        return new Date(iso).toLocaleString('ru-RU')
    } catch {
        return iso
    }
}

const loadVersionHistory = async () => {
    if (!props.file) return
    
    loadingVersions.value = true
    try {
        // Пока что показываем только текущую версию
        // В будущем здесь будет запрос к API для получения истории версий
        versions.value = [props.file]
    } catch (error) {
        console.error('Failed to load version history:', error)
    } finally {
        loadingVersions.value = false
    }
}

const downloadVersion = (version: IEmployeeFile) => {
    const path = version.file
    if (!path) return
    
    const url = path.startsWith('http') ? path : `${BASE_URL}${path}`
    const link = document.createElement('a')
    link.href = url
    link.download = version.name
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
}

const restoreVersion = async (version: IEmployeeFile) => {
    // Здесь будет логика восстановления версии
    console.log('Restore version:', version)
}

const onNewVersionFile = (e: Event) => {
    const input = e.target as HTMLInputElement
    newVersionFile.value = input.files?.[0] ?? null
}

const uploadNewVersion = async () => {
    if (!newVersionFile.value || !props.file) return
    
    try {
        // Здесь будет логика загрузки новой версии
        // Пока что обновляем существующий файл
        await filesStore.uploadFile({
            name: props.file.name,
            description: versionDescription.value || props.file.description,
            file: newVersionFile.value,
            visibility: props.file.visibility
        })
        
        versionDescription.value = ''
        newVersionFile.value = null
        emit('updated')
    } catch (error) {
        console.error('Failed to upload new version:', error)
    }
}

const resetEditing = () => {
    if (!props.file) return
    editedName.value = props.file.name
    editedDescription.value = props.file.description
    editedVisibility.value = props.file.visibility
}

const saveMetadata = async () => {
    if (!props.file || !hasMetadataChanges.value) return
    
    try {
        // Здесь будет API для обновления метаданных файла
        console.log('Save metadata:', {
            id: props.file.id,
            name: editedName.value,
            description: editedDescription.value,
            visibility: editedVisibility.value
        })
        emit('updated')
    } catch (error) {
        console.error('Failed to save metadata:', error)
    }
}

const deleteFile = async () => {
    if (!props.file) return
    
    try {
        await filesStore.deleteFile(props.file.id)
        confirmDelete.value = false
        emit('deleted')
        emit('update:visible', false)
    } catch (error) {
        console.error('Failed to delete file:', error)
    }
}

// Watchers
watch(() => props.visible, (visible) => {
    if (visible && props.file) {
        resetEditing()
        loadVersionHistory()
        versionDescription.value = ''
        newVersionFile.value = null
        confirmDelete.value = false
    }
})
</script>

<style scoped>
.badge {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    white-space: nowrap;
    font-weight: 500;
}

.badge-gray {
    background-color: var(--p-surface-200);
    color: var(--p-surface-700);
}

.app-dark .badge-gray {
    background-color: var(--p-surface-800);
    color: var(--p-surface-200);
}

.badge-green {
    background-color: var(--p-green-100);
    color: var(--p-green-700);
}

.app-dark .badge-green {
    background-color: var(--p-green-900);
    color: var(--p-green-200);
}
</style>
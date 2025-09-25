import { computed } from 'vue'
import { useTicketsStore } from '@/refactoring/modules/tickets/stores/ticketsStore'
import type { IExistingFile } from '@/refactoring/modules/files/types/IExistingFile'


export function useTicketFiles() {
    const tickets = useTicketsStore()


// [ADD] Привязки для FileAttach
    const files = computed<File[]>({
        get: () => tickets.uploadNewFiles,
        set: (v) => tickets.setNewTicketFiles(v as any)
    })
    const onUpdateFiles = (v: File[]) => tickets.setNewTicketFiles(v as any)


// [ADD] Привязки для FileList
    const existingFiles = computed<IExistingFile[]>(() => {
        const list = (tickets.currentTicket as any)?.files ?? []
        return Array.isArray(list) ? list.map((f: any) => ({ id: f.id, file: f.file })) : []
    })

    const onExistingFileRemove = (id: number) => tickets.markTicketFileForRemoval(id)


// [ADD] Синхронизация
    const sync = async (ticketId: number) => { await tickets.syncTicketFiles(ticketId) }


    return { files, onUpdateFiles, existingFiles, onExistingFileRemove, sync }
}

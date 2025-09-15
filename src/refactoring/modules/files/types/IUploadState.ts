import type { IAttachFile } from '@/refactoring/modules/files/types/IAttachFile'
import type { UploadPhase } from '@/refactoring/modules/supportService/stores/IUploadPhase'

export interface IUploadState {
    active: boolean;                 // есть ли сейчас аплоад
    phase: UploadPhase | null;       // какой сценарий
    loaded: number;                  // байт отправлено
    total: number;                   // байт всего (можно суммой файлов)
    pct: number;                     // 0..100 (округлённый)
    files: IAttachFile[];            // снимок отправляемых файлов (метаданные)
    error?: string | null;           // опционально — текст ошибки
}

import {
    IAdverseEventParticipant
} from '@/refactoring/modules/apiStore/types/adverse-events-participants/IAdverseEventParticipant'

export interface IAdverseEventParticipants {
    next: string | null              // ссылка на следующую страницу результатов или null
    previous: string | null          // ссылка на предыдущую страницу результатов или null
    results: IAdverseEventParticipant[] // массив участников текущей страницы
}

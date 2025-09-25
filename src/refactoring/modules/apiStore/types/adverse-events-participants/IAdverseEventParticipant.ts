// Интерфейс одного участника НС
import {
    IAdverseEventParticipantEmployee
} from '@/refactoring/modules/apiStore/types/adverse-events-participants/IAdverseEventParticipantEmployee'

export interface IAdverseEventParticipant {
    id: number                       // уникальный идентификатор записи участника
    participant_type: string         // тип участника ('employee' и т.п.)
    full_name: string                // полное имя участника
    employee: IAdverseEventParticipantEmployee // данные сотрудника-участника
    birth_date: string               // дата рождения участника (YYYY-MM-DD)
    phone_number: string             // телефон участника
    comment: string                  // комментарий по участнику
}

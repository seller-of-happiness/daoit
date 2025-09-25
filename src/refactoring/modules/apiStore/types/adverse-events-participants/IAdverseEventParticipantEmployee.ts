// Интерфейс данных сотрудника-участника НС
export interface IAdverseEventParticipantEmployee {
    id: number                       // уникальный идентификатор сотрудника
    first_name: string               // имя сотрудника
    last_name: string                // фамилия сотрудника
    middle_name: string              // отчество сотрудника
    gender: string                   // пол сотрудника ('М' или 'Ж')
    phone_number: string             // номер телефона сотрудника
    birth_date: string               // дата рождения сотрудника (YYYY-MM-DD)
}

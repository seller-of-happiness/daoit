import type { IResponsibilityDepartment } from '@/refactoring/modules/responsibilityEntries/types/IResponsibilityDepartment'
import type { IResponsibilityEmployee } from '@/refactoring/modules/responsibilityEntries/types/IResponsibilityEmployee'

// Описание одной записи ответственности из API
export interface IResponsibilityEntry {
    id?: number                                  // Уникальный ID записи
    department_from?: IResponsibilityDepartment  // Отправитель (подразделение)
    department_to?: IResponsibilityDepartment    // Получатель (подразделение)
    supervisor?: IResponsibilityEmployee      // Отправитель (сотрудник)
    responsible_employee?: IResponsibilityEmployee        // Получатель (сотрудник)
    status?:
        | 'new'
        | 'in_progress'
        | 'completed'                           // Текущий статус записи
    instructions?: string                             // Комментарий
    completion_report?: string
    urgency?: number                             // Приоритет: 0=низкий,1=средний,2=высокий
    deadline_time?: string | null                   // Срок выполнения (ISO)
    created_by?: number                          // ID создателя
    created_at?: string                          // Время создания (ISO)
    updated_at?: string                          // Время обновления (ISO)
    can_take?: boolean                           // Доступно действие "взять в работу"
    can_return?: boolean                         // Доступно действие "вернуть"
    can_transfer?: boolean                       // Доступно действие "передать"
    can_cancel?: boolean                         // Доступно действие "отменить"
    can_complete?: boolean                       // Доступно действие "завершить"
}

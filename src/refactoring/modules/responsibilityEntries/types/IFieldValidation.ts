export interface IFieldValidation {
    adverseEventValidation: {
    event_type: boolean
    date_time: boolean
    description: boolean
    department_to?: boolean
    },
    responsibilityValidation: {
        employee_type: boolean
        instructions_type: boolean
        deadline_type: boolean
    }
}

export interface ICalendarEvent {
    id?: number
    name: string
    description?: string
    start_datetime: string
    end_datetime: string
    is_all_day: boolean
    categories: { id: number }[]
    priority: 'low' | 'medium' | 'high' | 'critical'
    status: 'planned' | 'confirmed' | 'cancelled' | 'postponed' | 'completed'
    recurrence_rule?: string
    location?: string | null
    block?: { id: string } | null
    floor?: { id: string } | null
    room?: { id: string } | null
    participants: {
        id?: number
        participant_type: 'employee' | 'patient' | 'guest'
        full_name: string
        employee?: { id: number }
        birth_date?: string
        phone_number?: string
        comment?: string
        role: 'organizer' | 'participant'
        response_status: 'accepted' | 'declined' | 'tentative'
    }[]
    reminders?: {
        reminder_before_event: string
        method: 'email' | 'notification' | 'sms'
    }[]
    created_by?: number
    created_at?: string
    updated_at?: string
}

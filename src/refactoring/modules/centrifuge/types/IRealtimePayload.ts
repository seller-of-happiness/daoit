import { IRealtimeEventType } from '@/refactoring/modules/centrifuge/types/IRealtimeEventType'

export interface IRealtimePayload<T> { event_type: IRealtimeEventType; object: T }

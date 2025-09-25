// Универсальный payload для операций без тела (take, return, cancel и т. д.)
export interface IEntryActionPayload {
    event_id: number  // ID НС
    id: number        // ID записи ответственности
}

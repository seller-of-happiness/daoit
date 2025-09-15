export interface ITicketCategory {
    id: number
    name: string
    childrens?: ITicketCategory[]
}

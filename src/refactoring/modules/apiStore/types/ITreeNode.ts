export interface ITreeNode {
    key: string
    label: string
    data: {
        name: string
        position: number
        selfId: string
        roomType?: {
            name: string | null
            id: number | null
        }
    }
    icon: string
    children: ITreeNode[]
}

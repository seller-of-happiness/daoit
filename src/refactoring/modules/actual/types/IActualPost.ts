export interface IActualAttachment {
    id: number
    file: string
}

export interface IActualPost {
    id: number
    title: string
    content: string
    author: string
    likes_count: number
    is_liked: boolean
    views_count: number
    created_at?: string
    updated_at?: string
    attachments?: IActualAttachment[]
    comments?: IActualComment[]
}

export interface IActualComment {
    id: number
    author: string
    content: string
    created_at: string
    avatar?: string
}

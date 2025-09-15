export interface INewsAttachment {
    id: number
    file: string
}

export interface INewsPost {
    id: number
    title: string
    content: string
    author: string
    likes_count: number
    is_liked: boolean
    views_count: number
    created_at?: string
    updated_at?: string
    attachments?: INewsAttachment[]
    comments?: INewsComment[]
    link?: string
    source?: string
    excerpt?: string
    image?: string
}

export interface INewsComment {
    id: number
    author: string
    content: string
    created_at: string
    avatar?: string
}

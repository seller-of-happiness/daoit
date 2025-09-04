export type ReactionUser = { id: string | number; name: string; avatar?: string | null }

export type ReactionGroup = {
    key: string
    emoji: string
    users: ReactionUser[]
    tooltip: string
    isThumb?: boolean
}

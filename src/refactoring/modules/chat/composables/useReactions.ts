/**
 * Композабл для работы с реакциями в сообщениях
 * Выносит сложную логику реакций из MessageItem
 */
import { computed, ref } from 'vue'
import { useApiStore } from '@/refactoring/modules/apiStore/stores/apiStore'
import type { IEmployee } from '@/refactoring/modules/apiStore/types/employees/IEmployee'
import type {
    IMessage,
    IReactionType,
    ReactionUser,
    ReactionGroup,
    OptimisticReaction,
} from '@/refactoring/modules/chat/types/IChat'

type ReactionLike = {
    id?: string | number
    user?: { id?: string | number; user?: string | number; user_id?: string | number }
    user_id?: string | number
}

const pickUserId = (r: ReactionLike): string | undefined => {
    const v = r?.user?.id ?? r?.user?.user ?? r?.user?.user_id ?? r?.id ?? r?.user_id
    return v == null ? undefined : String(v)
}

/**
 * Получает информацию о пользователе из apiStore
 * @param userId ID пользователя
 * @returns Объект с именем и аватаркой пользователя
 */
function getUserInfo(userId: string): { name: string; avatar: string | null } {
    const apiStore = useApiStore()
    const employee = apiStore.employees.find((emp: IEmployee) => emp.id === userId)
    
    if (employee) {
        const fullName = `${employee.first_name} ${employee.last_name}`.trim()
        return {
            name: fullName || `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || `User ${userId}`,
            avatar: null // В типе IEmployee нет поля avatar, но можно добавить позже
        }
    }
    
    return {
        name: `User ${userId}`,
        avatar: null
    }
}

export function useReactions(
    message: IMessage,
    currentUserId: string | null,
    reactionTypes: IReactionType[],
    chatMembers?: Array<{ user: string; user_name: string; user_uuid?: string }>,
) {
    const optimisticReactions = ref<OptimisticReaction[]>([])
    const hasQuickLike = ref(false)
    const forceShowLike = ref(false)
    const isOptimisticallyCleared = ref(false)

    // Группировка реакций с обработкой различных форматов от сервера
    const groupedReactions = computed<ReactionGroup[]>(() => {
        const raw = message?.reactions ?? message?.message_reactions ?? []
        const groups = new Map<string, ReactionGroup>()

        // Функция добавления пользователя в группу реакций
        const addUserToGroup = (
            id: string,
            name: string,
            icon: string | null,
            user: Record<string, any>,
        ) => {
            const key = String(id || name || icon || 'unknown')
            const emoji = getReactionEmoji({ id: 0, name, icon } as IReactionType)

            const userId = String(user?.user ?? user?.id ?? user?.user_id ?? Math.random())
            
            // Получаем информацию о пользователе из apiStore
            const userInfo = getUserInfo(userId)
            
            const userEntry: ReactionUser = {
                id: userId,
                name: user?.user_name ?? user?.full_name ?? user?.name ?? userInfo.name,
                avatar: user?.avatar || user?.icon || user?.photo || userInfo.avatar,
            }

            const existing = groups.get(key)
            if (existing) {
                const already = existing.users.some((u) => String(u.id) === String(userEntry.id))
                if (!already) existing.users.push(userEntry)
            } else {
                groups.set(key, {
                    key,
                    emoji,
                    users: [userEntry],
                    tooltip: `${emoji} · ${userEntry.name}`,
                })
            }
        }

        // Обработка различных форматов данных от сервера
        if (Array.isArray(raw)) {
            processArrayFormat(raw, addUserToGroup, chatMembers, reactionTypes)
        } else if (raw && typeof raw === 'object') {
            processObjectFormat(raw, addUserToGroup, chatMembers, reactionTypes)
        }

        // Добавляем оптимистичные реакции
        for (const o of optimisticReactions.value) {
            addUserToGroup(String(o.id), o.name, o.icon, o.user)
        }

        const result = Array.from(groups.values())

        // Обеспечиваем эксклюзивность реакций для текущего пользователя
        if (currentUserId) {
            enforceExclusiveReactions(result, currentUserId)
        }

        // Помечаем лайки для особого отображения
        result.forEach((g: any) => (g.isThumb = g.emoji === '👍'))

        return result
    })

    // Получение ID моей реакции
    const myReactionId = computed(() => {
        if (!currentUserId) return null

        // Если реакция была оптимистично удалена, возвращаем null
        if (isOptimisticallyCleared.value) return null

        // Проверяем оптимистичные реакции
        const optimistic = optimisticReactions.value.find((r: OptimisticReaction) => pickUserId(r) === currentUserId)
        if (optimistic) {
            const id = Number(optimistic.id)
            return Number.isFinite(id) ? id : null
        }

        // Проверяем серверные данные
        return extractMyReactionFromServer(message, currentUserId)
    })

    const hasMyReaction = computed(() => myReactionId.value !== null)

    // Доступные реакции для меню
    const menuReactions = computed<IReactionType[]>(() => {
        // Если нет типов реакций, используем fallback
        if (!reactionTypes.length) {
            return [
                { id: 1, name: 'Like', icon: '👍' },
                { id: 2, name: 'Love', icon: '❤️' },
                { id: 3, name: 'Laugh', icon: '😂' },
                { id: 4, name: 'Wow', icon: '😮' },
                { id: 5, name: 'Sad', icon: '😢' },
                { id: 6, name: 'Angry', icon: '😠' },
            ] as IReactionType[]
        }

        const like = findThumbsUpReaction()
        if (like && !reactionTypes.find((r) => r.id === like.id)) {
            return [like, ...reactionTypes]
        }
        if (!like) {
            return [{ id: -1, name: 'Like', icon: '👍' } as IReactionType, ...reactionTypes]
        }
        return reactionTypes
    })

    // Функции управления реакциями
    const addOptimisticReaction = (
        id: string | number,
        name: string,
        icon: string | null,
        user: any,
    ) => {
        const key = String(id)
        const userId = String(user?.user ?? user?.id ?? user?.user_id ?? 'me')
        const exists = optimisticReactions.value.some(
            (r: OptimisticReaction) => String(r.id) === key && pickUserId(r) === userId,
        )
        if (!exists) {
            optimisticReactions.value.push({ id: key, name, icon, user })
        }
        // Сбрасываем флаг очистки при добавлении новой реакции
        isOptimisticallyCleared.value = false
    }

    const clearOptimisticForMe = () => {
        if (!currentUserId) return
        optimisticReactions.value = optimisticReactions.value.filter(
            (r: OptimisticReaction) => pickUserId(r) !== currentUserId,
        )
        isOptimisticallyCleared.value = true
    }

    const findThumbsUpReaction = (): IReactionType | null => {
        const byIcon = reactionTypes.find((r) => {
            const icon = String(r.icon || '').toLowerCase()
            return icon.includes('👍') || icon.includes('thumb')
        })
        if (byIcon) return byIcon

        const byName = reactionTypes.find((r) => {
            const name = String(r.name || '').toLowerCase()
            return /like|лайк|thumb|нрав|палец/.test(name)
        })
        return byName || null
    }

    return {
        groupedReactions,
        myReactionId,
        hasMyReaction,
        menuReactions,
        optimisticReactions: optimisticReactions.value,
        hasQuickLike,
        forceShowLike,
        addOptimisticReaction,
        clearOptimisticForMe,
        findThumbsUpReaction,
    }
}

// Вспомогательные функции

function processArrayFormat(array: any[], addUserToGroup: Function, chatMembers?: Array<{ user: string; user_name: string; user_uuid?: string }>, reactionTypes?: IReactionType[]) {
    for (const item of array) {
        const id = String(
            item?.type_id ??
                item?.reaction_id ??
                item?.reaction_type_id ??
                item?.id ??
                item?.type ??
                item?.reaction?.id ??
                '',
        )
        let name =
            item?.type_name ?? item?.reaction_name ?? item?.name ?? item?.reaction?.name ?? ''
        let icon =
            item?.type_icon ?? item?.reaction_icon ?? item?.icon ?? item?.reaction?.icon ?? null

        // Если у нас есть типы реакций и ID, попробуем найти правильную информацию
        if (reactionTypes && id) {
            const reactionType = reactionTypes.find(rt => String(rt.id) === String(id))
            if (reactionType) {
                name = name || reactionType.name
                icon = icon || reactionType.icon
            }
        }

        const usersSources = [
            item?.users,
            item?.reactors,
            item?.members,
            item?.users_preview,
            item?.list,
            item?.user_list,
        ]
            .filter(Array.isArray)
            .flat()

        if (item?.user) usersSources.push(item.user)

        // Обработка формата {user_id: "...", reaction_type_id: 2}
        if (item?.user_id && !usersSources.length) {
            const userId = item.user_id
            // Ищем пользователя в участниках чата
            const chatMember = chatMembers?.find(m => 
                m.user === userId || m.user_uuid === userId
            )
            
            // Получаем информацию о пользователе из apiStore
            const userInfo = getUserInfo(userId)
            
            // Создаем объект пользователя из user_id
            const userObj = {
                id: userId,
                user: userId,
                user_id: userId,
                name: chatMember?.user_name || userInfo.name,
                user_name: chatMember?.user_name || userInfo.name,
                avatar: userInfo.avatar
            }
            usersSources.push(userObj)
        }

        for (const user of usersSources.filter(Boolean)) {
            addUserToGroup(id, name, icon, user)
        }
    }
}

function processObjectFormat(obj: any, addUserToGroup: Function, chatMembers?: Array<{ user: string; user_name: string; user_uuid?: string }>, reactionTypes?: IReactionType[]) {
    for (const [key, val] of Object.entries(obj)) {
        const v: any = val
        if (Array.isArray(v)) {
            processArrayFormat(v, addUserToGroup, chatMembers, reactionTypes)
        } else {
            const users =
                [v?.users, v?.users_preview, v?.reactors, v?.members].find(Array.isArray) || []

            for (const user of users) {
                addUserToGroup(String(v?.id ?? key), v?.name ?? key, v?.icon ?? null, user)
            }
        }
    }
}

function enforceExclusiveReactions(groups: ReactionGroup[], currentUserId: string) {
    // Находим группу с моей реакцией
    let myGroupKey: string | null = null
    for (let i = groups.length - 1; i >= 0; i--) {
        if (groups[i].users.some((u) => String(u.id) === currentUserId)) {
            myGroupKey = groups[i].key
            break
        }
    }

    // Удаляем меня из всех остальных групп
    if (myGroupKey) {
        groups.forEach((g) => {
            if (g.key !== myGroupKey) {
                g.users = g.users.filter((u) => String(u.id) !== currentUserId)
            }
        })
    }

    // Удаляем пустые группы
    for (let i = groups.length - 1; i >= 0; i--) {
        if (groups[i].users.length === 0) {
            groups.splice(i, 1)
        }
    }
}

function extractMyReactionFromServer(message: any, currentUserId: string): number | null {
    const raw = message?.reactions || message?.message_reactions || []

    const scanArray = (arr: any[]): number | null => {
        for (const item of arr) {
            const users = [
                item?.users,
                item?.reactors,
                item?.members,
                item?.users_preview,
                item?.user,
            ]
                .filter(Boolean)
                .flat()

            // Проверяем обычные списки пользователей
            const hasMyUser = users.some(
                (u: any) => String(u?.user ?? u?.id ?? u?.user_id ?? '') === currentUserId,
            )

            // Проверяем формат {user_id: "...", reaction_type_id: 2}
            const isMyDirectReaction = item?.user_id && String(item.user_id) === currentUserId

            if (hasMyUser || isMyDirectReaction) {
                const id = Number(
                    item?.type_id ??
                        item?.reaction_id ??
                        item?.reaction_type_id ??
                        item?.id ??
                        item?.type ??
                        item?.reaction?.id ??
                        '',
                )
                return Number.isFinite(id) ? id : null
            }
        }
        return null
    }

    if (Array.isArray(raw)) return scanArray(raw)
    if (raw && typeof raw === 'object') return scanArray(Object.values(raw))
    return null
}

export function getReactionEmoji(r: IReactionType): string {
    if (r.icon && r.icon.length <= 3) return r.icon

    const icon = String(r.icon || '').toLowerCase()
    const name = (r.name || '').toLowerCase()

    if (icon.includes('thumb')) return '👍'
    if (name.includes('счаст')) return '😊'
    if (name.includes('люб')) return '😍'
    if (name.includes('удив')) return '😮'
    if (name.includes('груст') || name.includes('печаль')) return '😢'
    if (name.includes('смеш') || name.includes('смех')) return '😆'

    return '👍'
}

export function isThumbReaction(r: IReactionType): boolean {
    const icon = String(r.icon || '').toLowerCase()
    const name = String(r.name || '').toLowerCase()
    return icon.includes('thumb') || icon.includes('👍') || /like|лайк|нрав/.test(name)
}

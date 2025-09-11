/**
 * Композабл для работы с реакциями в сообщениях
 * Выносит сложную логику реакций из MessageItem
 */
import { computed, ref, watch } from 'vue'
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

            const userEntry: ReactionUser = {
                id: String(user?.user ?? user?.id ?? user?.user_id ?? Math.random()),
                name: String(user?.user_name ?? user?.full_name ?? user?.name ?? 'Unknown User'),
                avatar: user?.avatar || user?.icon || user?.photo || null,
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
            console.log('➕ Добавлена оптимистичная реакция в группировку:', { id: o.id, name: o.name, user: o.user })
        }

        const result = Array.from(groups.values())
        
        if (result.length > 0) {
            console.log('🔢 Итоговые группы реакций:', result.map(g => ({ 
                key: g.key, 
                emoji: g.emoji, 
                usersCount: g.users.length,
                users: g.users.map(u => ({ id: u.id, name: u.name }))
            })))
        }

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
        
        // Очищаем все предыдущие оптимистичные реакции от этого пользователя (эксклюзивность)
        optimisticReactions.value = optimisticReactions.value.filter(
            (r: OptimisticReaction) => pickUserId(r) !== userId,
        )
        
        // Добавляем новую оптимистичную реакцию
        optimisticReactions.value.push({ id: key, name, icon, user })
        
        // Сбрасываем флаг очистки при добавлении новой реакции
        isOptimisticallyCleared.value = false
        
        console.log('🚀 Добавлена оптимистичная реакция:', { id: key, name, userId })
    }

    const clearOptimisticForMe = () => {
        if (!currentUserId) return
        const beforeCount = optimisticReactions.value.length
        optimisticReactions.value = optimisticReactions.value.filter(
            (r: OptimisticReaction) => pickUserId(r) !== currentUserId,
        )
        const afterCount = optimisticReactions.value.length
        isOptimisticallyCleared.value = true
        
        console.log('🧹 Очищены оптимистичные реакции пользователя:', currentUserId, `(${beforeCount} -> ${afterCount})`)
        
        // Проверяем, есть ли серверные данные для этого пользователя
        const hasServerReaction = extractMyReactionFromServer(message, currentUserId) !== null
        console.log('🔍 Проверка серверных данных после очистки оптимистичных:', { hasServerReaction, messageId: message.id })
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

    // Функция для синхронизации с серверными данными
    const syncWithServerData = () => {
        // Очищаем оптимистичные реакции, так как получили актуальные данные с сервера
        if (optimisticReactions.value.length > 0) {
            console.log('🔄 Синхронизация с серверными данными, очищаем оптимистичные реакции')
            optimisticReactions.value = []
            isOptimisticallyCleared.value = false
        }
    }

    // Автоматическая очистка оптимистичных реакций при изменении серверных данных
    watch(
        () => message?.reactions || message?.message_reactions,
        (newReactions, oldReactions) => {
            // Если серверные реакции изменились и у нас есть оптимистичные реакции
            if (newReactions !== oldReactions && optimisticReactions.value.length > 0) {
                // Небольшая задержка для избежания конфликтов с WebSocket обновлениями
                setTimeout(() => {
                    if (optimisticReactions.value.length > 0) {
                        // Проверяем, что серверные данные действительно содержат реакции текущего пользователя
                        const hasMyReactionInServer = currentUserId && extractMyReactionFromServer(message, currentUserId) !== null
                        
                        if (hasMyReactionInServer) {
                            console.log('🔄 Автоматическая очистка оптимистичных реакций - найдена серверная реакция')
                            optimisticReactions.value = []
                            isOptimisticallyCleared.value = false
                        } else {
                            console.log('🔄 Серверные данные еще не содержат реакцию пользователя, оставляем оптимистичные')
                        }
                    }
                }, 500)
            }
        },
        { deep: true, immediate: false }
    )

    // Принудительное обновление реактивности
    const forceUpdate = () => {
        // Принудительно обновляем computed свойства, изменяя ключ
        console.log('🔄 Принудительное обновление реакций для сообщения:', message.id)
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
        syncWithServerData,
        findThumbsUpReaction,
        forceUpdate,
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

        // Обработка формата {user_id: "...", reaction_type_id: 2, user_name: "...", avatar: null}
        if (item?.user_id && !usersSources.length) {
            const userId = item.user_id
            const userName = item.user_name
            const userAvatar = item.avatar
            
            // Ищем пользователя в участниках чата для дополнительной информации
            const chatMember = chatMembers?.find(m => 
                m.user === userId || m.user_uuid === userId
            )
            
            // Создаем объект пользователя из данных реакции
            const userObj = {
                id: userId,
                user: userId,
                user_id: userId,
                name: userName || chatMember?.user_name || 'Unknown User',
                user_name: userName || chatMember?.user_name || 'Unknown User',
                full_name: userName || chatMember?.user_name || 'Unknown User',
                avatar: userAvatar
            }
            usersSources.push(userObj)
        }

        // Обработка формата с прямым указанием user в корне объекта
        if (item?.user && !usersSources.some(u => (u?.user || u?.id || u?.user_id) === item.user)) {
            const userId = item.user
            const userName = item.user_name
            const userAvatar = item.avatar
            
            const chatMember = chatMembers?.find(m => 
                m.user === userId || m.user_uuid === userId
            )
            
            const userObj = {
                id: userId,
                user: userId,
                user_id: userId,
                name: userName || chatMember?.user_name || 'Unknown User',
                user_name: userName || chatMember?.user_name || 'Unknown User',
                full_name: userName || chatMember?.user_name || 'Unknown User',
                avatar: userAvatar
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
            
            // Проверяем формат {user: "...", reaction_type: 2}
            const isMyUserReaction = item?.user && String(item.user) === currentUserId

            if (hasMyUser || isMyDirectReaction || isMyUserReaction) {
                const id = Number(
                    item?.type_id ??
                        item?.reaction_id ??
                        item?.reaction_type_id ??
                        item?.reaction_type ??
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

<template>
    <div class="reactions-bar">
        <div
            v-for="g in groups"
            :key="g.key"
            class="reaction-pill"
            :class="{ like: g.isThumb }"
            :title="g.tooltip"
        >
            <span v-if="!g.isThumb" class="emoji">{{ g.emoji }}</span>
            <i v-else class="pi pi-thumbs-up emoji-icon" />
            <div class="users">
                <span v-for="u in g.users.slice(0, 3)" :key="u.id" class="user">
                    <img v-if="u.avatar" :src="withBase(u.avatar)" alt="" />
                    <span v-else class="initials">{{ getInitials(u.name) }}</span>
                </span>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { BASE_URL } from '@/refactoring/environment/environment'

defineProps<{
    groups: Array<{
        key: string
        emoji: string
        users: Array<{ id: string | number; name: string; avatar?: string | null }>
        tooltip: string
        isThumb?: boolean
    }>
}>()

const withBase = (path: string | null | undefined) => {
    const p = String(path || '')
    if (!p) return ''
    if (p.startsWith('http')) return p
    return `${BASE_URL}${p}`
}

function getInitials(name: string): string {
    const trimmed = String(name || '').trim()
    
    // Если имя пустое или является резервным значением, возвращаем знак вопроса
    if (!trimmed || trimmed === 'Unknown User') return '??'
    
    const parts = trimmed.split(/\s+/)
    
    // Если это резервный формат "User 123" или "User Unknown"
    if (parts.length === 2 && parts[0] === 'User') {
        const userId = parts[1]
        // Если второй части - это число (ID), используем первые 2 цифры
        if (/^\d+$/.test(userId)) {
            return userId.slice(0, 2).padStart(2, '0')
        }
        // Если это "Unknown", используем специальные символы
        if (userId === 'Unknown') {
            return '??'
        }
        // Иначе используем первые 2 символа
        return userId.slice(0, 2).toUpperCase()
    }
    
    if (parts.length === 1) {
        const word = parts[0]
        // Если это короткое имя или инициал
        if (word.length <= 2) {
            return word.toUpperCase().padEnd(2, '·')
        }
        // Для длинных слов берем первые 2 символа
        return word.slice(0, 2).toUpperCase()
    }
    
    // Для имен пользователей берем инициалы в правильном порядке: Имя + Фамилия
    const firstName = parts[0]
    const lastName = parts[1]
    
    // Проверяем, является ли это именем пользователя (не техническими данными)
    const isLikelyNameSurname = firstName.length <= 15 && lastName.length <= 20 && 
                               !/^\d+$/.test(firstName) && !/^\d+$/.test(lastName)
    
    if (isLikelyNameSurname) {
        return (firstName[0] + lastName[0]).toUpperCase()
    }
    
    // Для остальных случаев берем первые символы первых двух частей
    return (parts[0][0] + (parts[1] ? parts[1][0] : '·')).toUpperCase()
}
</script>

<style lang="scss">
@use '../styles' as *;
</style>

<style lang="scss" scoped>
@use '../styles/mixins' as *;
@use '../styles/variables' as *;
</style>

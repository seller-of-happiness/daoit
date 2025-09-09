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
    const parts = String(name || '')
        .trim()
        .split(/\s+/)
    if (parts.length === 0) return ''
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    
    // Для имен пользователей берем инициалы в правильном порядке: Имя + Фамилия
    const firstName = parts[0]
    const lastName = parts[1]
    
    // Проверяем, является ли это именем пользователя
    const isLikelyNameSurname = firstName.length <= 15 && lastName.length <= 20
    
    if (isLikelyNameSurname) {
        return (firstName[0] + lastName[0]).toUpperCase()
    }
    
    // Для остальных случаев - как было
    return (parts[0][0] + parts[1][0]).toUpperCase()
}
</script>

<style lang="scss">
@use '../styles' as *;
</style>

<style lang="scss" scoped>
@use '../styles/mixins' as *;
@use '../styles/variables' as *;
</style>

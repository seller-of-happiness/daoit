<template>
    <div class="employee-item" @click="$emit('create-dialog')">
        <div class="employee-avatar">
            <i class="pi pi-user"></i>
        </div>

        <div class="flex-1 min-w-0">
            <div class="employee-name">{{ employee.full_name }}</div>
            <div class="employee-info flex flex-col">
                <span v-if="employee.position" class="position">
                    {{ employee.position }}
                </span>
                <span v-if="employee.department" class="department">
                    {{ employee.department.name }}
                </span>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { IEmployee } from '@/refactoring/modules/chat/types/IChat'

interface Props {
    employee: IEmployee
}

interface Emits {
    (e: 'create-dialog'): void
}

defineProps<Props>()
defineEmits<Emits>()
</script>

<style scoped>


.employee-item:hover {
    background-color: var(--surface-100);
}


.position,
.department {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

</style>

<script setup lang="ts">
import { computed } from 'vue'
import { useUserStore } from '@/refactoring/modules/user/stores/userStore'

const userStore = useUserStore()

const fullName = computed(() => {
    const emp = userStore.user
    return emp ? `${emp.last_name} ${emp.first_name} ${emp.middle_name}` : ''
})

const position = computed(() => userStore.user?.position?.name || '-')
const department = computed(() => userStore.user?.department?.name || '-')
const isManager = computed(() => userStore.user?.is_manager ? 'Да' : 'Нет')
</script>

<template>
    <div class="grid grid-cols-12 gap-8 p-4 rounded-2xl shadow-md bg-[--surface-card] text-[--text-color]">
        <!-- Заголовок -->
        <div class="col-span-12 flex justify-center items-center border-b border-surface-200 dark:border-surface-700 pb-2">
            <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-0">
                Профиль пользователя
            </h3>
        </div>

        <!-- Данные профиля -->
        <div class="col-span-12 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <div class="font-semibold text-sm text-[--text-color-secondary] mb-1">ФИО</div>
                <div class="text-base">{{ fullName }}</div>
            </div>

            <div>
                <div class="font-semibold text-sm text-[--text-color-secondary] mb-1">Должность</div>
                <div class="text-base">{{ position }}</div>
            </div>

            <div>
                <div class="font-semibold text-sm text-[--text-color-secondary] mb-1">Отдел</div>
                <div class="text-base">{{ department }}</div>
            </div>

            <div>
                <div class="font-semibold text-sm text-[--text-color-secondary] mb-1">Руководитель</div>
                <div class="text-base">{{ isManager }}</div>
            </div>
        </div>
    </div>
</template>


<style scoped>
</style>

<script setup lang="ts">
/*
 * Компонент отображения статистики сервиса вспомогательных служб
 *
 * Основные функции:
 * - Отображение количества обращений по группам и категориям
 * - Возможность разворачивать/сворачивать списки групп и категорий
 * - Интеграция данных справочников со статистикой обращений
 *
 * Особенности:
 * - Подгружает данные при монтировании компонента
 * - Обрабатывает кастомную структуру данных из хранилища
 * - Поддерживает ограниченный показ элементов с возможностью развернуть
 *
 * Используемые хранилища:
 * - supportServiceStore: хранение справочников групп/категорий и статистики
 * - feedbackStore: доступ к состоянию загрузки
 */

// Импорты Vue и Pinia
import { ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'

// Импорты хранилищ
import { useSupportService } from '@/refactoring/modules/supportService/stores/supportService'
import { useFeedbackStore } from '@/refactoring/modules/feedback/stores/feedbackStore'

// Инициализация хранилищ
const supportServiceStore = useSupportService()
const feedbackStore = useFeedbackStore()

// Деструктуризация значений из хранилищ
const { supportServiceStats, supportServiceGroups, supportServiceCategories } = storeToRefs(supportServiceStore)
const { isGlobalLoading } = storeToRefs(feedbackStore)

// Состояния управления отображением
const expandedGroups = ref(false)      // Флаг развернутого состояния списка групп
const expandedCategories = ref(false)  // Флаг развернутого состояния списка категорий
const maxVisibleItems = 2              // Максимальное количество элементов в свернутом состоянии

/**
 * Получение количества обращений для группы по ID
 * @param id - ID группы сервиса
 * @returns Количество обращений или 0 если статистика не найдена
 */
const getGroupCount = (id: number) => {
    return supportServiceStats.value?.service_groups?.find(g => g.id === id)?.count ?? 0
}

/**
 * Получение количества обращений для категории по ID
 * @param id - ID категории сервиса
 * @returns Количество обращений или 0 если статистика не найдена
 */
const getCategoryCount = (id: number) => {
    return supportServiceStats.value?.service_categories?.find(c => c.id === id)?.count ?? 0
}

/**
 * Формирование видимого списка групп с добавлением статистики
 * Возвращает полный или ограниченный список в зависимости от expandedGroups
 * Обрабатывает кастомную структуру данных из хранилища
 */
const visibleGroups = computed(() => {
    // supportServiceGroups.value — это массив объектов {_custom: { value: { ... } }}, если как в твоем примере
    const all = supportServiceGroups.value.map((g: any) => g._custom ? g._custom.value : g)
    const result = all.map(group => ({
        ...group,
        count: getGroupCount(group.id)
    }))
    return expandedGroups.value ? result : result.slice(0, maxVisibleItems)
})

/**
 * Формирование видимого списка категорий с добавлением статистики
 * Возвращает полный или ограниченный список в зависимости от expandedCategories
 * Обрабатывает кастомную структуру данных из хранилища
 */
const visibleCategories = computed(() => {
    const all = supportServiceCategories.value.map((c: any) => c._custom ? c._custom.value : c)
    const result = all.map(category => ({
        ...category,
        count: getCategoryCount(category.id)
    }))
    return expandedCategories.value ? result : result.slice(0, maxVisibleItems)
})

// Загрузка данных при монтировании компонента
onMounted(() => {
    supportServiceStore.fetchFilteredSupportServices()
})
</script>

<template>
    <div class="flex flex-col md:flex-row col-span-full">
        <!-- Блок групп (только если есть данные и stats) -->
        <div v-if="supportServiceGroups.length > 0 && supportServiceStats?.service_groups"  class="w-full md:w-7/12 flex flex-col">
            <Panel header="Службы" class="min-h-[107px]">
                <div
                    v-if="isGlobalLoading"
                    class="test grid grid-cols-auto-fill-230 gap-2"
                >
                    <Button variant="text" raised>
                        <Skeleton />
                    </Button>
                    <Button variant="text" raised>
                        <Skeleton />
                    </Button>
                </div>
                <div v-else class="test grid grid-cols-auto-fill-230 gap-2">
                    <Button
                        v-for="stat in visibleGroups"
                        :key="stat.id"
                        :severity="stat.id ? 'info' : 'secondary'"
                        :label="stat.name || 'Не выбрано'"
                        :badge="String(stat.count)"
                        variant="outlined"
                    />
                </div>
            </Panel>

            <!-- Кнопка раскрытия (только если категорий больше 2) -->
            <div v-if="supportServiceGroups.length > maxVisibleItems"  class="w-full text-center">
                <Button
                    class="w-full"
                    severity="info"
                    :label="expandedGroups ? 'Свернуть' : 'Раскрыть список'"
                    @click="expandedGroups = !expandedGroups"
                    text
                    :icon="expandedGroups ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
                    :icon-pos="expandedGroups ? 'top' : 'bottom'"
                />
            </div>
        </div>

        <!-- Разделитель (только если есть и группы, и категории со stats) -->
        <div v-if="supportServiceGroups.length > 0 && supportServiceCategories.length > 0 &&
                  supportServiceStats?.service_groups && supportServiceStats?.service_categories"
             class="w-full md:w-1/12"
        >
            <Divider layout="vertical" class="!hidden md:!flex"></Divider>
        </div>

        <!-- Блок категорий (показываем только если есть категории и stats) -->
        <div
            v-if="supportServiceCategories.length > 0 && supportServiceStats?.service_categories"
            class="w-full md:w-7/12 flex flex-col"
        >
            <Panel header="Категории" class="min-h-[107px]">
                <div
                    v-if="isGlobalLoading"
                    class="test grid grid-cols-auto-fill-230 gap-2"
                >
                    <Button variant="text" raised>
                        <Skeleton />
                    </Button>
                    <Button variant="text" raised>
                        <Skeleton />
                    </Button>
                </div>
                <div v-else class="test grid grid-cols-auto-fill-230 gap-2">
                    <Button
                        v-for="stat in visibleCategories"
                        :key="stat.id"
                        :severity="stat.id ? 'info' : 'secondary'"
                        :label="stat.name || 'Не выбрано'"
                        :badge="String(stat.count)"
                        variant="outlined"
                    />
                </div>
            </Panel>

            <!-- Кнопка раскрытия (только если категорий больше 2) -->
            <div v-if="supportServiceCategories.length > maxVisibleItems"  class="w-full text-center">
                <Button
                    class="w-full"
                    severity="info"
                    :label="expandedCategories ? 'Свернуть' : 'Раскрыть список'"
                    @click="expandedCategories = !expandedCategories"
                    text
                    :icon="expandedCategories ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
                    :icon-pos="expandedCategories ? 'top' : 'bottom'"
                />
            </div>
        </div>
    </div>
</template>

<style lang="scss" scoped></style>

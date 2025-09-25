<script setup lang="ts">
/*
 * Форма создания/редактирования события календаря
 *
 * Основные функции:
 * - Создание новых событий календаря
 * - Редактирование существующих событий
 * - Валидация введенных данных
 * - Управление датами и временем события
 * - Выбор местоположения через модальное окно
 * - Настройка категорий, приоритета и статуса
 *
 * Особенности:
 * - Поддержка режима просмотра (read-only)
 * - Автоматическая проверка корректности дат
 * - Опция "Весь день" для однодневных событий
 * - Интеграция с хранилищем календаря
 * - Валидация обязательных полей
 *
 * Используемые хранилища:
 * - calendarStore: управление данными событий
 * - feedbackStore: обработка ошибок и уведомлений
 * - apiStore: доступ к данным больницы
 *
 * Подключенные компоненты:
 * - RoomModal: модальное окно выбора местоположения
 */

// Импорты Vue и сторонних библиотек
import { computed, onMounted, ref, watch, watchEffect } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'

// Импорты хранилищ Pinia
import { useCalendarStore } from '@/refactoring/modules/calendar/stores/calendarStore'
import { useFeedbackStore } from '@/refactoring/modules/feedback/stores/feedbackStore'
import { useApiStore } from '@/refactoring/modules/apiStore/stores/apiStore'

// Вспомогательные функции и типы
import { ERouteNames } from '@/router/ERouteNames'
import { getLocationPath } from '@/refactoring/utils/locationUtils'

// Импорты дочерних компонентов
import RoomModal from '@/components/adverseEvents/RoomModal.vue'

// Инициализация хранилищ и роутера
const route = useRoute()
const router = useRouter()
const calendarStore = useCalendarStore()
const feedbackStore = useFeedbackStore()
const apiStore = useApiStore()

// Деструктуризация значений из хранилищ
const { currentCalendarEvent, isViewMode } = storeToRefs(calendarStore)
const { loadingOnConfirmModal } = storeToRefs(feedbackStore)
const { hospitalSkeleton } = storeToRefs(apiStore)

// Реактивные переменные компонента
const locationTypeModal = ref(false) // Видимость модалки выбора помещения
const manualLocation = ref('') // Текст ручного ввода локации
const isEditingManualLocation = ref(false) // Режим редактирования ручной локации
const validationErrors = ref({ // Ошибки валидации полей формы
    name: false,
    location: false,
    start_datetime: false,
    end_datetime: false,
    date_range: false,
})
const showAllDayCheckbox = ref(false) // Видимость чекбокса "Весь день"

/**
 * Синхронизирует ручной ввод локации с хранилищем
 * - Автоматически обновляет manualLocation при изменении в хранилище
 * - Игнорирует изменения во время редактирования пользователем
 */
watch(
    () => currentCalendarEvent.value?.location,
    (val) => {
        if (!isEditingManualLocation.value) manualLocation.value = val ?? ''
    },
    { immediate: true }
)

/**
 * Включает режим редактирования ручной локации
 * - Копирует текущее значение локации в manualLocation
 * - Активирует флаг редактирования
 * - Сбрасывает ошибку валидации для поля локации
 */
function onEditManualLocation() {
    manualLocation.value = currentCalendarEvent.value?.location ?? ''
    isEditingManualLocation.value = true
    validationErrors.value.location = false
}

/**
 * Сохраняет ручную локацию в хранилище
 * - Обновляет location в currentCalendarEvent
 * - Сбрасывает связанные поля (block, floor, room)
 * - Отключает режим редактирования
 * - Сбрасывает ошибку валидации
 */
function onSaveManualLocation() {
    if (!currentCalendarEvent.value) return

    currentCalendarEvent.value.location = manualLocation.value.trim()
    currentCalendarEvent.value.block = undefined
    currentCalendarEvent.value.floor = undefined
    currentCalendarEvent.value.room = undefined
    isEditingManualLocation.value = false
    validationErrors.value.location = false
}

/**
 * Вычисляет человекочитаемый путь локации из currentCalendarEvent
 * с использованием структуры hospitalSkeleton.
 *
 * Использует утилиту getLocationPath, которая:
 * - возвращает текст "Описано вручную", если поле location заполнено
 * - возвращает null, если отсутствуют данные или hospitalSkeleton пуст
 * - формирует путь: [больница, корпус, этаж, помещение], если доступны соответствующие id
 *
 * Возвращает строку, готовую для отображения в UI, или null.
 */
const locationTypeFullPath = computed(() => {
    return getLocationPath(
        {
            location: currentCalendarEvent.value.location,
            block: currentCalendarEvent.value.block,
            floor: currentCalendarEvent.value.floor,
            room: currentCalendarEvent.value.room
        },
        hospitalSkeleton.value,
        {
            manualText: 'Описано вручную',
            includeHospital: true
        }
    );
});

/**
 * Валидирует форму события
 * - Проверяет обязательные поля (название, локация, даты)
 * - Проверяет корректность диапазона дат
 * - Обновляет объект validationErrors
 * - Показывает toast с ошибками при наличии
 * - Возвращает boolean результат валидации
 */
function validate(): boolean {
    const evt = currentCalendarEvent.value;
    if (!evt) return false;

    // Сбрасываем все ошибки
    validationErrors.value = {
        name: !evt.name?.trim(), // Проверяем название
        location: false,
        start_datetime: false,
        end_datetime: false,
        date_range: false
    };

    const errors: string[] = [];
    let isValid = true;

    // 1. Проверка названия
    if (validationErrors.value.name) {
        errors.push('не указано название');
        isValid = false;
    }

    // 2. Проверка местоположения
    const hasLocation = !!(
        evt.location?.trim() ||
        evt.block?.id ||
        evt.floor?.id ||
        evt.room?.id
    );
    if (!hasLocation) {
        validationErrors.value.location = true;
        errors.push('не указано место проведения');
        isValid = false;
    }

    // 3. Проверка дат
    const hasStart = !!evt.start_datetime && !isNaN(new Date(evt.start_datetime).getTime());
    const hasEnd = !!evt.end_datetime && !isNaN(new Date(evt.end_datetime).getTime());

    if (!hasStart) {
        validationErrors.value.start_datetime = true;
        errors.push('не указана дата начала');
        isValid = false;
    }

    if (!hasEnd) {
        validationErrors.value.end_datetime = true;
        errors.push('не указана дата окончания');
        isValid = false;
    }

    // 4. Проверка диапазона (только если обе даты валидны)
    if (hasStart && hasEnd && evt.start_datetime && evt.end_datetime) {
        const start = new Date(evt.start_datetime);
        const end = new Date(evt.end_datetime);

        if (end <= start) {
            validationErrors.value.date_range = true;
            errors.push('дата окончания должна быть позже даты начала');
            evt.start_datetime = '';
            evt.end_datetime = '';
            isValid = false;
        }
    }

    if (!isValid) {
        feedbackStore.showToast({
            type: 'error',
            title: 'Ошибка валидации',
            message: `Исправьте ошибки: ${errors.join(', ')}`,
            time: 7000
        });
    }

    return isValid;
}

/**
 * Обработчик отправки формы
 * - Выполняет валидацию
 * - Создает или обновляет событие через calendarStore
 * - Закрывает форму при успехе
 * - Обрабатывает ошибки сохранения
 */
async function onSubmit() {

    if (!validate()) {
        return
    }

    try {
        const calendarId = Number(route.params.calendarId)
        if (!calendarId) {
            console.error('[onSubmit] calendarId не определён')
            return
        }

        const evt = currentCalendarEvent.value

        if (!evt?.id) {
            await calendarStore.createCalendarEvent(calendarId, evt!)
        } else {
            await calendarStore.updateCalendarEvent(calendarId, evt.id, evt)
        }

        calendarStore.isShowFormCalendar = false
    } catch (error) {
        console.error('[onSubmit] Ошибка при сохранении события:', error)
    }
}

/**
 * Закрывает форму и возвращает в календарь
 * - Сбрасывает флаг показа формы
 * - Перенаправляет на страницу календаря
 */
function handleClose() {
    calendarStore.isShowFormCalendar = false
    router.push({
        name: ERouteNames.CURRENT_CALENDAR,
        params: { id: route.params.calendarId }
    });
}

/**
 * Вычисляемое свойство для двустороннего связывания даты начала
 * - Преобразует строку в Date объект и обратно
 * - Обрабатывает некорректные даты
 */
const startDateModel = computed<Date | null>({
    get() {
        const val = currentCalendarEvent.value?.start_datetime
        if (!val) return null
        const d = new Date(val)
        return isNaN(d.getTime()) ? null : d
    },
    set(val) {
        if (!currentCalendarEvent.value) return
        currentCalendarEvent.value.start_datetime = val ? val.toISOString() : ''
    },
})

/**
 * Вычисляемое свойство для двустороннего связывания даты окончания
 * - Аналогично startDateModel
 */
const endDateModel = computed<Date | null>({
    get() {
        const val = currentCalendarEvent.value?.end_datetime
        if (!val) return null
        const d = new Date(val)
        return isNaN(d.getTime()) ? null : d
    },
    set(val) {
        if (!currentCalendarEvent.value) return
        currentCalendarEvent.value.end_datetime = val ? val.toISOString() : ''
    },
})

/**
 * Опции категорий для мультиселекта
 * - Преобразует категории из хранилища в формат для Dropdown
 */
const categoryOptions = computed(() => {
    return calendarStore.calendarEventCategories.map(cat => ({
        label: cat.name,
        value: { id: cat.id },
    }))
})

/**
 * Отслеживает изменения дат для управления чекбоксом "Весь день"
 * - Показывает чекбокс только для однодневных событий
 * - Автоматически сбрасывает флаг "Весь день" при изменении диапазона
 */
watchEffect(() => {
    const start = startDateModel.value
    const end = endDateModel.value

    if (!start || !end) {
        showAllDayCheckbox.value = false
        currentCalendarEvent.value && (currentCalendarEvent.value.is_all_day = false)
        return
    }

    const isSameDay =
        start.getFullYear() === end.getFullYear() &&
        start.getMonth() === end.getMonth() &&
        start.getDate() === end.getDate()

    if (isSameDay) {
        showAllDayCheckbox.value = true
    } else {
        showAllDayCheckbox.value = false
        currentCalendarEvent.value && (currentCalendarEvent.value.is_all_day = false)
    }
})

/**
 * Обработчик переключения чекбокса "Весь день"
 * - При включении устанавливает время 00:00 - 23:59
 * - При выключении сбрасывает время окончания
 */
function onToggleAllDay() {
    if (!currentCalendarEvent.value) return

    const start = startDateModel.value
    if (!start) return

    if (currentCalendarEvent.value.is_all_day) {
        // Включили "Весь день" — установим 00:00 и 23:59 этого дня
        const startOfDay = new Date(start)
        startOfDay.setHours(0, 0, 0, 0)

        const endOfDay = new Date(start)
        endOfDay.setHours(23, 59, 59, 999)

        startDateModel.value = startOfDay
        endDateModel.value = endOfDay
    } else {
        // Выключили "Весь день"
        endDateModel.value = null
    }
}

/**
 * Функция определяющая заголовок формы
 * - При режиме просмотра "Просмотр события"
 * - Иначе в зависимости от наличия ID или 'Редактирование события' или 'Новое событие календаря'
 */
const formHeaderText = computed(() => {
    if (isViewMode.value) return 'Просмотр события'
    return currentCalendarEvent.value?.id ? 'Редактирование события' : 'Новое событие календаря'
})

/**
 * Хук жизненного цикла
 * - При монтировании загружает событие для редактирования (если есть ID)
 * - Или сбрасывает форму для создания нового события
 */
onMounted(async () => {
    const eventId = route.params.eventId
    const calendarId = route.params.calendarId

    if (!calendarId) return

    if (eventId) {
        await calendarStore.fetchCalendarEventById(Number(calendarId), Number(eventId))
    } else {
        calendarStore.resetCurrentEvent()
    }
})
</script>

<template>
    <Dialog
        v-model:visible="calendarStore.isShowFormCalendar"
        :style="{ width: '800px' }"
        :modal="true"
        @hide="handleClose"
    >
        <template #header>
            <p class="p-dialog-title">
                {{ formHeaderText }}
            </p>
        </template>

        <Form @submit="onSubmit">
            <div class="grid grid-cols-12 gap-4">
                <!-- Название события -->
                <div class="col-span-12">
                    <label class="block font-bold mb-3 label-required">Название</label>
                    <InputText
                        v-model="currentCalendarEvent!.name"
                        class="w-full"
                        :disabled="isViewMode"
                        :class="{ 'p-invalid': validationErrors.name }"
                    />
                </div>

                <!-- Описание -->
                <div class="col-span-12">
                    <label class="block font-bold mb-3">Описание</label>
                    <Textarea
                        v-model="currentCalendarEvent!.description"
                        rows="3"
                        class="w-full"
                        :disabled="isViewMode"
                    />
                </div>

                <!-- Даты -->
                <div class="col-span-12 md:col-span-6">
                    <label class="block font-bold mb-3 label-required">Начало</label>
                    <DatePicker
                        v-model="startDateModel"
                        showTime
                        showIcon
                        showButtonBar
                        class="w-full"
                        :class="{ 'p-invalid': validationErrors.start_datetime }"
                        :disabled="isViewMode || currentCalendarEvent?.is_all_day"
                    />
                </div>
                <div class="col-span-12 md:col-span-6">
                    <label class="block font-bold mb-3 label-required">Окончание</label>
                    <DatePicker
                        v-model="endDateModel"
                        showTime
                        showIcon
                        showButtonBar
                        class="w-full"
                        :class="{ 'p-invalid': validationErrors.end_datetime }"
                        :disabled="isViewMode || currentCalendarEvent?.is_all_day"
                    />
                </div>
                <div class="col-span-12" v-if="validationErrors.date_range">
                    <small class="p-error">Дата окончания должна быть позже даты начала</small>
                </div>

                <!-- Весь день -->
                <div class="col-span-12">
                    <Checkbox
                        v-if="showAllDayCheckbox"
                        v-model="currentCalendarEvent!.is_all_day"
                        inputId="is_all_day"
                        :binary="true"
                        :disabled="isViewMode"
                        @change="onToggleAllDay"
                    />
                    <label v-if="showAllDayCheckbox" for="is_all_day" class="ml-2">Весь день</label>
                </div>

                <!-- Категории -->
                <div class="col-span-12">
                    <label class="block font-bold mb-3">Категории</label>
                    <MultiSelect
                        v-model="currentCalendarEvent!.categories"
                        :options="categoryOptions"
                        optionLabel="label"
                        optionValue="value"
                        class="w-full"
                        :disabled="isViewMode"
                        :showToggleAll="false"
                    />
                </div>

                <!-- Приоритет -->
                <div class="col-span-12 md:col-span-6">
                    <label class="block font-bold mb-3">Приоритет</label>
                    <Select
                        v-model="currentCalendarEvent!.priority"
                        :options="calendarStore.priorityOptions"
                        option-label="label"
                        option-value="value"
                        class="w-full"
                        :disabled="isViewMode"
                    />
                </div>

                <!-- Статус -->
                <div class="col-span-12 md:col-span-6">
                    <label class="block font-bold mb-3">Статус</label>
                    <Dropdown
                        v-model="currentCalendarEvent!.status"
                        :options="calendarStore.statusOptions"
                        option-label="label"
                        option-value="value"
                        class="w-full"
                        :disabled="isViewMode"
                    />
                </div>

                <!-- Локация -->
                <div class="col-span-12">
                    <label class="block font-bold mb-3">Место</label>

                    <Button
                        v-if="locationTypeFullPath"
                        variant="link"
                        @click="locationTypeModal = true"
                        :class="[{ 'text-red-500': validationErrors.location }]"
                        :disabled="isViewMode"
                    >
                        {{ locationTypeFullPath }}
                    </Button>
                    <Button
                        v-else
                        @click="locationTypeModal = true"
                        label="Не выбрано. Нажмите, чтобы выбрать"
                        variant="link"
                        :class="[{ 'text-red-500': validationErrors.location }]"
                        :disabled="isViewMode"
                    />

                    <div v-if="locationTypeFullPath === 'Описано вручную'" class="mt-2">
                        <textarea
                            v-model="manualLocation"
                            :readonly="isViewMode || !isEditingManualLocation"
                            :disabled="isViewMode || !isEditingManualLocation"
                            rows="4"
                            class="w-full p-2 rounded resize-none transition border-2 outline-none"
                            :class="isEditingManualLocation
                                ? 'border-[var(--primary-color)] bg-[var(--surface-card)] text-[var(--text-color)]'
                                : 'border-[var(--surface-border)] bg-[var(--surface-card)] text-[var(--text-color-secondary)] cursor-not-allowed'"
                        ></textarea>
                        <Button
                            class="mt-2"
                            :label="isEditingManualLocation ? 'Сохранить' : 'Редактировать'"
                            :icon="isEditingManualLocation ? 'pi pi-check' : 'pi pi-pencil'"
                            :severity="isEditingManualLocation ? 'success' : 'info'"
                            @click="!isViewMode && (isEditingManualLocation ? onSaveManualLocation() : onEditManualLocation())"
                            :disabled="isViewMode"
                            v-if="!isViewMode"
                        />
                    </div>
                </div>
            </div>

            <div class="flex justify-end gap-3 mt-4">
                <Button
                    text
                    label="Отмена"
                    icon="pi pi-times"
                    @click="handleClose"
                    :disabled="loadingOnConfirmModal"
                />
                <Button
                    v-if="!isViewMode"
                    :label="currentCalendarEvent?.id ? 'Сохранить' : 'Создать'"
                    icon="pi pi-check"
                    type="submit"
                    :loading="loadingOnConfirmModal"
                />
            </div>
        </Form>
    </Dialog>

    <RoomModal
        v-model:visible="locationTypeModal"
        @closeModal="locationTypeModal = false"
        :disabled="isViewMode"
        targetStore="calendarStore"
    />
</template>

<style scoped>
.label-required::after {
    content: '*';
    color: #ff5252;
    margin-left: 4px;
}

.border-red-500 {
    border-color: #ef4444;
}
.text-red-500 {
    color: #ef4444;
    border: 1px solid #ef4444;
}

.p-invalid {
    border-color: #ef4444 !important;
}

.p-error {
    color: #ef4444;
    font-size: 0.875rem;
}

.p-datepicker.p-invalid {
    border: 1px solid #ef4444 !important;
    box-shadow: none !important;
    border-radius: 6px;
}
</style>

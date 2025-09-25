<script setup lang="ts">
/*
* Компонент модального окна для добавления участников события.
*
* Основные функции:
* - Поддерживает два типа участников: пациенты и посетители
* - Валидирует обязательные поля (ФИО, дата рождения)
* - Автоматически форматирует введенные данные (телефон, дата)
* - Генерирует уникальный ID для новых участников
* - Сохраняет данные в текущее событие
* - Адаптивный интерфейс для разных размеров экрана
*/

// Импорт необходимых функций Vue и утилит
import { computed, reactive } from 'vue'
import { useFeedbackStore } from '@/refactoring/modules/feedback/stores/feedbackStore'
import { useApiStore } from '@/refactoring/modules/apiStore/stores/apiStore'
import { storeToRefs } from 'pinia'
import { formatBirthday, formatAndClearPhoneNumber } from '@/refactoring/utils/formatters'

// Инициализация хранилищ:
const feedbackStore = useFeedbackStore()
const apiStore = useApiStore()
// Получаем реактивную ссылку на текущее событие
const { currentAdverseEvent } = storeToRefs(apiStore)

// Управление видимостью диалога через v-model
const visible = defineModel<boolean>('visible')
// Событие закрытия модального окна
const emit = defineEmits(['closeModal'])

// Определение пропсов компонента:
// eventParticipantType - тип участника ('Пациент' или другой)
const props = defineProps({
    eventParticipantType: {
        type: String,
        required: true,
    },
})

// Реактивное состояние формы участника
const state = reactive({
    full_name: '', // ФИО участника
    birth_date: null, // Дата рождения
    phone_number: '', // Номер телефона
    comment: '', // Дополнительный комментарий
})

// Вычисляемое свойство для заголовка диалога
const dialogHeader = computed(() => {
    return props.eventParticipantType === 'Пациент'
        ? 'Информация о пациенте'
        : 'Информация о посетителе'
})

/**
 * Проверяет валидность даты в формате дд.мм.гггг
 * @param dateStr - строка с датой
 * @returns true, если дата валидна
 */
function isValidDate(dateStr: string | null): boolean {
    if (!dateStr) return false
    // Разбиваем дату на компоненты
    const [dd, mm, yyyy] = dateStr.split('.').map(Number)
    return Boolean(
        dd && mm && yyyy &&
        mm >= 1 && mm <= 12 && // Проверяем месяц
        dd >= 1 && dd <= new Date(yyyy, mm, 0).getDate() && // Проверяем день
        yyyy >= 1900 && yyyy <= new Date().getFullYear() // Проверяем год
    )
}

/**
 * Генерирует случайный 5-символьный идентификатор
 * @returns Строка с идентификатором
 */
const createId = (): string => {
    let id = ''
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    for (let i = 0; i < 5; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return id
}

/**
 * Очищает состояние формы
 */
function clearState() {
    state.full_name = ''
    state.birth_date = null
    state.phone_number = ''
    state.comment = ''
}

/**
 * Устанавливает данные участника в хранилище и закрывает модальное окно.
 */
function setData() {
    const rawBirth = (state.birth_date ?? '').trim()
    const hasBirthInput = /\d/.test(rawBirth)

    if (hasBirthInput && !isValidDate(rawBirth)) {
        feedbackStore.showToast({
            type: 'error',
            title: 'Ошибка',
            message: 'Введите корректную дату рождения (дд.мм.гггг)',
            time: 5000,
        })
        return
    }

    // Инициализация массива участников, если его нет
    if (!Array.isArray(currentAdverseEvent.value.participants)) {
        currentAdverseEvent.value.participants = []
    }

    // Добавление нового участника
    currentAdverseEvent.value.participants.push({
        ...state,
        birth_date: state.birth_date ? formatBirthday(state.birth_date) : null, // Форматирование даты
        phone_number: formatAndClearPhoneNumber(state.phone_number), // Форматирование телефона
        key: createId(), // Генерация уникального ключа
        participant_type: props.eventParticipantType === 'Пациент'
            ? 'patient' // Тип для пациента
            : 'visitor', // Тип для посетителя
    })

    // Очистка формы и закрытие модального окна
    clearState()
    emit('closeModal')
}
</script>

<template>
    <!-- Модальное окно для добавления участника -->
    <Dialog
        v-model:visible="visible"
        :header="dialogHeader"
        :modal="true"
        :style="{ width: '1000px', 'min-height': '600px' }"
    >
        <!-- Форма для ввода данных участника -->
        <div class="grid grid-cols-12 gap-4">
            <!-- Поле ФИО -->
            <div class="col-span-12 md:col-span-4">
                <label for="fio" class="block font-bold mb-3">ФИО</label>
                <InputText
                    id="fio"
                    v-model="state.full_name"
                    placeholder="Введите ФИО"
                    class="w-full"
                />
            </div>

            <!-- Поле даты рождения с маской ввода -->
            <div class="col-span-12 md:col-span-4">
                <label for="date_time" class="block font-bold mb-3">Дата рождения</label>
                <InputMask
                    id="date_time"
                    v-model="state.birth_date"
                    placeholder="Введите дату рождения"
                    mask="99.99.9999"
                    class="w-full"
                    slot-char="дд.мм.гггг"
                />
            </div>

            <!-- Поле телефона с маской ввода -->
            <div class="col-span-12 md:col-span-4">
                <label for="phone" class="block font-bold mb-3">Номер телефона</label>
                <InputMask
                    id="phone"
                    v-model="state.phone_number"
                    mask="+7 (999) 999-99-99"
                    placeholder="+7"
                    fluid
                />
            </div>

            <!-- Поле комментария -->
            <div class="col-span-full">
                <label for="comment" class="block font-bold mb-3">Комментарий</label>
                <Textarea id="comment" v-model="state.comment" rows="20" cols="30" class="w-full" />
            </div>
        </div>

        <!-- Кнопки действий -->
        <div class="flex justify-end gap-3 dialog-actions">
            <!-- Кнопка отмены -->
            <Button label="Отменить" icon="pi pi-times" text @click="emit('closeModal')" />
            <!-- Кнопка сохранения -->
            <Button label="Выбрать" icon="pi pi-check" @click="setData" />
        </div>
    </Dialog>
</template>

<!-- Стили компонента -->
<style lang="scss" scoped></style>

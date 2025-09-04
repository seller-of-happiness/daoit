<script setup lang="ts">
/*
* Компонент модального окна для ввода текстового комментария.
*
* Основные функции:
* - Позволяет ввести многострочный комментарий
* - Поддерживает два режима работы: для участников событий и для описания локации
* - Валидирует обязательность заполнения поля
* - Генерирует уникальный ID для новых записей
* - Автоматически заполняет поле при редактировании
*/

// Импорт необходимых модулей Vue и сторов Pinia
import { computed, reactive, watch } from 'vue'
import { useFeedbackStore } from '@/refactoring/modules/feedback/stores/feedbackStore'
import { useApiStore } from '@/refactoring/modules/apiStore/stores/apiStore'
import { useSupportService } from '@/refactoring/modules/supportService/stores/supportService'
import { useCalendarStore } from '@/refactoring/modules/calendar/stores/calendarStore'
import { storeToRefs } from 'pinia'

// Инициализация хранилищ:
// feedbackStore - для показа уведомлений и toast-сообщений
// apiStore - основное хранилище данных приложения
const feedbackStore = useFeedbackStore()
const apiStore = useApiStore()
const supportService = useSupportService()
const calendarStore = useCalendarStore()

// Получаем реактивную ссылку на текущее нежелательное событие из apiStore
const { currentAdverseEvent } = storeToRefs(apiStore)
// Получаем реактивную ссылку на текущее заявку во вспомогательную службу из supportService
const { currentSupportService } = storeToRefs(supportService)
// Получаем реактивную ссылку на текущее событие из calendarStore
const { currentCalendarEvent } = storeToRefs(calendarStore)

// Определение props компонента:
// visible - управляет видимостью модального окна
// targetField - определяет целевое поле для сохранения ('participants' или 'location')
// defaultComment - начальное значение комментария (необязательное)
const props = defineProps<{
    visible: boolean
    targetField?: 'participants' | 'apiStoreLocation' | 'supportStoreLocation' | 'calendarStoreLocation'
    defaultComment?: string
}>()

// Определение событий компонента:
// update:visible - для синхронизации состояния видимости
// closeModal - при закрытии модалки
// onSaved - при успешном сохранении данных
const emit = defineEmits(['update:visible', 'closeModal', 'onSaved'])

// Вычисляемое свойство для двустороннего связывания visible
const visible = computed({
    get: () => props.visible,
    set: v => emit('update:visible', v),
})

// Локальное состояние компонента:
// comment - хранит текущий текст комментария
const state = reactive({
    comment: props.defaultComment ?? '',
})

// Следим за изменением visible, чтобы сбрасывать comment при открытии
watch(
    () => props.visible,
    (val) => {
        if (val) {
            state.comment = props.defaultComment ?? ''
        }
    }
)

// Генерация случайного 5-символьного ID для новых участников
const createId = () => {
    let id = ''
    let chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    for (let i = 0; i < 5; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return id
}

// Основная функция сохранения данных:
// - Проверяет заполненность комментария
// - В зависимости от targetField сохраняет либо в location, либо в participants
// - Вызывает соответствующие события
function setData() {
    if (!state.comment.trim()) {
        feedbackStore.showToast({
            type: 'error',
            title: 'Ошибка!',
            message: 'Заполните поле',
            time: 3000,
        })
        return
    }

    const comment = state.comment.trim()

    if (props.targetField === 'apiStoreLocation') { // 🔄
        currentAdverseEvent.value.location = comment
        currentAdverseEvent.value.block = null
        currentAdverseEvent.value.floor = null
        currentAdverseEvent.value.room = null
    } else if (props.targetField === 'supportStoreLocation') {
        currentSupportService.value.location = comment
        currentSupportService.value.block = null
        currentSupportService.value.floor = null
        currentSupportService.value.room = null
    } else if (props.targetField === 'calendarStoreLocation') { // 🔄
        currentCalendarEvent.value.location = comment
        currentCalendarEvent.value.block = null
        currentCalendarEvent.value.floor = null
        currentCalendarEvent.value.room = null
    } else {
        if (!Array.isArray(currentAdverseEvent.value.participants)) {
            currentAdverseEvent.value.participants = []
        }
        currentAdverseEvent.value.participants.push({
            full_name: 'Другое',
            comment: comment,
            key: createId(),
            birth_date: null,
            phone_number: '',
            participant_type: 'other',
        })
    }

    emit('onSaved', comment)
    emit('update:visible', false)
    emit('closeModal')
}
</script>

<template>
    <!-- Основное модальное окно для ввода комментария -->
    <Dialog
        v-model:visible="visible"
        header="Оставить комментарий"
        :modal="true"
        :style="{ width: '1000px', 'min-height': '600px' }"
    >
        <!-- Контейнер с полем ввода -->
        <div class="grid grid-cols-12 gap-4">
            <div class="col-span-full">
                <!-- Заголовок поля (меняется в зависимости от targetField) -->
                <label for="comment" class="block font-bold mb-3">
                    {{
                        props.targetField === 'apiStoreLocation' ||
                        props.targetField === 'supportStoreLocation' ||
                        props.targetField === 'calendarStoreLocation'
                            ? 'Опишите место'
                            : 'Комментарий'
                    }}
                </label>
                <!-- Поле текстового ввода -->
                <Textarea id="comment" v-model="state.comment" rows="20" cols="30" class="w-full" />
            </div>
        </div>

        <!-- Кнопки действий в модальном окне -->
        <div class="flex justify-end gap-3 dialog-actions">
            <!-- Кнопка отмены -->
            <Button label="Отменить" icon="pi pi-times" text @click="emit('closeModal')" />
            <!-- Кнопка сохранения -->
            <Button label="Выбрать" icon="pi pi-check" @click="setData" />
        </div>
    </Dialog>
</template>

<!-- Стили компонента (пустые) -->
<style lang="scss" scoped></style>

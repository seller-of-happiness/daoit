import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router/index'
import Aura from '@primeuix/themes/aura'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import ProgressSpinner from 'primevue/progressspinner'
import Toast from 'primevue/toast'
import Password from 'primevue/password'
import InputText from 'primevue/inputtext'
import Tooltip from 'primevue/tooltip'
import Menu from 'primevue/menu'
import ConfirmDialog from 'primevue/confirmdialog'
import ConfirmationService from 'primevue/confirmationservice'
import { logger } from '@/refactoring/utils/eventLogger'
import '@/refactoring/utils/axiosInterceptors'
import { useAuthStore } from '@/refactoring/modules/authStore/stores/authStore'
import { useCentrifugeStore } from '@/refactoring/modules/centrifuge/stores/centrifugeStore'
import Chart from 'primevue/chart'

import '@/assets/styles.scss'

const savedTheme = localStorage.getItem('theme')
if (savedTheme === 'dark') {
    document.documentElement.classList.add('app-dark')
} else {
    document.documentElement.classList.remove('app-dark')
}

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(logger)
app.use(PrimeVue, {
    theme: {
        preset: Aura,
        ripple: true,
        options: {
            darkModeSelector: '.app-dark',
        },
    },
    locale: {
        firstDayOfWeek: 1,
        dayNames: [
            'Воскресенье',
            'Понедельник',
            'Вторник',
            'Среда',
            'Четверг',
            'Пятница',
            'Суббота',
        ],
        dayNamesShort: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
        dayNamesMin: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
        monthNames: [
            'Январь',
            'Февраль',
            'Март',
            'Апрель',
            'Май',
            'Июнь',
            'Июль',
            'Август',
            'Сентябрь',
            'Октябрь',
            'Ноябрь',
            'Декабрь',
        ],
        monthNamesShort: [
            'Янв',
            'Фев',
            'Мар',
            'Апр',
            'Май',
            'Июн',
            'Июл',
            'Авг',
            'Сен',
            'Окт',
            'Ноя',
            'Дек',
        ],
        today: 'Сегодня',
        clear: 'Очистить',
        cancel: 'Отмена',
        dateFormat: 'dd.mm.yy',
        weekHeader: 'Нед',
        isRTL: false,
        selectionMessage: `Выбрано элементов - {0}`,
        emptyFilterMessage: 'Ничего не найдено',
        emptySearchMessage: 'Ничего не найдено',
        passwordPrompt: 'Введите пароль',
        chooseDate: 'Выберите дату',
        chooseMonth: 'Выберите месяц',
        chooseYear: 'Выберите год',
    },
})
app.use(ToastService)
app.use(ConfirmationService)

app.component('app-spinner', ProgressSpinner)
app.component('app-toast', Toast)
app.component('app-input-password', Password)
app.component('app-inputtext', InputText)
app.component('app-menu', Menu)
app.component('app-confirm-dialog', ConfirmDialog)
app.directive('app-tooltip', Tooltip)
app.component('Chart', Chart)

const authStore = useAuthStore()
await authStore.restoreAuth()
// Гарантируем попытку переподключения к Centrifugo после восстановления сессии
try {
    const centrifugeStore = useCentrifugeStore()
    await centrifugeStore.initCentrifuge()
} catch (e) {
    console.warn('[MAIN] Centrifugo init skipped', e)
}

app.mount('#app')

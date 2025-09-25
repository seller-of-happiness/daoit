import { computed, reactive } from 'vue'
import type { ILayoutConfig, ILayoutState } from '@/layout/composables/types/ILayout'

const layoutConfig = reactive<ILayoutConfig>({
    preset: 'Aura',
    primary: 'sky',
    surface: null,
    menuMode: 'static',
})

const isDarkTheme = computed(() =>
    document.documentElement.classList.contains('app-dark')
)

const layoutState = reactive<ILayoutState>({
    staticMenuDesktopInactive: false,
    overlayMenuActive: false,
    profileSidebarVisible: false,
    configSidebarVisible: false,
    staticMenuMobileActive: false,
    menuHoverActive: false,
    activeMenuItem: null,
})

export function useLayout() {
    const setActiveMenuItem = (item: string) => {
        layoutState.activeMenuItem = item
    }

    const toggleDarkMode = () => {
        if (!(window as any).document.startViewTransition) {
            doToggle()
            return
        }
        (window as any).document.startViewTransition(() => doToggle())
    }

    function doToggle() {
        document.documentElement.classList.toggle('app-dark')
        // --- сохраняем выбор пользователя ---
        localStorage.setItem(
            'theme',
            document.documentElement.classList.contains('app-dark') ? 'dark' : 'light'
        )
    }

    const toggleMenu = () => {
        if (layoutConfig.menuMode === 'overlay') {
            layoutState.overlayMenuActive = !layoutState.overlayMenuActive
        }
        if (window.innerWidth > 991) {
            layoutState.staticMenuDesktopInactive = !layoutState.staticMenuDesktopInactive
        } else {
            layoutState.staticMenuMobileActive = !layoutState.staticMenuMobileActive
        }
    }

    const isSidebarActive = computed(() =>
        layoutState.overlayMenuActive || layoutState.staticMenuMobileActive
    )

    const getPrimary = computed(() => layoutConfig.primary)

    const getSurface = computed(() => layoutConfig.surface)

    return {
        layoutConfig,
        layoutState,
        toggleMenu,
        isSidebarActive,
        isDarkTheme,
        getPrimary,
        getSurface,
        setActiveMenuItem,
        toggleDarkMode,
    }
}

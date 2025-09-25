export interface ILayoutConfig {
    preset: string
    primary: string
    surface: string | null
    menuMode: 'static' | 'overlay'
}

export interface ILayoutState {
    staticMenuDesktopInactive: boolean
    overlayMenuActive: boolean
    profileSidebarVisible: boolean
    configSidebarVisible: boolean
    staticMenuMobileActive: boolean
    menuHoverActive: boolean
    activeMenuItem: string | null
}

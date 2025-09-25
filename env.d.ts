/// <reference types="vite/client" />
declare module '*.vue'

// Типы для внешних библиотек
declare module 'photoswipe/lightbox' {
    export default class PhotoSwipeLightbox {
        constructor(options: any)
        init(): void
        destroy(): void
    }
}

declare module 'photoswipe' {
    export default class PhotoSwipe {
        constructor(options: any)
    }
}

declare module 'vue3-emoji-picker' {
    import { DefineComponent } from 'vue'
    const EmojiPicker: DefineComponent<any, any, any>
    export default EmojiPicker
}

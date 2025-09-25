/**
 * Композабл для работы с PhotoSwipe галереей
 * Централизует инициализацию и очистку PhotoSwipe
 */
import { onMounted, onUnmounted } from 'vue'
import type { PhotoSwipeOptions, PhotoSwipeInstance } from '@/refactoring/modules/chat/types/IChat'

export function usePhotoSwipe(options: PhotoSwipeOptions) {
    let lightboxInstance: PhotoSwipeInstance | null = null

    const initPhotoSwipe = async () => {
        if (typeof window === 'undefined') return

        try {
            const [lightboxModule, photoswipeModule] = await Promise.all([
                import('photoswipe/lightbox'),
                import('photoswipe'),
            ])

            const PhotoSwipeLightbox = lightboxModule.default

            lightboxInstance = new PhotoSwipeLightbox({
                gallery: options.gallery,
                children: options.children,
                pswpModule: () => photoswipeModule,
            })

            lightboxInstance.init()

            // Сохраняем ссылку для очистки
            window.__chatPswp = lightboxInstance
        } catch (error) {
            // Игнорируем ошибки инициализации PhotoSwipe
        }
    }

    const destroyPhotoSwipe = () => {
        try {
            const instance = lightboxInstance || window.__chatPswp
            if (instance && typeof instance.destroy === 'function') {
                instance.destroy()
            }
            window.__chatPswp = null
            lightboxInstance = null
        } catch (error) {
            // Игнорируем ошибки очистки PhotoSwipe
        }
    }

    onMounted(() => {
        void initPhotoSwipe()
    })

    onUnmounted(() => {
        destroyPhotoSwipe()
    })

    return {
        initPhotoSwipe,
        destroyPhotoSwipe,
    }
}

/**
 * Функция для установки размеров изображения в PhotoSwipe атрибуты
 */
export function setImageDimensions(event: Event) {
    const img = event.target as HTMLImageElement
    const anchor = img?.closest('a') as HTMLElement | null

    if (!img || !anchor) return

    const width = img.naturalWidth || img.width
    const height = img.naturalHeight || img.height

    if (width && height) {
        anchor.setAttribute('data-pswp-width', String(width))
        anchor.setAttribute('data-pswp-height', String(height))
    }
}

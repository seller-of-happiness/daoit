import type { IMessage } from '@/refactoring/modules/chat/types/IChat'

/**
 * Форматирует текст сообщения для отображения в списке чатов
 * Ограничивает длину до 65 символов и добавляет многоточие при необходимости
 * @param content - текст сообщения
 * @param maxLength - максимальная длина (по умолчанию 65)
 */
export function formatMessagePreview(content: string, maxLength: number = 65): string {
    const cleanContent = content.trim().replace(/\s+/g, ' ')

    if (cleanContent.length <= maxLength) {
        return cleanContent
    }

    return cleanContent.slice(0, maxLength) + '...'
}

/**
 * Получает текстовое представление сообщения с учетом вложений
 * @param message - объект сообщения
 */
export function getMessageDisplayText(message: IMessage): string {
    // Если есть текст, используем его
    if (message.content && message.content.trim()) {
        return message.content.trim()
    }

    // Если есть вложения, показываем информацию о них
    if (message.attachments && message.attachments.length > 0) {
        const count = message.attachments.length
        if (count === 1) {
            return '📎 Файл'
        }
        return `📎 ${count} файла`
    }

    // Если ничего нет
    return ''
}

/**
 * Проверяет, является ли сообщение отправленным текущим пользователем
 * @param message - объект сообщения
 * @param currentUserId - ID текущего пользователя
 */
export function isOwnMessage(message: IMessage, currentUserId: string | number | null): boolean {
    if (!currentUserId) return false

    const currentUserIdStr = String(currentUserId)
    const messageAuthorId = String(message.author_id || message.user_id || message.author || '')

    return messageAuthorId === currentUserIdStr
}

export function isTokenValid(expiry: string | Date | null | undefined): boolean {
    if (!expiry) return false
    const expiryDate = typeof expiry === 'string' ? new Date(expiry) : expiry
    return expiryDate > new Date()
}

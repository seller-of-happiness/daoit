export const API_URL = import.meta.env.VITE_API_URL
export const BASE_URL = import.meta.env.VITE_BASE_URL
export const ENDPOINT = import.meta.env.VITE_CENTR_ENDPOINT
export const FILTRATION_TYPE = import.meta.env.VITE_GLOBAL_FILTRATION_TYPE ?? 'front'
export const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? '1.0.0'
export const TIMEZONE = Number(import.meta.env.VITE_TIMEZONE_OFFSET_HOURS ?? 3)
export const FAST_LOGIN = import.meta.env.VITE_FAST_LOGIN ?? false

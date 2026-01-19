import { format } from "date-fns"
import { es } from "date-fns/locale"

// Configuración de zona horaria GMT-4 (Santo Domingo)
export const TIMEZONE = "America/Santo_Domingo"

// Formato de fecha DD/MM/YYYY
export const DATE_FORMAT = "dd/MM/yyyy"

// Formato de fecha y hora
export const DATETIME_FORMAT = "dd/MM/yyyy HH:mm"

// Locale español para date-fns
export const SPANISH_LOCALE = es

// Nombres de meses en español
export const MONTHS_ES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
]

// Nombres cortos de meses en español
export const MONTHS_SHORT_ES = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
]

// Nombres de días de la semana en español
export const WEEKDAYS_ES = [
    "Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"
]

// Nombres completos de días de la semana en español
export const WEEKDAYS_LONG_ES = [
    "Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"
]

/**
 * Formatea una fecha al formato DD/MM/YYYY
 */
export function formatDate(date: Date | string | number): string {
    const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date
    return format(d, DATE_FORMAT, { locale: SPANISH_LOCALE })
}

/**
 * Formatea una fecha y hora al formato DD/MM/YYYY HH:mm
 */
export function formatDateTime(date: Date | string | number): string {
    const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date
    return format(d, DATETIME_FORMAT, { locale: SPANISH_LOCALE })
}

/**
 * Formatea una hora al formato HH:mm en zona horaria GMT-4
 */
export function formatTime(date: Date | string | number): string {
    const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date
    return format(d, "HH:mm", { locale: SPANISH_LOCALE })
}

/**
 * Formatea una fecha con nombre del mes en español
 */
export function formatDateWithMonthName(date: Date | string | number): string {
    const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date
    return format(d, "dd 'de' MMMM 'de' yyyy", { locale: SPANISH_LOCALE })
}

/**
 * Obtiene el nombre del mes en español
 */
export function getMonthName(monthIndex: number): string {
    return MONTHS_ES[monthIndex]
}

/**
 * Obtiene el nombre corto del mes en español
 */
export function getMonthShortName(monthIndex: number): string {
    return MONTHS_SHORT_ES[monthIndex]
}

/**
 * Obtiene el nombre del día de la semana en español
 */
export function getWeekdayName(dayIndex: number): string {
    return WEEKDAYS_ES[dayIndex]
}

/**
 * Convierte una fecha a la zona horaria GMT-4
 */
export function toGMT4(date: Date): Date {
    // Crear una fecha en la zona horaria de Santo Domingo (GMT-4)
    return new Date(date.toLocaleString("en-US", { timeZone: TIMEZONE }))
}

/**
 * Obtiene la fecha y hora actual en GMT-4
 */
export function getNowGMT4(): Date {
    return toGMT4(new Date())
}
export function formatDateDO(date: Date | string | number) {
    return new Intl.DateTimeFormat("es-DO", {
        timeZone: "America/Santo_Domingo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date(date))
}

export function formatDateTimeDO(date: Date | string | number) {
    return new Intl.DateTimeFormat("es-DO", {
        timeZone: "America/Santo_Domingo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    }).format(new Date(date))
}

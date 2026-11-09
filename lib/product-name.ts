/**
 * Normalizes a product name for duplicate comparison.
 * Trims, collapses any run of whitespace to a single space,
 * lowercases using Spanish locale, and strips diacritics.
 */
export function normalizeProductName(name: string): string {
    return name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .replace(/\s+/g, " ")
        .toLocaleLowerCase("es")
}

/**
 * Cleans a product name before storage.
 * Trims and collapses internal whitespace to a single space,
 * preserving original case and accents.
 */
export function cleanProductName(name: string): string {
    return name.trim().replace(/\s+/g, " ")
}

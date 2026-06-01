const DEFAULT_INSFORGE_BASE_URL = "https://base.azokia.com"

function getInsForgeBaseUrl() {
  const rawBaseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL || DEFAULT_INSFORGE_BASE_URL
  const withProtocol = /^https?:\/\//i.test(rawBaseUrl) ? rawBaseUrl : `https://${rawBaseUrl}`
  return withProtocol.replace(/\/+$/, "")
}

function encodeStorageKey(key: string) {
  return key
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/")
}

export function getStorageObjectUrl(bucket: string, key: string) {
  return `${getInsForgeBaseUrl()}/api/storage/buckets/${encodeURIComponent(bucket)}/objects/${encodeStorageKey(key)}`
}

export function normalizeStorageObjectUrl(url?: string | null, key?: string | null, bucket = "company-logos") {
  if (key) {
    return getStorageObjectUrl(bucket, key)
  }

  if (!url) return ""
  if (url.startsWith("data:image/") || url.startsWith("/")) return url

  const withProtocol = /^https?:\/\//i.test(url) ? url : `https://${url}`

  try {
    const parsed = new URL(withProtocol)
    if (parsed.pathname.startsWith("/storage/buckets/")) {
      parsed.pathname = `/api${parsed.pathname}`
    }
    return parsed.toString()
  } catch {
    return url
  }
}

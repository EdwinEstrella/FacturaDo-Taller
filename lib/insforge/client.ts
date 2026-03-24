import { createClient as createInsForgeClient } from '@insforge/sdk'

export function createClient() {
  return createInsForgeClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!
  })
}

export function createServerClient() {
  return createInsForgeClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
    isServerMode: true
  })
}
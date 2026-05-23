'use client'

type TokenProvider = () => Promise<string>

let tokenProvider: TokenProvider | null = null

export const localAdminBypassEnabled =
  process.env.NODE_ENV === 'development' &&
  process.env.NEXT_PUBLIC_LOCAL_ADMIN_BYPASS === 'true'

export const localAdminEmail = process.env.NEXT_PUBLIC_LOCAL_ADMIN_EMAIL ?? ''

export function setAdminTokenProvider(provider: TokenProvider | null) {
  tokenProvider = provider
}

export async function adminAuthHeaders(): Promise<Record<string, string>> {
  if (localAdminBypassEnabled && localAdminEmail) {
    return { 'X-Local-Admin-Email': localAdminEmail }
  }

  if (!tokenProvider) return {}
  const token = await tokenProvider()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

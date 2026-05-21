// MSAL Browser 設定
// Single-tenant：限定 TKU Entra ID 帳號
import type { Configuration, RedirectRequest } from '@azure/msal-browser'

const tenantId = process.env.NEXT_PUBLIC_AZURE_TENANT_ID ?? ''
const clientId = process.env.NEXT_PUBLIC_AZURE_CLIENT_ID ?? ''
const redirectUri =
  process.env.NEXT_PUBLIC_AZURE_REDIRECT_URI ??
  (typeof window !== 'undefined' ? window.location.origin : '')

export const ADMIN_ROLE = 'Admin'

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri,
    postLogoutRedirectUri: redirectUri,
  },
  cache: {
    cacheLocation: 'sessionStorage',
  },
}

// 只用 OIDC 標準 scopes — 不需要 admin/user consent 對 Microsoft Graph，
// 適合 Guest user 也能直接登入。token 仍會帶 name / preferred_username / roles。
export const loginRequest: RedirectRequest = {
  scopes: ['openid', 'profile', 'email'],
}

export interface PortalUserClaims {
  email: string
  displayName: string
  roles: string[]
  tid: string
}

export function readClaims(account: {
  username: string
  name?: string
  idTokenClaims?: Record<string, unknown>
}): PortalUserClaims {
  const claims = account.idTokenClaims ?? {}
  return {
    email: account.username,
    displayName: account.name ?? '',
    roles: Array.isArray(claims.roles) ? (claims.roles as string[]) : [],
    tid: typeof claims.tid === 'string' ? claims.tid : '',
  }
}

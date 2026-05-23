import { Configuration, LogLevel } from '@azure/msal-browser'
import type { AccountInfo } from '@azure/msal-browser'

const clientId = process.env.NEXT_PUBLIC_AZURE_CLIENT_ID ?? ''
const tenantId = process.env.NEXT_PUBLIC_AZURE_TENANT_ID ?? ''

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: typeof window !== 'undefined' ? window.location.origin : '/',
    postLogoutRedirectUri: typeof window !== 'undefined' ? window.location.origin : '/',
  },
  cache: {
    cacheLocation: 'sessionStorage',
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return
        if (level === LogLevel.Error) console.error(message)
      },
    },
  },
}

export const loginRequest = {
  scopes: ['openid', 'profile', 'email'],
}

export function readClaims(account: AccountInfo): {
  email: string
  displayName: string
  roles: string[]
} {
  const claims = account.idTokenClaims as Record<string, unknown> | undefined
  const email =
    (claims?.preferred_username as string) ??
    (claims?.email as string) ??
    account.username ??
    ''
  const displayName = (claims?.name as string) ?? account.name ?? email
  const roles = Array.isArray(claims?.roles) ? (claims!.roles as string[]) : []
  return { email, displayName, roles }
}

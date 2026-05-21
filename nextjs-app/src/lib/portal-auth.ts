'use client'
// MSAL Browser 整合 — 取代原本 sessionStorage 的 mock。
// 用 loginRedirect 而非 loginPopup，避免 Guest user 在 popup 中遇到 consent 卡住的情況。
import { useMsal, useIsAuthenticated } from '@azure/msal-react'
import { InteractionStatus } from '@azure/msal-browser'
import { loginRequest, readClaims, ADMIN_ROLE } from './msal-config'

export interface PortalUser {
  email: string
  displayName: string
  roles: string[]
}

export function usePortalAuth() {
  const { instance, accounts, inProgress } = useMsal()
  const isAuthenticated = useIsAuthenticated()

  const account = accounts[0]
  const user: PortalUser | null = account
    ? (() => {
        const c = readClaims(account)
        return { email: c.email, displayName: c.displayName, roles: c.roles }
      })()
    : null

  const loading =
    inProgress === InteractionStatus.Startup ||
    inProgress === InteractionStatus.HandleRedirect

  const login = async () => {
    try {
      // 登入完成後回到當前 URL（不論 /admin 或 /portal）
      await instance.loginRedirect({
        ...loginRequest,
        redirectStartPage: typeof window !== 'undefined' ? window.location.href : undefined,
      })
    } catch (e) {
      console.error('[portal-auth] login failed', e)
    }
  }

  const logout = async () => {
    await instance.logoutRedirect({
      postLogoutRedirectUri:
        typeof window !== 'undefined' ? window.location.origin : undefined,
    })
  }

  return { user, loading, login, logout, isAuthenticated }
}

export function isAdmin(user: PortalUser | null): boolean {
  return !!user && user.roles.includes(ADMIN_ROLE)
}

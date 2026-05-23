'use client'

import { InteractionRequiredAuthError, InteractionStatus } from '@azure/msal-browser'
import { useIsAuthenticated, useMsal } from '@azure/msal-react'
import { loginRequest, readClaims } from './msal-config'

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
        const claims = readClaims(account)
        return { email: claims.email, displayName: claims.displayName, roles: claims.roles }
      })()
    : null

  const loading =
    inProgress === InteractionStatus.Startup ||
    inProgress === InteractionStatus.HandleRedirect

  const login = async () => {
    await instance.loginRedirect({
      ...loginRequest,
      redirectStartPage: typeof window !== 'undefined' ? window.location.href : undefined,
    })
  }

  const logout = async () => {
    await instance.logoutRedirect({
      postLogoutRedirectUri:
        typeof window !== 'undefined' ? window.location.origin : undefined,
    })
  }

  const getIdToken = async () => {
    if (!account) {
      await login()
      throw new Error('login required')
    }

    try {
      const result = await instance.acquireTokenSilent({
        ...loginRequest,
        account,
      })
      return result.idToken
    } catch (e) {
      if (e instanceof InteractionRequiredAuthError) {
        await login()
      }
      throw e
    }
  }

  return { user, loading, login, logout, getIdToken, isAuthenticated }
}

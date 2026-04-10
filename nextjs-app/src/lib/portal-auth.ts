'use client'
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  O365 Auth Placeholder — 待替換為 Microsoft MSAL                        ║
// ║                                                                          ║
// ║  Fork 後替換步驟：                                                       ║
// ║  1. npm install @azure/msal-react @azure/msal-browser                   ║
// ║  2. 在 layout 包裝 MsalProvider                                         ║
// ║  3. 將此檔案的 usePortalAuth() 換成：                                   ║
// ║       const { accounts } = useMsal()                                     ║
// ║       const user = accounts[0]                                           ║
// ║         ? { email: accounts[0].username,                                 ║
// ║             displayName: accounts[0].name ?? '' }                        ║
// ║         : null                                                            ║
// ║  4. login() → instance.loginPopup(loginRequest)                          ║
// ║  5. logout() → instance.logoutPopup()                                    ║
// ╚══════════════════════════════════════════════════════════════════════════╝
import { useState, useEffect } from 'react'

const EMAIL_KEY = 'portal_email'
const NAME_KEY  = 'portal_name'

export interface PortalUser {
  email: string
  displayName: string
}

export function usePortalAuth() {
  const [user, setUser]       = useState<PortalUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const email = sessionStorage.getItem(EMAIL_KEY)
    const displayName = sessionStorage.getItem(NAME_KEY) ?? ''
    if (email) setUser({ email, displayName })
    setLoading(false)
  }, [])

  const login = (email: string, displayName: string) => {
    sessionStorage.setItem(EMAIL_KEY, email)
    sessionStorage.setItem(NAME_KEY, displayName)
    setUser({ email, displayName })
  }

  const logout = () => {
    sessionStorage.removeItem(EMAIL_KEY)
    sessionStorage.removeItem(NAME_KEY)
    setUser(null)
  }

  return { user, loading, login, logout }
}

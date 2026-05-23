'use client'
// MsalProvider 與 AntdRegistry 必須在 client side。
// App Router 的 layout.tsx 是 RSC，所以這裡單獨拆出 client component 包起來。
import { useEffect, useState } from 'react'
import '@ant-design/v5-patch-for-react-19'
import { AntdRegistry } from '@ant-design/nextjs-registry'
import { MsalProvider } from '@azure/msal-react'
import { PublicClientApplication, EventType } from '@azure/msal-browser'
import { msalConfig } from '@/lib/msal-config'

export default function Providers({ children }: { children: React.ReactNode }) {
  const [msalInstance, setMsalInstance] = useState<PublicClientApplication | null>(null)

  useEffect(() => {
    if (!msalConfig.auth.clientId) {
      // 還沒設 NEXT_PUBLIC_AZURE_CLIENT_ID 時不要初始化，避免噴錯。
      return
    }
    const instance = new PublicClientApplication(msalConfig)

    // 註冊 active account 設定 callback；之後 MsalProvider 會處理 redirect。
    instance.addEventCallback((event) => {
      if (
        event.eventType === EventType.LOGIN_SUCCESS &&
        event.payload &&
        'account' in event.payload &&
        event.payload.account
      ) {
        instance.setActiveAccount(event.payload.account)
      }
    })

    instance
      .initialize()
      .then(() => instance.handleRedirectPromise())
      .then((response) => {
        // 若是從 redirect 回來，response 包含已處理的 token；確保 active account 設好
        if (response?.account) {
          instance.setActiveAccount(response.account)
        } else {
          const accounts = instance.getAllAccounts()
          if (accounts.length > 0) instance.setActiveAccount(accounts[0])
        }
        setMsalInstance(instance)
      })
      .catch((err) => {
        console.error('[msal] init failed', err)
        setMsalInstance(instance) // 仍舊 render，讓登入按鈕能再試
      })
  }, [])

  // 沒 MSAL 設定時，照常 render（公開頁不需 MSAL）
  if (!msalConfig.auth.clientId || !msalInstance) {
    return <AntdRegistry>{children}</AntdRegistry>
  }

  return (
    <MsalProvider instance={msalInstance}>
      <AntdRegistry>{children}</AntdRegistry>
    </MsalProvider>
  )
}

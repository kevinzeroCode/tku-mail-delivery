import type { Metadata } from 'next'
import '@ant-design/v5-patch-for-react-19'
import { AntdRegistry } from '@ant-design/nextjs-registry'

export const metadata: Metadata = {
  title: '郵件收發系統',
  description: '淡江大學郵件收發流程管理',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body style={{ margin: 0, background: '#f5f5f5' }}>
        <AntdRegistry>{children}</AntdRegistry>
      </body>
    </html>
  )
}

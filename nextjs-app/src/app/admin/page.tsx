'use client'
import { useEffect, useState } from 'react'
import {
  Layout, Card, Button, Typography, Space, Spin, Alert,
  Modal, Form, InputNumber, Input, Divider, message, Tooltip,
} from 'antd'
import {
  PlusOutlined, ReloadOutlined, SettingOutlined, MailOutlined, LockOutlined,
} from '@ant-design/icons'
import MailTable from '@/components/MailTable'
import AddMailModal from '@/components/AddMailModal'
import type { MailItem } from '@/lib/types'

const { Header, Content } = Layout
const { Title } = Typography

const SESSION_KEY = 'admin_authed'

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)

  const [items, setItems] = useState<MailItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [settingsForm] = Form.useForm()

  // 簡易 session 驗證（重整頁面後仍保留）
  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) === 'true') setAuthed(true)
    setCheckingAuth(false)
  }, [])

  const handleLogin = async () => {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: passwordInput }),
    })
    if (res.ok) {
      sessionStorage.setItem(SESSION_KEY, 'true')
      setAuthed(true)
    } else {
      setPasswordError(true)
    }
  }

  const fetchItems = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/items')
      if (!res.ok) throw new Error('API 回應錯誤')
      const data = await res.json()
      if (!Array.isArray(data)) throw new Error('資料格式錯誤')
      setItems(data)
    } catch {
      setError('載入失敗，請重新整理')
    } finally {
      setLoading(false)
    }
  }

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings')
      if (!res.ok) return
      const data = await res.json()
      setSettings(data)
      const days = parseInt(data.deadlineDays ?? '7', 10)
      settingsForm.setFieldsValue({ deadlineDays: Number.isNaN(days) ? 7 : days })
    } catch {
      // 設定載入失敗不影響主功能，靜默處理
    }
  }

  useEffect(() => {
    if (authed) {
      fetchItems()
      fetchSettings()
    }
  }, [authed])

  const saveSettings = async () => {
    const values = settingsForm.getFieldsValue()
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deadlineDays: String(values.deadlineDays) }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      message.error(d.error ?? '設定儲存失敗')
      return
    }
    message.success('設定已儲存')
    setSettingsOpen(false)
    fetchSettings()
  }

  const counts = {
    total: items.length,
    pending: items.filter(i => i.status === '待領取').length,
    overdue: items.filter(i => {
      if (i.status !== '待領取') return false
      const deadline = new Date(i.receivedDate)
      deadline.setDate(deadline.getDate() + i.deadlineDays)
      return new Date() > deadline
    }).length,
  }

  // ── 載入中 ──────────────────────────────────────────
  if (checkingAuth) return null

  // ── 登入畫面 ────────────────────────────────────────
  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
        <Card style={{ width: 360, textAlign: 'center' }}>
          <LockOutlined style={{ fontSize: 48, color: '#1677ff', marginBottom: 16 }} />
          <Title level={4} style={{ marginBottom: 24 }}>管理員後台</Title>
          <Input.Password
            placeholder="請輸入管理員密碼"
            size="large"
            value={passwordInput}
            onChange={e => { setPasswordInput(e.target.value); setPasswordError(false) }}
            onPressEnter={handleLogin}
            status={passwordError ? 'error' : undefined}
          />
          {passwordError && <div style={{ color: '#ff4d4f', marginTop: 8 }}>密碼錯誤</div>}
          <Button type="primary" size="large" block style={{ marginTop: 16 }} onClick={handleLogin}>
            進入
          </Button>
        </Card>
      </div>
    )
  }

  // ── 主介面 ──────────────────────────────────────────
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#1677ff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Space>
          <MailOutlined style={{ color: '#fff', fontSize: 24 }} />
          <Title level={4} style={{ color: '#fff', margin: 0 }}>郵件收發管理後台</Title>
        </Space>
        <Space>
          <Tooltip title="系統設定">
            <Button icon={<SettingOutlined />} onClick={() => setSettingsOpen(true)} />
          </Tooltip>
          <Button icon={<ReloadOutlined />} onClick={fetchItems} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}
            style={{ background: '#fff', color: '#1677ff' }}>
            新增郵件
          </Button>
        </Space>
      </Header>

      <Content style={{ padding: 24 }}>
        <Space style={{ marginBottom: 16 }} wrap>
          <Card size="small" style={{ minWidth: 120, textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 'bold' }}>{counts.total}</div>
            <div style={{ color: '#888' }}>總計</div>
          </Card>
          <Card size="small" style={{ minWidth: 120, textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 'bold', color: '#fa8c16' }}>{counts.pending}</div>
            <div style={{ color: '#888' }}>待領取</div>
          </Card>
          <Card size="small" style={{ minWidth: 120, textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 'bold', color: '#ff4d4f' }}>{counts.overdue}</div>
            <div style={{ color: '#888' }}>已逾期</div>
          </Card>
        </Space>

        {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}

        <Card>
          {loading
            ? <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>
            : <MailTable items={items} onRefresh={fetchItems} />
          }
        </Card>
      </Content>

      <AddMailModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => { setAddOpen(false); fetchItems() }}
        defaultDeadlineDays={parseInt(settings.deadlineDays ?? '7')}
      />

      <Modal title={<><SettingOutlined /> 系統設定</>}
        open={settingsOpen} onOk={saveSettings}
        onCancel={() => setSettingsOpen(false)} okText="儲存" cancelText="取消"
        forceRender>
        <Divider />
        <Form form={settingsForm} layout="vertical">
          <Form.Item name="deadlineDays" label="預設領取期限（天）"
            help="到件幾天後未領取，在清單中標示逾期">
            <InputNumber min={1} max={90} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
        <Divider />
        <Typography.Text type="secondary">
          Teams Webhook URL 請在 <code>.env.local</code> 中設定 <code>TEAMS_WEBHOOK_URL</code>
        </Typography.Text>
      </Modal>
    </Layout>
  )
}

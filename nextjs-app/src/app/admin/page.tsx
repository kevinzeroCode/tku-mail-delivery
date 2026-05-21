'use client'
import { useEffect, useState } from 'react'
import {
  Layout, Card, Button, Typography, Space, Spin, Alert,
  Modal, Form, InputNumber, Input, Divider, message, Tooltip, Tabs, Badge, Table, Popconfirm,
} from 'antd'
import {
  PlusOutlined, ReloadOutlined, SettingOutlined, MailOutlined, LockOutlined, LogoutOutlined,
  FileDoneOutlined, UserOutlined, TeamOutlined, DeleteOutlined,
} from '@ant-design/icons'
import MailTable from '@/components/MailTable'
import AddMailModal from '@/components/AddMailModal'
import RequestsPanel from '@/components/RequestsPanel'
import { usePortalAuth, isAdmin } from '@/lib/portal-auth'
import type { MailItem, MailRequest } from '@/lib/types'

const { Header, Content } = Layout
const { Title, Text } = Typography

interface AdminUserRow {
  id: number
  email: string
  source: string
  createdAt: string
  createdByEmail: string | null
}

export default function AdminPage() {
  const { user, loading: authLoading, login, logout } = usePortalAuth()
  const [dbAdmin, setDbAdmin] = useState<boolean | null>(null)
  const authed = isAdmin(user) || dbAdmin === true
  const authChecking = authLoading || (!!user && dbAdmin === null)

  const [items,    setItems]    = useState<MailItem[]>([])
  const [requests, setRequests] = useState<MailRequest[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [settingsForm] = Form.useForm()

  // Admin user management
  const [adminUsers, setAdminUsers] = useState<AdminUserRow[]>([])
  const [adminLoading, setAdminLoading] = useState(false)
  const [addAdminOpen, setAddAdminOpen] = useState(false)
  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [addingAdmin, setAddingAdmin] = useState(false)

  // Check DB-based admin access after MSAL login
  useEffect(() => {
    if (!user) { setDbAdmin(null); return }
    fetch(`/api/admin/check?email=${encodeURIComponent(user.email)}`)
      .then(r => r.json())
      .then(d => setDbAdmin(d.isAdmin === true))
      .catch(() => setDbAdmin(false))
  }, [user?.email])

  const fetchItems = async () => {
    setLoading(true)
    setError(null)
    try {
      const [itemsRes, reqsRes] = await Promise.all([
        fetch('/api/items'),
        fetch('/api/admin/requests'),
      ])
      if (!itemsRes.ok) throw new Error('API 回應錯誤')
      const [itemsData, reqsData] = await Promise.all([itemsRes.json(), reqsRes.json()])
      if (!Array.isArray(itemsData)) throw new Error('資料格式錯誤')
      setItems(itemsData)
      setRequests(Array.isArray(reqsData) ? reqsData : [])
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
      setSettings(await res.json())
    } catch { /* 靜默 */ }
  }

  const fetchAdminUsers = async () => {
    setAdminLoading(true)
    try {
      const res = await fetch('/api/admin/users')
      if (res.ok) setAdminUsers(await res.json())
    } finally {
      setAdminLoading(false)
    }
  }

  useEffect(() => {
    if (authed) {
      fetchItems()
      fetchSettings()
      fetchAdminUsers()
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

  const addAdmin = async () => {
    const email = newAdminEmail.trim().toLowerCase()
    if (!email.includes('@')) { message.error('請輸入有效 email'); return }
    setAddingAdmin(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, createdByEmail: user?.email }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        message.error(d.error ?? '新增失敗')
        return
      }
      message.success(`已新增管理員：${email}`)
      setNewAdminEmail('')
      setAddAdminOpen(false)
      fetchAdminUsers()
    } finally {
      setAddingAdmin(false)
    }
  }

  const removeAdmin = async (email: string) => {
    const res = await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      message.error(d.error ?? '移除失敗')
      return
    }
    message.success(`已移除管理員：${email}`)
    fetchAdminUsers()
  }

  const counts = {
    total:   items.length,
    pending: items.filter(i => i.status === '待領取').length,
    overdue: items.filter(i => {
      if (i.status !== '待領取') return false
      const deadline = new Date(i.receivedDate)
      deadline.setDate(deadline.getDate() + i.deadlineDays)
      return new Date() > deadline
    }).length,
    pendingRequests: requests.filter(r => r.status === '待處理').length,
  }

  if (authChecking) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
        <Card style={{ width: 380, textAlign: 'center' }}>
          <LockOutlined style={{ fontSize: 48, color: '#1677ff', marginBottom: 16 }} />
          <Title level={4} style={{ marginBottom: 8 }}>管理員後台</Title>
          <Text type="secondary">僅限授權的淡江大學帳號使用</Text>
          <Button type="primary" size="large" block icon={<UserOutlined />}
            style={{ marginTop: 24 }} onClick={login}>
            以 Microsoft 帳號登入
          </Button>
        </Card>
      </div>
    )
  }

  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
        <Card style={{ width: 420, textAlign: 'center' }}>
          <LockOutlined style={{ fontSize: 48, color: '#ff4d4f', marginBottom: 16 }} />
          <Title level={4}>無存取權限</Title>
          <Alert type="warning" message="您的帳號未獲授權"
            description={
              <span>
                目前登入：<b>{user.displayName || user.email}</b>
                <br />
                請聯絡現有管理員將您的帳號加入系統。
              </span>
            }
            style={{ marginTop: 16, marginBottom: 16, textAlign: 'left' }} showIcon />
          <Space>
            <Button onClick={logout}>登出並改用其他帳號</Button>
            <Button type="link" href="/">回到首頁</Button>
          </Space>
        </Card>
      </div>
    )
  }

  const adminColumns = [
    { title: 'Email', dataIndex: 'email', key: 'email' },
    {
      title: '來源', dataIndex: 'source', key: 'source',
      render: (s: string) => s === 'bootstrap' ? '系統預設' : s === 'manual' ? '手動新增' : s,
    },
    {
      title: '新增時間', dataIndex: 'createdAt', key: 'createdAt',
      render: (d: string) => new Date(d).toLocaleDateString('zh-TW'),
    },
    { title: '由誰新增', dataIndex: 'createdByEmail', key: 'createdByEmail', render: (v: string | null) => v ?? '—' },
    {
      title: '操作', key: 'action',
      render: (_: unknown, row: AdminUserRow) =>
        row.source === 'bootstrap' ? (
          <Text type="secondary" style={{ fontSize: 12 }}>不可移除</Text>
        ) : (
          <Popconfirm title={`確定移除 ${row.email}？`} onConfirm={() => removeAdmin(row.email)} okText="移除" cancelText="取消">
            <Button danger icon={<DeleteOutlined />} size="small">移除</Button>
          </Popconfirm>
        ),
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#1677ff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Space>
          <MailOutlined style={{ color: '#fff', fontSize: 24 }} />
          <Title level={4} style={{ color: '#fff', margin: 0 }}>郵件收發管理後台</Title>
        </Space>
        <Space>
          <Text style={{ color: 'rgba(255,255,255,.85)', fontSize: 13 }}>
            <UserOutlined style={{ marginRight: 4 }} />
            {user.displayName || user.email}
          </Text>
          <Button type="text" style={{ color: '#fff' }} href="/">公開查詢頁</Button>
          <Tooltip title="系統設定">
            <Button icon={<SettingOutlined />} onClick={() => setSettingsOpen(true)} />
          </Tooltip>
          <Button icon={<ReloadOutlined />} onClick={fetchItems} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}
            style={{ background: '#fff', color: '#1677ff' }}>
            新增郵件
          </Button>
          <Tooltip title="登出">
            <Button icon={<LogoutOutlined />} onClick={logout} style={{ color: '#fff' }} type="text" />
          </Tooltip>
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

        <Card style={{ marginTop: 8 }}>
          <Tabs
            items={[
              {
                key: 'mails',
                label: <><MailOutlined />郵件清單</>,
                children: loading
                  ? <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>
                  : <MailTable items={items} onRefresh={fetchItems} />,
              },
              {
                key: 'requests',
                label: (
                  <Badge count={counts.pendingRequests} size="small" offset={[6, 0]}>
                    <FileDoneOutlined />申請處理
                  </Badge>
                ),
                children: loading
                  ? <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>
                  : <RequestsPanel requests={requests} onRefresh={fetchItems} />,
              },
              {
                key: 'admins',
                label: <><TeamOutlined />管理員設定</>,
                children: (
                  <div>
                    <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text type="secondary">共 {adminUsers.length} 位管理員</Text>
                      <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddAdminOpen(true)}>
                        新增管理員
                      </Button>
                    </div>
                    <Table
                      dataSource={adminUsers}
                      columns={adminColumns}
                      rowKey="id"
                      loading={adminLoading}
                      pagination={false}
                      size="small"
                    />
                  </div>
                ),
              },
            ]}
          />
        </Card>
      </Content>

      <AddMailModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => { setAddOpen(false); fetchItems() }}
        defaultDeadlineDays={parseInt(settings.deadlineDays ?? '7')}
      />

      <Modal title="新增管理員" open={addAdminOpen}
        onOk={addAdmin} onCancel={() => { setAddAdminOpen(false); setNewAdminEmail('') }}
        okText="新增" cancelText="取消" confirmLoading={addingAdmin}
        destroyOnHidden>
        <Divider />
        <Form layout="vertical">
          <Form.Item label="Email" required help="輸入要授予管理員權限的 Email（須為 @o365.tku.edu.tw 帳號）">
            <Input
              placeholder="example@o365.tku.edu.tw"
              value={newAdminEmail}
              onChange={e => setNewAdminEmail(e.target.value)}
              onPressEnter={addAdmin}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={<><SettingOutlined /> 系統設定</>}
        open={settingsOpen} onOk={saveSettings}
        onCancel={() => setSettingsOpen(false)} okText="儲存" cancelText="取消"
        afterOpenChange={open => {
          if (open) {
            const days = parseInt(settings.deadlineDays ?? '7', 10)
            settingsForm.setFieldsValue({ deadlineDays: Number.isNaN(days) ? 7 : days })
          }
        }}>
        <Divider />
        <Form form={settingsForm} layout="vertical">
          <Form.Item name="deadlineDays" label="預設領取期限（天）"
            help="到件幾天後未領取，在清單中標示逾期">
            <InputNumber min={1} max={90} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
        <Divider />
        <Typography.Text type="secondary">
          Teams Webhook URL 請在環境變數設 <code>TEAMS_WEBHOOK_URL</code>
        </Typography.Text>
      </Modal>
    </Layout>
  )
}

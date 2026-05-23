'use client'
import { useEffect, useState } from 'react'
import {
  Layout, Card, Button, Typography, Space, Spin, Alert,
  Modal, Form, InputNumber, Input, Divider, message, Tooltip, Tabs, Badge, Table, Popconfirm,
} from 'antd'
import {
  PlusOutlined, ReloadOutlined, SettingOutlined, MailOutlined, LockOutlined, LogoutOutlined,
  FileDoneOutlined, UserOutlined, DeleteOutlined, ScanOutlined,
} from '@ant-design/icons'
import MailTable from '@/components/MailTable'
import AddMailModal from '@/components/AddMailModal'
import RequestsPanel from '@/components/RequestsPanel'
import ListScanCheckPanel from '@/components/ListScanCheckPanel'
import {
  adminAuthHeaders,
  localAdminBypassEnabled,
  localAdminEmail,
  setAdminTokenProvider,
} from '@/lib/admin-client-auth'
import { usePortalAuth } from '@/lib/portal-auth'
import type { MailItem, MailRequest } from '@/lib/types'

interface AdminUser {
  id: number
  email: string
  source: string
  createdAt: string
  createdByEmail: string | null
}

const { Header, Content } = Layout
const { Title, Text } = Typography

export default function AdminPage() {
  const { user, loading: authLoading, login, logout, getIdToken } = usePortalAuth()
  const effectiveUser = localAdminBypassEnabled
    ? { email: localAdminEmail, displayName: 'Local Admin', roles: [] }
    : user
  const [adminAllowed, setAdminAllowed] = useState(false)
  const [permissionChecked, setPermissionChecked] = useState(false)

  const [items,    setItems]    = useState<MailItem[]>([])
  const [requests, setRequests] = useState<MailRequest[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [settingsForm] = Form.useForm()
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([])
  const [adminUsersLoading, setAdminUsersLoading] = useState(false)
  const [newAdminEmail, setNewAdminEmail] = useState('')

  useEffect(() => {
    setAdminTokenProvider(localAdminBypassEnabled ? null : getIdToken)
    return () => setAdminTokenProvider(null)
  }, [getIdToken])

  const fetchItems = async () => {
    setLoading(true)
    setError(null)
    try {
      const headers = await adminAuthHeaders()
      const [itemsRes, reqsRes] = await Promise.all([
        fetch('/api/items', { headers }),
        fetch('/api/admin/requests', { headers }),
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
      const res = await fetch('/api/settings', { headers: await adminAuthHeaders() })
      if (!res.ok) return
      const data = await res.json()
      setSettings(data)
    } catch {
      // 設定載入失敗不影響主功能，靜默處理
    }
  }

  const fetchAdminUsers = async () => {
      setAdminUsersLoading(true)
    try {
      const res = await fetch('/api/admin/users', { headers: await adminAuthHeaders() })
      if (!res.ok) throw new Error('load failed')
      const data = await res.json()
      setAdminUsers(Array.isArray(data) ? data : [])
    } catch {
      message.error('管理員名單讀取失敗')
    } finally {
      setAdminUsersLoading(false)
    }
  }

  useEffect(() => {
    if (!effectiveUser) {
      setAdminAllowed(false)
      setPermissionChecked(false)
      return
    }

    let cancelled = false
    async function checkPermissionAndLoad() {
      setPermissionChecked(false)
      try {
        const res = await fetch('/api/admin/users', { headers: await adminAuthHeaders() })
        if (cancelled) return
        if (res.ok) {
          const data = await res.json()
          setAdminUsers(Array.isArray(data) ? data : [])
          setAdminAllowed(true)
          setPermissionChecked(true)
          fetchItems()
          fetchSettings()
        } else {
          setAdminAllowed(false)
          setPermissionChecked(true)
        }
      } catch {
        if (!cancelled) {
          setAdminAllowed(false)
          setPermissionChecked(true)
        }
      }
    }
    checkPermissionAndLoad()
    return () => { cancelled = true }
  }, [effectiveUser?.email])

  const addAdminUser = async () => {
    const email = newAdminEmail.trim()
    if (!email) return

    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...await adminAuthHeaders() },
      body: JSON.stringify({ email }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      message.error(data.error ?? '新增管理員失敗')
      return
    }

    message.success('已新增管理員')
    setNewAdminEmail('')
    fetchAdminUsers()
  }

  const removeAdminUser = async (email: string) => {
    const res = await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...await adminAuthHeaders() },
      body: JSON.stringify({ email }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      message.error(data.error ?? '移除管理員失敗')
      return
    }

    message.success('已移除管理員')
    fetchAdminUsers()
  }

  const adminUsersPanel = (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Space.Compact style={{ width: 420, maxWidth: '100%' }}>
        <Input
          placeholder="admin@example.com"
          value={newAdminEmail}
          onChange={e => setNewAdminEmail(e.target.value)}
          onPressEnter={addAdminUser}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={addAdminUser}>
          新增
        </Button>
      </Space.Compact>

      <Table<AdminUser>
        dataSource={adminUsers}
        rowKey="id"
        size="small"
        loading={adminUsersLoading}
        pagination={false}
        columns={[
          { title: 'Email', dataIndex: 'email' },
          {
            title: '建立時間',
            dataIndex: 'createdAt',
            width: 180,
            render: value => new Date(value).toLocaleString('zh-TW'),
          },
          {
            title: '建立者',
            dataIndex: 'createdByEmail',
            width: 180,
            render: value => value ?? '-',
          },
          {
            title: '來源',
            dataIndex: 'source',
            width: 120,
            render: value => value === 'bootstrap' ? 'Bootstrap' : '手動',
          },
          {
            title: '操作',
            width: 100,
            render: (_, record) => (
              <Popconfirm
                title="移除此管理員？"
                okText="移除"
                cancelText="取消"
                onConfirm={() => removeAdminUser(record.email)}
                disabled={record.source === 'bootstrap'}
              >
                <Button danger size="small" icon={<DeleteOutlined />} disabled={record.source === 'bootstrap'} />
              </Popconfirm>
            ),
          },
        ]}
      />
    </Space>
  )

  const saveSettings = async () => {
    const values = settingsForm.getFieldsValue()
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...await adminAuthHeaders() },
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
    total:          items.length,
    pending:        items.filter(i => i.status === '待領取').length,
    overdue:        items.filter(i => {
      if (i.status !== '待領取') return false
      const deadline = new Date(i.receivedDate)
      deadline.setDate(deadline.getDate() + i.deadlineDays)
      return new Date() > deadline
    }).length,
    pendingRequests: requests.filter(r => r.status === '待處理').length,
  }

  // ── 載入中 ──────────────────────────────────────────
  if ((!localAdminBypassEnabled && authLoading) || (effectiveUser && !permissionChecked)) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!effectiveUser) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
        <Card style={{ width: 380, textAlign: 'center' }}>
          <LockOutlined style={{ fontSize: 48, color: '#1677ff', marginBottom: 16 }} />
          <Title level={4} style={{ marginBottom: 8 }}>管理員後台</Title>
          <Text type="secondary">請使用 Microsoft 帳號登入</Text>
          <Button
            type="primary"
            size="large"
            block
            icon={<UserOutlined />}
            style={{ marginTop: 24 }}
            onClick={login}
          >
            Microsoft 登入
          </Button>
        </Card>
      </div>
    )
  }

  if (!adminAllowed) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
        <Card style={{ width: 420, textAlign: 'center' }}>
          <LockOutlined style={{ fontSize: 48, color: '#ff4d4f', marginBottom: 16 }} />
          <Title level={4}>沒有後台管理權限</Title>
          <Alert
            type="warning"
            message="此帳號未列在管理員名單"
            description={`目前登入：${effectiveUser.displayName || effectiveUser.email}`}
            style={{ marginTop: 16, marginBottom: 16, textAlign: 'left' }}
            showIcon
          />
          <Space>
            <Button onClick={logout}>登出並切換帳號</Button>
            <Button type="link" href="/">回公開查詢頁</Button>
          </Space>
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
          <Text style={{ color: 'rgba(255,255,255,.85)', fontSize: 13 }}>
            <UserOutlined style={{ marginRight: 4 }} />
            {effectiveUser.displayName || effectiveUser.email}
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
            destroyOnHidden={false}
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
                key: 'scan',
                label: <><ScanOutlined />清單掃描查核</>,
                children: (
                  <Spin spinning={loading} tip="資料載入中…">
                    <ListScanCheckPanel items={items} onRefresh={fetchItems} />
                  </Spin>
                ),
              },
              {
                key: 'admin-users',
                label: <><UserOutlined />管理員名單</>,
                children: adminUsersPanel,
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
          Teams Webhook URL 請在 <code>.env.local</code> 中設定 <code>TEAMS_WEBHOOK_URL</code>
        </Typography.Text>
      </Modal>
    </Layout>
  )
}

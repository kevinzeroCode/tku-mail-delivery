'use client'
import { useEffect, useState } from 'react'
import {
  Layout, Card, Tabs, Form, Input, Select, Button, Space,
  Typography, Spin, Alert, Tag, Table, Tooltip, Badge,
  message, Descriptions,
} from 'antd'
import {
  MailOutlined, UserOutlined, LogoutOutlined,
  BellOutlined, CheckOutlined, RollbackOutlined,
  EditOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { usePortalAuth } from '@/lib/portal-auth'
import MailRequestModal from '@/components/MailRequestModal'
import StatusBadge from '@/components/StatusBadge'
import type { UserProfile, MailRequestType } from '@/lib/types'
import type { ColumnsType } from 'antd/es/table/interface'

const { Header, Content } = Layout
const { Title, Text } = Typography

const SCHOOL_STATUSES = ['在學中', '已畢業', '休學中', '在職中', '已離退'].map(v => ({ value: v, label: v }))
const PICKUP_METHODS  = ['自行領取', '代收通知', '付費寄回', '說明告知', '其他'].map(v => ({ value: v, label: v }))

type RequestType = MailRequestType

interface PortalMailItem {
  id: number
  trackingCode: string
  mailType: string
  receivedDate: string
  deadlineDays: number
  status: string
  pickupDate: string | null
  returnDate: string | null
  pickupMethod: string | null
  notes: string | null
  requests: { id: number; type: string; status: string; createdAt: string }[]
}

// ── 登入卡片 ──────────────────────────────────────────────────────────────────
function LoginCard({ onLogin }: { onLogin: (email: string, name: string) => void }) {
  const [email, setEmail] = useState('')
  const [name,  setName]  = useState('')

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#f0f2f5',
    }}>
      <Card style={{ width: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <MailOutlined style={{ fontSize: 48, color: '#1677ff' }} />
          <Title level={4} style={{ marginTop: 12, marginBottom: 0 }}>郵件自助服務</Title>
          <Text type="secondary">淡江大學收發室</Text>
        </div>

        {/* ── O365 替換提示 ─── 下方為暫時模擬登入，fork 後替換為 MSAL ── */}
        <Alert
          type="info"
          message="目前使用測試登入"
          description="正式版將以 Microsoft O365 帳號（@tku.edu.tw）自動登入，無需輸入 Email。"
          style={{ marginBottom: 16 }}
          showIcon
        />

        <Space direction="vertical" style={{ width: '100%' }}>
          <Input
            prefix={<MailOutlined />}
            placeholder="請輸入您的 O365 Email（如 xxx@tku.edu.tw）"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <Input
            prefix={<UserOutlined />}
            placeholder="顯示名稱（選填）"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <Button
            type="primary"
            block
            size="large"
            disabled={!email.trim()}
            onClick={() => onLogin(email.trim(), name.trim())}
          >
            登入
          </Button>
        </Space>
      </Card>
    </div>
  )
}

// ── 基本資料 Tab ─────────────────────────────────────────────────────────────
function ProfileTab({ email }: { email: string }) {
  const [form]    = Form.useForm()
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    fetch(`/api/portal/profile?email=${encodeURIComponent(email)}`)
      .then(r => r.json())
      .then((data: UserProfile) => {
        form.setFieldsValue({
          name:         data.name         ?? '',
          studentId:    data.studentId    ?? '',
          defaultPickup:data.defaultPickup ?? undefined,
          notifyEmail:  data.notifyEmail  ?? '',
          schoolStatus: data.schoolStatus ?? undefined,
          notes:        data.notes        ?? '',
        })
      })
      .finally(() => setLoading(false))
  }, [email, form])

  const handleSave = async () => {
    setSaving(true)
    try {
      const values = form.getFieldsValue()
      const res = await fetch('/api/portal/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, ...values }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      message.success('基本資料已儲存')
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : '儲存失敗')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>

  return (
    <Form form={form} layout="vertical" style={{ maxWidth: 520 }}>
      <Space style={{ width: '100%' }} align="start">
        <Form.Item name="name" label="姓名" style={{ flex: 1 }}>
          <Input placeholder="請輸入姓名" />
        </Form.Item>
        <Form.Item name="studentId" label="學號／員工編號" style={{ flex: 1 }}>
          <Input placeholder="請輸入學號或員工編號" />
        </Form.Item>
      </Space>

      <Form.Item name="schoolStatus" label="目前在校狀態">
        <Select options={SCHOOL_STATUSES} placeholder="請選擇" allowClear />
      </Form.Item>

      <Form.Item name="defaultPickup" label="預設領取方式">
        <Select options={PICKUP_METHODS} placeholder="請選擇慣用的領取方式" allowClear />
      </Form.Item>

      <Form.Item
        name="notifyEmail"
        label="通知 Email"
        help="留空則使用登入的 O365 帳號 Email 發送通知"
      >
        <Input placeholder={email} />
      </Form.Item>

      <Form.Item
        name="notes"
        label="備註（給收發室的訊息）"
        help="例如：長期請假、畢業後轉寄地址等補充說明"
      >
        <Input.TextArea rows={3} placeholder="供處理人員參考的補充說明" />
      </Form.Item>

      <Form.Item>
        <Button type="primary" loading={saving} onClick={handleSave}>
          儲存基本資料
        </Button>
      </Form.Item>
    </Form>
  )
}

// ── 我的郵件 Tab ─────────────────────────────────────────────────────────────
function MailsTab({ email }: { email: string }) {
  const [items,       setItems]       = useState<PortalMailItem[]>([])
  const [loading,     setLoading]     = useState(true)
  const [activeItem,  setActiveItem]  = useState<PortalMailItem | null>(null)
  const [reqType,     setReqType]     = useState<RequestType | null>(null)

  const fetchMails = () => {
    setLoading(true)
    fetch(`/api/portal/mails?email=${encodeURIComponent(email)}`)
      .then(r => r.json())
      .then(data => setItems(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
  }

  useEffect(fetchMails, [email])

  const openRequest = (item: PortalMailItem, type: RequestType) => {
    // 同一類型有待處理申請則提示
    const pending = item.requests.find(r => r.type === type && r.status === '待處理')
    if (pending) {
      message.warning('此申請已送出，請等待收發室處理')
      return
    }
    setActiveItem(item)
    setReqType(type)
  }

  const columns: ColumnsType<PortalMailItem> = [
    {
      title: '追蹤碼',
      dataIndex: 'trackingCode',
      width: 100,
      render: v => <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{v}</span>,
    },
    {
      title: '類型',
      dataIndex: 'mailType',
      width: 60,
    },
    {
      title: '到件日期',
      width: 90,
      render: (_, r) => dayjs(r.receivedDate).format('MM/DD'),
    },
    {
      title: '期限',
      width: 90,
      render: (_, r) => {
        const deadline = dayjs(r.receivedDate).add(r.deadlineDays, 'day')
        const overdue  = r.status === '待領取' && dayjs().isAfter(deadline)
        return (
          <span style={{ color: overdue ? '#ff4d4f' : undefined }}>
            {deadline.format('MM/DD')}
            {overdue && <Tag color="red" style={{ marginLeft: 4, fontSize: 10 }}>逾期</Tag>}
          </span>
        )
      },
    },
    {
      title: '狀態',
      width: 80,
      render: (_, r) => <StatusBadge status={r.status as never} />,
    },
    {
      title: '申請狀態',
      width: 100,
      render: (_, r) => {
        const pending = r.requests.filter(req => req.status === '待處理')
        if (!pending.length) return <span style={{ color: '#bbb' }}>—</span>
        return <Badge count={pending.length} size="small"><Tag color="gold">申請中 {pending.length}</Tag></Badge>
      },
    },
    {
      title: '操作',
      width: 230,
      render: (_, r) => {
        if (r.status !== '待領取') return (
          <Descriptions size="small" column={1}>
            {r.pickupDate && (
              <Descriptions.Item label="領取">
                {dayjs(r.pickupDate).format('MM/DD HH:mm')}
              </Descriptions.Item>
            )}
            {r.returnDate && (
              <Descriptions.Item label="退回">
                {dayjs(r.returnDate).format('MM/DD HH:mm')}
              </Descriptions.Item>
            )}
          </Descriptions>
        )
        return (
          <Space size={4} wrap>
            <Tooltip title="領取郵件（簽名）">
              <Button size="small" type="primary" icon={<CheckOutlined />}
                onClick={() => openRequest(r, 'pickup_signed')}>
                領取
              </Button>
            </Tooltip>
            <Tooltip title="申請拒收／退回">
              <Button size="small" danger icon={<RollbackOutlined />}
                onClick={() => openRequest(r, 'reject_return')}>
                拒收
              </Button>
            </Tooltip>
            <Tooltip title="申請異動領取方式">
              <Button size="small" icon={<EditOutlined />}
                onClick={() => openRequest(r, 'change_pickup')}>
                異動方式
              </Button>
            </Tooltip>
            <Tooltip title="此郵件分送有誤">
              <Button size="small" icon={<ExclamationCircleOutlined />}
                onClick={() => openRequest(r, 'wrong_recipient')}>
                分送有誤
              </Button>
            </Tooltip>
          </Space>
        )
      },
    },
  ]

  if (loading) return <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>

  if (!items.length) return (
    <Alert
      type="info"
      message="目前沒有郵件記錄"
      description="若您有未到件的郵件，請確認收發室是否已登入您的 Email 帳號，或洽詢收發室人員。"
      showIcon
    />
  )

  return (
    <>
      <Alert
        type="warning"
        message="顯示範圍：全部待領取郵件，以及三個月以內已完成郵件（最多 50 筆）"
        style={{ marginBottom: 12 }}
        showIcon
      />
      <Table
        dataSource={items}
        columns={columns}
        rowKey="id"
        size="small"
        pagination={{ pageSize: 20, showTotal: t => `共 ${t} 筆` }}
        scroll={{ x: 700 }}
      />

      <MailRequestModal
        item={activeItem}
        requestType={reqType}
        userEmail={email}
        onSaved={() => { setActiveItem(null); setReqType(null); fetchMails() }}
        onCancel={() => { setActiveItem(null); setReqType(null) }}
      />
    </>
  )
}

// ── 主頁面 ────────────────────────────────────────────────────────────────────
export default function PortalPage() {
  const { user, loading, login, logout } = usePortalAuth()

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spin size="large" />
    </div>
  )

  if (!user) return <LoginCard onLogin={login} />

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#1677ff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Space>
          <MailOutlined style={{ color: '#fff', fontSize: 24 }} />
          <Title level={4} style={{ color: '#fff', margin: 0 }}>郵件自助服務</Title>
        </Space>
        <Space>
          <Text style={{ color: 'rgba(255,255,255,.85)', fontSize: 13 }}>
            <UserOutlined style={{ marginRight: 4 }} />
            {user.displayName || user.email}
          </Text>
          <Button type="text" style={{ color: '#fff' }} href="/">公開查詢</Button>
          <Tooltip title="登出">
            <Button icon={<LogoutOutlined />} type="text" style={{ color: '#fff' }} onClick={logout} />
          </Tooltip>
        </Space>
      </Header>

      <Content style={{ padding: 24, maxWidth: 900, margin: '0 auto', width: '100%' }}>
        <Tabs
          defaultActiveKey="mails"
          items={[
            {
              key: 'mails',
              label: <><BellOutlined />我的郵件</>,
              children: <MailsTab email={user.email} />,
            },
            {
              key: 'profile',
              label: <><UserOutlined />基本資料設定</>,
              children: <ProfileTab email={user.email} />,
            },
          ]}
        />
      </Content>
    </Layout>
  )
}

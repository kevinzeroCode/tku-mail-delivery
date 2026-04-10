'use client'
import { useState } from 'react'
import {
  Table, Button, Space, Tag, Modal, Input, Image, message, Tooltip,
} from 'antd'
import { CheckOutlined, CloseOutlined, EyeOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table/interface'
import type { MailRequest, MailRequestType } from '@/lib/types'

const TYPE_LABELS: Record<MailRequestType, string> = {
  reject_return:   '申請拒收／退回',
  change_pickup:   '異動領取方式',
  wrong_recipient: '更正收件人',
  pickup_signed:   '領取（簽名）',
}

const TYPE_COLORS: Record<MailRequestType, string> = {
  reject_return:   'red',
  change_pickup:   'blue',
  wrong_recipient: 'orange',
  pickup_signed:   'green',
}

const STATUS_COLOR: Record<string, string> = {
  '待處理': 'gold',
  '已核准': 'green',
  '已拒絕': 'default',
}

interface Props {
  requests: MailRequest[]
  onRefresh: () => void
}

export default function RequestsPanel({ requests, onRefresh }: Props) {
  const [adminNote, setAdminNote] = useState('')
  const [processing, setProcessing] = useState<number | null>(null)
  const [sigPreview, setSigPreview] = useState<string | null>(null)

  const handleAction = async (id: number, action: 'approve' | 'reject') => {
    setProcessing(id)
    try {
      const res = await fetch(`/api/admin/requests/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, adminNote: adminNote || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      message.success(action === 'approve' ? '已核准' : '已拒絕')
      setAdminNote('')
      onRefresh()
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : '操作失敗')
    } finally {
      setProcessing(null)
    }
  }

  const parseData = (req: MailRequest) => {
    try { return req.requestData ? JSON.parse(req.requestData) : {} }
    catch { return {} }
  }

  const columns: ColumnsType<MailRequest> = [
    {
      title: '追蹤碼',
      width: 100,
      render: (_, r) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
          {r.mailItem?.trackingCode ?? r.mailItemId}
        </span>
      ),
    },
    {
      title: '申請類型',
      width: 130,
      render: (_, r) => (
        <Tag color={TYPE_COLORS[r.type]}>{TYPE_LABELS[r.type]}</Tag>
      ),
    },
    {
      title: '申請人',
      dataIndex: 'userEmail',
      width: 170,
      ellipsis: true,
    },
    {
      title: '申請內容',
      ellipsis: true,
      render: (_, r) => {
        const d = parseData(r)
        if (r.type === 'change_pickup') return `新方式：${d.newMethod ?? '—'}`
        if (r.type === 'wrong_recipient') return `正確收件人：${d.correctName ?? '—'}`
        if (r.type === 'pickup_signed') return (
          <Space size={4}>
            {d.pickerName && <span>領取人：{d.pickerName}</span>}
            {d.signatureData && (
              <Tooltip title="點擊查看簽名">
                <Button size="small" icon={<EyeOutlined />}
                  onClick={() => setSigPreview(d.signatureData)}>簽名</Button>
              </Tooltip>
            )}
          </Space>
        )
        return '—'
      },
    },
    {
      title: '狀態',
      width: 80,
      render: (_, r) => <Tag color={STATUS_COLOR[r.status]}>{r.status}</Tag>,
    },
    {
      title: '送出時間',
      width: 100,
      render: (_, r) => dayjs(r.createdAt).format('MM/DD HH:mm'),
    },
    {
      title: '管理員備注',
      dataIndex: 'adminNote',
      ellipsis: true,
      render: v => v ?? '—',
    },
    {
      title: '操作',
      width: 200,
      render: (_, r) => {
        if (r.status !== '待處理') return null
        return (
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <Input.TextArea
              rows={1}
              size="small"
              placeholder="備注（選填）"
              value={processing === r.id ? adminNote : ''}
              onChange={e => setAdminNote(e.target.value)}
              style={{ fontSize: 12 }}
            />
            <Space size={4}>
              <Button
                size="small" type="primary" icon={<CheckOutlined />}
                loading={processing === r.id}
                onClick={() => handleAction(r.id, 'approve')}
              >核准</Button>
              <Button
                size="small" danger icon={<CloseOutlined />}
                loading={processing === r.id}
                onClick={() => handleAction(r.id, 'reject')}
              >拒絕</Button>
            </Space>
          </Space>
        )
      },
    },
  ]

  return (
    <>
      <Table
        dataSource={requests}
        columns={columns}
        rowKey="id"
        size="small"
        pagination={{ pageSize: 20, showTotal: t => `共 ${t} 筆` }}
      />

      {/* 簽名預覽 */}
      <Modal
        title="簽名預覽"
        open={!!sigPreview}
        onCancel={() => setSigPreview(null)}
        footer={null}
        width={400}
      >
        {sigPreview && (
          <Image src={sigPreview} alt="簽名" style={{ width: '100%', border: '1px solid #f0f0f0' }} />
        )}
      </Modal>
    </>
  )
}

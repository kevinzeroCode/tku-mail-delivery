'use client'
import { memo, useRef, useState } from 'react'
import { Modal, Form, Descriptions, Select, Input, Space, DatePicker, message, Typography } from 'antd'
import dayjs from 'dayjs'
import { mailApi } from '@/services/mail'
import SignaturePad, { type SignaturePadRef } from './SignaturePad'
import type { MailItem } from '@/lib/types'

const PICKUP_METHODS = [
  { value: '自行領取', label: '自行領取' },
  { value: '代收通知', label: '代收通知' },
  { value: '付費寄回', label: '付費寄回' },
  { value: '說明告知', label: '說明告知' },
  { value: '其他', label: '其他' },
]

interface Props {
  item: MailItem | null
  onSaved: () => void
  onCancel: () => void
}

async function uploadSignature(dataUrl: string): Promise<string | null> {
  try {
    const blob = await fetch(dataUrl).then(r => r.blob())
    const file = new File([blob], `sig_${Date.now()}.png`, { type: 'image/png' })
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    if (!res.ok) return null
    const data = await res.json()
    return data.savedPath ?? null
  } catch {
    return null
  }
}

export const PickupModal = memo(function PickupModal({ item, onSaved, onCancel }: Props) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const sigRef = useRef<SignaturePadRef>(null)

  const handleOk = async () => {
    if (sigRef.current?.isEmpty()) {
      message.error('請先完成簽名')
      return
    }

    setLoading(true)
    try {
      const values = await form.validateFields()

      const signaturePath = sigRef.current
        ? await uploadSignature(sigRef.current.toDataURL())
        : null

      await mailApi.put(item!.id, {
        status: '已領取',
        pickupDate: values.pickupDate ? values.pickupDate.toISOString() : new Date().toISOString(),
        pickupMethod: values.pickupMethod ?? null,
        pickupPerson: values.pickupPerson ?? null,
        signaturePath,
      })
      message.success('已標記為領取')
      onSaved()
    } catch (e: unknown) {
      if (e instanceof Error) message.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title="確認領取"
      open={!!item}
      onOk={handleOk}
      onCancel={onCancel}
      okText="確認領取"
      cancelText="取消"
      confirmLoading={loading}
      destroyOnHidden
      width={600}
    >
      {item && (
        <>
          <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
            <Descriptions.Item label="追蹤碼">
              <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{item.trackingCode}</span>
            </Descriptions.Item>
            <Descriptions.Item label="類型">{item.mailType}</Descriptions.Item>
            <Descriptions.Item label="收件人">{item.recipientName ?? '—'}</Descriptions.Item>
          </Descriptions>

          <Form
            form={form}
            layout="vertical"
            initialValues={{
              pickupMethod: item.pickupMethod ?? undefined,
              pickupPerson: item.pickupPerson ?? undefined,
              pickupDate: item.pickupDate ? dayjs(item.pickupDate) : dayjs(),
            }}
          >
            <Form.Item name="pickupMethod" label="領取方式">
              <Select allowClear placeholder="請選擇領取方式" options={PICKUP_METHODS} />
            </Form.Item>
            <Space style={{ width: '100%' }} align="start">
              <Form.Item name="pickupPerson" label="領取人" style={{ flex: 1, marginBottom: 0 }}>
                <Input placeholder="實際領取人姓名" />
              </Form.Item>
              <Form.Item name="pickupDate" label="領取日期時間" style={{ flex: 1, marginBottom: 0 }}>
                <DatePicker showTime={{ format: 'HH:mm' }} format="YYYY/MM/DD HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Space>
          </Form>

          <div style={{ marginTop: 16 }}>
            <Typography.Text strong>
              領取人簽名 <Typography.Text type="danger">*</Typography.Text>
            </Typography.Text>
            <div style={{ marginTop: 8 }}>
              <SignaturePad ref={sigRef} height={160} />
            </div>
          </div>
        </>
      )}
    </Modal>
  )
})

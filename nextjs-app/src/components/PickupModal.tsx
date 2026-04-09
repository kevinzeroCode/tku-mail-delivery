'use client'
import { memo, useState } from 'react'
import { Modal, Form, Descriptions, Select, Input, Space, DatePicker, message } from 'antd'
import dayjs from 'dayjs'
import { mailApi } from '@/services/mail'
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

export const PickupModal = memo(function PickupModal({ item, onSaved, onCancel }: Props) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  const handleOk = async () => {
    setLoading(true)
    try {
      const values = await form.validateFields()
      await mailApi.put(item!.id, {
        status: '已領取',
        pickupDate: values.pickupDate ? values.pickupDate.toISOString() : new Date().toISOString(),
        pickupMethod: values.pickupMethod ?? null,
        pickupPerson: values.pickupPerson ?? null,
      })
      message.success('已標記為領取')
      onSaved()
    } catch (e: unknown) {
      if (e instanceof Error) message.error(e.message)
      // AntD form validation errors are non-Error objects — silently ignore
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
      destroyOnClose
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
              <Form.Item name="pickupDate" label="領取日期" style={{ flex: 1, marginBottom: 0 }}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Space>
          </Form>
        </>
      )}
    </Modal>
  )
})

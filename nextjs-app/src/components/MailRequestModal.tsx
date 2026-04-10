'use client'
import { useRef, useState } from 'react'
import { Modal, Form, Select, Input, Alert, message } from 'antd'
import SignaturePad, { type SignaturePadRef } from './SignaturePad'
import type { MailRequestType } from '@/lib/types'

const LABELS: Record<MailRequestType, string> = {
  reject_return:   '申請拒收／退回',
  change_pickup:   '申請異動領取方式',
  wrong_recipient: '申請更正收件人',
  pickup_signed:   '領取郵件（簽名確認）',
}

const PICKUP_METHODS = ['自行領取', '代收通知', '付費寄回', '說明告知', '其他'].map(v => ({ value: v, label: v }))

interface MailLike {
  id: number
  trackingCode: string
  mailType: string
}

interface Props {
  item: MailLike | null
  requestType: MailRequestType | null
  userEmail: string
  onSaved: () => void
  onCancel: () => void
}

export default function MailRequestModal({ item, requestType, userEmail, onSaved, onCancel }: Props) {
  const [form]    = Form.useForm()
  const [loading, setLoading] = useState(false)
  const sigRef    = useRef<SignaturePadRef>(null)

  const handleOk = async () => {
    if (!item || !requestType) return
    setLoading(true)
    try {
      let requestData: Record<string, unknown> = {}

      if (requestType === 'pickup_signed') {
        if (sigRef.current?.isEmpty()) {
          message.warning('請先在下方白板簽名')
          return
        }
        const values = await form.validateFields()
        requestData = {
          signatureData: sigRef.current!.toDataURL(),
          pickerName:    values.pickerName ?? null,
        }
      } else if (requestType === 'change_pickup') {
        const values = await form.validateFields()
        requestData = { newMethod: values.newMethod }
      } else if (requestType === 'wrong_recipient') {
        const values = await form.validateFields()
        requestData = {
          correctName:  values.correctName,
          correctEmail: values.correctEmail ?? null,
          note:         values.note ?? null,
        }
      }

      const res = await fetch('/api/portal/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mailItemId: item.id, userEmail, type: requestType, requestData }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      message.success('申請已送出，請等待收發室確認')
      form.resetFields()
      onSaved()
    } catch (e: unknown) {
      if (e instanceof Error) message.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title={requestType ? LABELS[requestType] : ''}
      open={!!item && !!requestType}
      onOk={handleOk}
      onCancel={() => { form.resetFields(); onCancel() }}
      okText="確認送出"
      cancelText="取消"
      confirmLoading={loading}
      destroyOnClose
      width={requestType === 'pickup_signed' ? 540 : 420}
    >
      {item && requestType && (
        <>
          <Alert
            message={`郵件：${item.trackingCode}（${item.mailType}）`}
            type="info"
            style={{ marginBottom: 16 }}
          />

          {requestType === 'reject_return' && (
            <p style={{ margin: 0 }}>確認申請拒收此郵件？送出後，收發室將安排退回給寄件人。</p>
          )}

          {requestType === 'change_pickup' && (
            <Form form={form} layout="vertical">
              <Form.Item name="newMethod" label="新的領取方式"
                rules={[{ required: true, message: '請選擇領取方式' }]}>
                <Select options={PICKUP_METHODS} placeholder="請選擇" />
              </Form.Item>
            </Form>
          )}

          {requestType === 'wrong_recipient' && (
            <Form form={form} layout="vertical">
              <Form.Item name="correctName" label="正確收件人姓名"
                rules={[{ required: true, message: '請輸入正確姓名' }]}>
                <Input placeholder="請輸入正確的收件人姓名" />
              </Form.Item>
              <Form.Item name="correctEmail" label="正確收件人 Email">
                <Input placeholder="（選填）" />
              </Form.Item>
              <Form.Item name="note" label="說明">
                <Input.TextArea rows={2} placeholder="補充說明（選填）" />
              </Form.Item>
            </Form>
          )}

          {requestType === 'pickup_signed' && (
            <Form form={form} layout="vertical">
              <Form.Item name="pickerName" label="領取人姓名">
                <Input placeholder="本人領取可留空；代領請填代領人姓名" />
              </Form.Item>
              <Form.Item label="請在下方白板簽名" required>
                <SignaturePad ref={sigRef} height={180} />
              </Form.Item>
            </Form>
          )}
        </>
      )}
    </Modal>
  )
}

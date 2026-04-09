'use client'
import { memo, useState } from 'react'
import {
  Modal, Form, Input, Select, Space, DatePicker, InputNumber,
  Divider, Upload, Image, Collapse, message,
} from 'antd'
import { UploadOutlined } from '@ant-design/icons'
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

export const EditMailModal = memo(function EditMailModal({ item, onSaved, onCancel }: Props) {
  const [form] = Form.useForm()
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(item?.photoPath ?? null)
  const [ocrText, setOcrText] = useState(item?.photoOcrText ?? '')
  const [ocrLoading, setOcrLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleOk = async () => {
    if (!item) return
    setSaving(true)
    try {
      const values = form.getFieldsValue()
      const body: Record<string, unknown> = {
        ...values,
        pickupDate: values.pickupDate ? values.pickupDate.toISOString() : null,
        photoOcrText: ocrText || null,
      }
      if (photoFile) {
        body.photoPath = await mailApi.uploadPhoto(photoFile)
      }
      await mailApi.put(item.id, body)
      message.success('已儲存')
      onSaved()
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : '儲存失敗')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="編輯郵件"
      open={!!item}
      onOk={handleOk}
      onCancel={onCancel}
      okText="儲存"
      cancelText="取消"
      confirmLoading={saving}
      destroyOnClose
    >
      {item && (
        <>
          <Form
            form={form}
            layout="vertical"
            initialValues={{
              recipientName: item.recipientName,
              recipientEmail: item.recipientEmail,
              pickupMethod: item.pickupMethod,
              pickupPerson: item.pickupPerson,
              mailType: item.mailType,
              deadlineDays: item.deadlineDays,
              notes: item.notes,
              pickupDate: item.pickupDate ? dayjs(item.pickupDate) : null,
            }}
          >
            <Space style={{ width: '100%' }} align="start">
              <Form.Item name="recipientName" label="收件人姓名" style={{ flex: 1 }}>
                <Input />
              </Form.Item>
              <Form.Item name="recipientEmail" label="收件人 Email" style={{ flex: 1 }}>
                <Input />
              </Form.Item>
            </Space>
            <Form.Item name="pickupMethod" label="領取方式">
              <Select allowClear placeholder="請選擇領取方式" options={PICKUP_METHODS} />
            </Form.Item>
            <Space style={{ width: '100%' }} align="start">
              <Form.Item name="pickupPerson" label="領取人" style={{ flex: 1 }}>
                <Input />
              </Form.Item>
              <Form.Item name="pickupDate" label="領取日期" style={{ flex: 1 }}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Space>
            <Space style={{ width: '100%' }} align="start">
              <Form.Item name="mailType" label="類型" style={{ width: 120 }}>
                <Select options={[
                  { value: '普通' }, { value: '掛號' }, { value: '公文' }, { value: '包裹' },
                ]} />
              </Form.Item>
              <Form.Item name="deadlineDays" label="期限（天）" style={{ width: 130 }}>
                <InputNumber min={1} max={365} style={{ width: '100%' }} />
              </Form.Item>
            </Space>
            <Form.Item name="notes" label="備註">
              <Input.TextArea rows={2} />
            </Form.Item>
          </Form>

          <Divider style={{ margin: '12px 0' }}>貨物照片</Divider>
          <Space align="start" style={{ marginBottom: 8 }}>
            <Upload
              accept="image/*"
              showUploadList={false}
              beforeUpload={async file => {
                setPhotoFile(file)
                const reader = new FileReader()
                reader.onload = e => setPhotoPreview(e.target?.result as string)
                reader.readAsDataURL(file)
                setOcrLoading(true)
                const text = await mailApi.ocr(file)
                if (text) setOcrText(text)
                setOcrLoading(false)
                return false
              }}
            >
              <button style={{ background: 'none', border: '1px solid #d9d9d9', borderRadius: 6, padding: '4px 15px', cursor: 'pointer' }}>
                <UploadOutlined /> {photoPreview ? '更換照片' : '新增照片'}
              </button>
            </Upload>
            {photoPreview && (
              <div>
                <Image src={photoPreview} width={120} height={90}
                  style={{ objectFit: 'cover', borderRadius: 6 }} alt="貨物照片預覽" />
                {photoFile && (
                  <div style={{ fontSize: 11, color: '#1677ff', marginTop: 2 }}>新照片（待儲存）</div>
                )}
              </div>
            )}
          </Space>
          <Collapse ghost items={[{
            key: 'ocr',
            label: ocrLoading ? '⏳ OCR 辨識中…' : '照片文字備註（OCR 結果 / 可手動編輯）',
            children: (
              <Input.TextArea rows={4}
                placeholder="上傳照片後自動填入 OCR 結果，也可手動輸入"
                value={ocrText}
                onChange={e => setOcrText(e.target.value)} />
            ),
          }]} />
        </>
      )}
    </Modal>
  )
})

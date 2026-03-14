'use client'
import { useState } from 'react'
import {
  Modal, Form, Input, Select, DatePicker, InputNumber,
  Tabs, Button, Space, message, Collapse,
} from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import WebcamCapture from './WebcamCapture'
import OcrUpload from './OcrUpload'
import type { MailItem } from '@/lib/types'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: (items: MailItem[]) => void
  defaultDeadlineDays: number
}

export default function AddMailModal({ open, onClose, onCreated, defaultDeadlineDays }: Props) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null)
  const [pendingCodes, setPendingCodes] = useState<string[]>([])
  const [ocrRawText, setOcrRawText] = useState('')
  const [listImagePath, setListImagePath] = useState('')
  const [activeTab, setActiveTab] = useState('manual')
  const [webcamOcrText, setWebcamOcrText] = useState('')
  const [webcamOcrLoading, setWebcamOcrLoading] = useState(false)

  const handlePhotoCapture = async (dataUrl: string) => {
    setPhotoDataUrl(dataUrl)
    message.success('照片已拍攝，正在 OCR 辨識...')
    setWebcamOcrLoading(true)
    try {
      const blob = await fetch(dataUrl).then(r => r.blob())
      const file = new File([blob], 'webcam.jpg', { type: 'image/jpeg' })
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/ocr', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.rawText) {
        setWebcamOcrText(data.rawText)
        message.success('OCR 辨識完成')
      }
    } catch { /* silent */ } finally {
      setWebcamOcrLoading(false)
    }
  }

  const handleOcrResult = (codes: string[], rawText: string, savedPath: string) => {
    setPendingCodes(codes)
    setOcrRawText(rawText)
    setListImagePath(savedPath)
    if (codes.length > 0) {
      form.setFieldValue('trackingCode', codes[0])
      message.success(`OCR 辨識到 ${codes.length} 筆追蹤碼，已填入第一筆`)
    }
  }

  // 將 webcam base64 上傳存檔（使用獨立上傳端點，不依賴 OCR 服務）
  const uploadPhoto = async (): Promise<string | null> => {
    if (!photoDataUrl) return null
    const blob = await fetch(photoDataUrl).then(r => r.blob())
    const formData = new FormData()
    formData.append('file', blob, 'webcam.jpg')
    const res = await fetch('/api/upload', { method: 'POST', body: formData })
    if (!res.ok) return null
    const data = await res.json()
    return data.savedPath ?? null
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()
    setLoading(true)

    try {
      const photoPath = await uploadPhoto()
      const codesToCreate = pendingCodes.length >= 1 && activeTab === 'ocr'
        ? pendingCodes
        : [values.trackingCode]

      const created: MailItem[] = []

      for (const code of codesToCreate) {
        const res = await fetch('/api/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...values,
            trackingCode: code,
            receivedDate: values.receivedDate?.toISOString(),
            photoPath,
            listImagePath: listImagePath || null,
            ocrRawText: ocrRawText || null,
            photoOcrText: webcamOcrText || null,
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error ?? `新增追蹤碼 ${code} 失敗`)
        }
        const item = await res.json()
        created.push(item)
      }

      message.success(`成功新增 ${created.length} 筆郵件`)
      onCreated(created)
      form.resetFields()
      setPhotoDataUrl(null)
      setPendingCodes([])
      setOcrRawText('')
      setListImagePath('')
      setWebcamOcrText('')
    } catch (e) {
      message.error(e instanceof Error ? e.message : '新增失敗')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title={<><PlusOutlined /> 新增郵件</>}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      okText="新增"
      cancelText="取消"
      width={680}
    >
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
        { key: 'manual', label: '手動輸入' },
        { key: 'ocr', label: '掃描簽收清單（OCR）' },
        { key: 'webcam', label: '拍攝貨物照片' },
      ]} />

      {activeTab === 'ocr' && (
        <div style={{ marginBottom: 16 }}>
          <OcrUpload onResult={handleOcrResult} />
          {pendingCodes.length > 1 && (
            <div style={{ marginTop: 8, color: '#1677ff' }}>
              將批次新增 {pendingCodes.length} 筆追蹤碼，其他欄位資料套用到所有筆
            </div>
          )}
        </div>
      )}

      {activeTab === 'webcam' && (
        <div style={{ marginBottom: 16 }}>
          <WebcamCapture onCapture={handlePhotoCapture} />
          {photoDataUrl && (
            <>
              <div style={{ color: 'green', marginTop: 8 }}>✓ 照片已拍攝，送出後自動儲存</div>
              <Collapse ghost style={{ marginTop: 4 }} items={[{
                key: 'ocr',
                label: webcamOcrLoading ? '⏳ OCR 辨識中...' : '照片 OCR 文字（可複製填入下方欄位）',
                children: (
                  <Input.TextArea
                    rows={4}
                    placeholder={webcamOcrLoading ? '辨識中...' : 'OCR 服務離線或無文字結果'}
                    value={webcamOcrText}
                    onChange={e => setWebcamOcrText(e.target.value)}
                  />
                ),
              }]} />
            </>
          )}
        </div>
      )}

      <Form form={form} layout="vertical" initialValues={{ mailType: '掛號', deadlineDays: defaultDeadlineDays, receivedDate: dayjs() }}>
        <Space style={{ width: '100%' }} direction="vertical" size={0}>
          <Form.Item name="trackingCode" label="追蹤碼（前6-8碼）" rules={[{ required: true, message: '請輸入追蹤碼' }]}>
            <Input placeholder="例如：964044" />
          </Form.Item>
          <Space style={{ width: '100%' }}>
            <Form.Item name="mailType" label="類型" style={{ width: 140 }}>
              <Select options={[
                { value: '普通' }, { value: '掛號' }, { value: '公文' }, { value: '包裹' }
              ]} />
            </Form.Item>
            <Form.Item name="receivedDate" label="到件日期" style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="deadlineDays" label="領取期限（天）" style={{ width: 140 }}>
              <InputNumber min={1} max={90} style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          <Space style={{ width: '100%' }}>
            <Form.Item name="recipientName" label="收件人姓名" style={{ flex: 1 }}>
              <Input placeholder="姓名" />
            </Form.Item>
            <Form.Item name="recipientEmail" label="收件人 Email" style={{ flex: 1 }}>
              <Input placeholder="用於 Teams 通知" />
            </Form.Item>
          </Space>
          <Form.Item name="pickupMethod" label="領取方式">
            <Select allowClear placeholder="請選擇領取方式" options={[
              { value: '自行領取', label: '自行領取' },
              { value: '代收通知', label: '代收通知' },
              { value: '付費寄回', label: '付費寄回' },
              { value: '說明告知', label: '說明告知' },
              { value: '其他', label: '其他' },
            ]} />
          </Form.Item>
          <Form.Item name="notes" label="備註">
            <Input.TextArea rows={2} placeholder="例如：訴訟文書、代收貨款…" />
          </Form.Item>
        </Space>
      </Form>
    </Modal>
  )
}

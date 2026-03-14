'use client'
import { useState } from 'react'
import { Upload, Button, Alert, Spin, List, Typography, Space } from 'antd'
import { UploadOutlined, ScanOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'

interface Props {
  onResult: (codes: string[], rawText: string, savedPath: string) => void
}

export default function OcrUpload({ onResult }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [codes, setCodes] = useState<string[]>([])

  const handleUpload = async (file: File) => {
    setLoading(true)
    setError(null)
    setCodes([])

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/ocr', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error ?? 'OCR 失敗')

      setCodes(data.trackingCodes)
      onResult(data.trackingCodes, data.rawText, data.savedPath)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'OCR 發生錯誤')
    } finally {
      setLoading(false)
    }

    return false // 阻止 antd 自動上傳
  }

  return (
    <div>
      <Upload
        accept="image/*,.pdf"
        showUploadList={false}
        beforeUpload={handleUpload}
      >
        <Button icon={<UploadOutlined />} loading={loading}>
          上傳簽收清單圖片
        </Button>
      </Upload>

      {loading && (
        <Space style={{ marginLeft: 12 }}>
          <Spin size="small" />
          <Typography.Text type="secondary">OCR 辨識中...</Typography.Text>
        </Space>
      )}

      {error && <Alert type="error" message={error} style={{ marginTop: 8 }} />}

      {codes.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <Typography.Text strong>
            <ScanOutlined /> 辨識到 {codes.length} 筆追蹤碼：
          </Typography.Text>
          <List
            size="small"
            bordered
            dataSource={codes}
            renderItem={code => <List.Item>{code}</List.Item>}
            style={{ marginTop: 8, maxHeight: 200, overflow: 'auto' }}
          />
        </div>
      )}
    </div>
  )
}

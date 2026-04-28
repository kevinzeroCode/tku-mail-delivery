'use client'
import { useState } from 'react'
import { Upload, Button, Alert, Spin, List, Typography, Space } from 'antd'
import { UploadOutlined, ScanOutlined, CameraOutlined, CloseOutlined } from '@ant-design/icons'
import WebcamCapture from './WebcamCapture'

interface Props {
  onResult: (codes: string[], rawText: string, savedPath: string) => void
}

export default function OcrUpload({ onResult }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [codes, setCodes] = useState<string[]>([])
  const [showCamera, setShowCamera] = useState(false)

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

  const handleCameraCapture = async (dataUrl: string) => {
    setShowCamera(false)
    setLoading(true)
    setError(null)
    setCodes([])
    const blob = await fetch(dataUrl).then(r => r.blob())
    const file = new File([blob], 'camera_list.jpg', { type: 'image/jpeg' })
    await handleUpload(file)
  }

  return (
    <div>
      <Space wrap>
        <Upload
          accept="image/*,.pdf"
          showUploadList={false}
          beforeUpload={handleUpload}
        >
          <Button icon={<UploadOutlined />} loading={loading} disabled={showCamera}>
            上傳清單圖片
          </Button>
        </Upload>

        {!showCamera ? (
          <Button icon={<CameraOutlined />} onClick={() => setShowCamera(true)} disabled={loading}>
            直接拍照
          </Button>
        ) : (
          <Button icon={<CloseOutlined />} onClick={() => setShowCamera(false)}>
            關閉相機
          </Button>
        )}

        {loading && (
          <Space>
            <Spin size="small" />
            <Typography.Text type="secondary">OCR 辨識中...</Typography.Text>
          </Space>
        )}
      </Space>

      {showCamera && (
        <div style={{ marginTop: 12 }}>
          <WebcamCapture onCapture={handleCameraCapture} />
        </div>
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

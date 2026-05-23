'use client'
import { useState } from 'react'
import { Upload, Button, Alert, Spin, List, Typography, Space } from 'antd'
import { UploadOutlined, ScanOutlined, CameraOutlined, CloseOutlined } from '@ant-design/icons'
import WebcamCapture from './WebcamCapture'
import { adminAuthHeaders } from '@/lib/admin-client-auth'

// Resize image to max 1280px on longest side before sending to OCR.
// Webcam captures are already small; this mainly helps large phone/scanner photos
// that would otherwise hit Vercel's 60-second timeout.
async function compressImage(file: File, maxPx = 1280, quality = 0.85): Promise<File> {
  return new Promise((resolve) => {
    const img = new window.Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const { width, height } = img
      const scale = Math.min(1, maxPx / Math.max(width, height))
      const w = Math.round(width  * scale)
      const h = Math.round(height * scale)

      const canvas = document.createElement('canvas')
      canvas.width  = w
      canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)

      canvas.toBlob(
        blob => resolve(blob
          ? new File([blob], file.name, { type: 'image/jpeg' })
          : file                              // fallback: use original if canvas fails
        ),
        'image/jpeg',
        quality,
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

// Parse the fetch response safely: handles the case where Vercel returns a
// 504 HTML page instead of JSON (which would crash JSON.parse with
// "Unexpected non-whitespace character after JSON at position 6").
async function parseOcrResponse(res: Response): Promise<{
  ok: boolean
  error?: string
  trackingCodes?: string[]
  rawText?: string
  savedPath?: string | null
}> {
  const text = await res.text()
  try {
    const data = JSON.parse(text)
    return { ok: res.ok, ...data }
  } catch {
    // Non-JSON body — most likely a Vercel 504 timeout HTML page
    if (res.status === 504) {
      return { ok: false, error: 'OCR 逾時（圖片過大？已自動壓縮，請再試一次）' }
    }
    return { ok: false, error: `伺服器錯誤 ${res.status}，請稍後再試` }
  }
}

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

    try {
      const compressed = await compressImage(file)
      const formData = new FormData()
      formData.append('file', compressed)

      const res = await fetch('/api/ocr', { method: 'POST', body: formData, headers: await adminAuthHeaders() })
      const data = await parseOcrResponse(res)

      if (!data.ok) throw new Error(data.error ?? 'OCR 失敗')

      setCodes(data.trackingCodes ?? [])
      onResult(data.trackingCodes ?? [], data.rawText ?? '', data.savedPath ?? '')
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

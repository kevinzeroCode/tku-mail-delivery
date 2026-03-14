'use client'
import { useRef, useState, useCallback } from 'react'
import Webcam from 'react-webcam'
import { Button, Space, Image } from 'antd'
import { CameraOutlined, RedoOutlined, CheckOutlined } from '@ant-design/icons'

interface Props {
  onCapture: (dataUrl: string) => void
}

export default function WebcamCapture({ onCapture }: Props) {
  const webcamRef = useRef<Webcam>(null)
  const [captured, setCaptured] = useState<string | null>(null)

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot()
    if (imageSrc) setCaptured(imageSrc)
  }, [])

  const confirm = () => {
    if (captured) onCapture(captured)
  }

  return (
    <div style={{ textAlign: 'center' }}>
      {!captured ? (
        <>
          <Webcam
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            style={{ width: '100%', maxWidth: 480, borderRadius: 8 }}
            videoConstraints={{ facingMode: 'environment' }}
          />
          <br />
          <Button icon={<CameraOutlined />} type="primary" onClick={capture} style={{ marginTop: 8 }}>
            拍照
          </Button>
        </>
      ) : (
        <>
          <Image src={captured} style={{ maxWidth: 480, borderRadius: 8 }} alt="preview" />
          <br />
          <Space style={{ marginTop: 8 }}>
            <Button icon={<RedoOutlined />} onClick={() => setCaptured(null)}>重拍</Button>
            <Button icon={<CheckOutlined />} type="primary" onClick={confirm}>使用此照片</Button>
          </Space>
        </>
      )}
    </div>
  )
}

'use client'
import { useState, useCallback } from 'react'
import {
  Alert, Button, Card, Checkbox, Collapse, DatePicker,
  Descriptions, Form, Input, InputNumber, List,
  Select, Segmented, Space, Spin, Table, Tag, Typography,
} from 'antd'
import {
  CameraOutlined, CheckCircleOutlined, CloseCircleOutlined,
  DeleteOutlined, EditOutlined, ExclamationCircleOutlined, PlusOutlined, SnippetsOutlined,
} from '@ant-design/icons'
import WebcamCapture from './WebcamCapture'
import { EditMailModal } from './EditMailModal'
import { adminAuthHeaders } from '@/lib/admin-client-auth'
import { mailApi } from '@/services/mail'
import type { MailItem } from '@/lib/types'

// ── Types ─────────────────────────────────────────────────────────────────────

type ScanEntry = {
  rawCode: string
  status: 'matched' | 'unmatched' | 'ambiguous'
  matchedItem?: MailItem
  candidates?: MailItem[]
}

type BatchResult = { success: number; failed: number }

// ── Helpers ───────────────────────────────────────────────────────────────────

const BATCH_FIELDS = [
  { key: 'scanStatus',    label: '掃描狀態' },
  { key: 'status',        label: '狀態' },
  { key: 'pickupMethod',  label: '領取方式' },
  { key: 'pickupPerson',  label: '領取人' },
  { key: 'pickupDate',    label: '領取日期' },
  { key: 'returnDate',    label: '退回日期' },
  { key: 'mailType',      label: '類型' },
  { key: 'deadlineDays',  label: '期限（天）' },
  { key: 'notes',         label: '備註' },
] as const

const PICKUP_METHODS = ['自行領取', '代收通知', '付費寄回', '說明告知', '其他']

function norm(s: string): string {
  return s.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
}

function matchCode(rawCode: string, items: MailItem[]): ScanEntry {
  const normScanned = norm(rawCode)
  const matches = items.filter(
    item => item.trackingCode && normScanned.startsWith(norm(item.trackingCode)),
  )
  if (matches.length === 0) return { rawCode, status: 'unmatched' }
  const best = matches.reduce((a, b) =>
    norm(a.trackingCode).length >= norm(b.trackingCode).length ? a : b,
  )
  if (matches.length === 1) return { rawCode, status: 'matched', matchedItem: best }
  return { rawCode, status: 'ambiguous', matchedItem: best, candidates: matches }
}

async function compressImage(file: File, maxPx = 1280, quality = 0.85): Promise<File> {
  return new Promise(resolve => {
    const img = new window.Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const { width, height } = img
      const scale = Math.min(1, maxPx / Math.max(width, height))
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(width  * scale)
      canvas.height = Math.round(height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        blob => resolve(blob ? new File([blob], file.name, { type: 'image/jpeg' }) : file),
        'image/jpeg', quality,
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

async function runOcr(file: File): Promise<{ codes: string[]; rawText: string; error?: string }> {
  try {
    const compressed = await compressImage(file)
    const fd = new FormData()
    fd.append('file', compressed)
    const res  = await fetch('/api/ocr', { method: 'POST', body: fd, headers: await adminAuthHeaders() })
    const text = await res.text()
    try {
      const data = JSON.parse(text)
      if (!res.ok) return { codes: [], rawText: '', error: data.error ?? 'OCR 失敗' }
      return { codes: data.trackingCodes ?? [], rawText: data.rawText ?? '' }
    } catch {
      if (res.status === 504) return { codes: [], rawText: '', error: 'OCR 逾時，請重試' }
      return { codes: [], rawText: '', error: `伺服器錯誤 ${res.status}` }
    }
  } catch {
    return { codes: [], rawText: '', error: 'OCR 發生錯誤' }
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  items: MailItem[]
  onRefresh: () => void
}

export default function ListScanCheckPanel({ items, onRefresh }: Props) {
  const [mode, setMode] = useState<'single' | 'batch'>('single')
  const [showCamera, setShowCamera]   = useState(false)
  const [ocrLoading, setOcrLoading]   = useState(false)
  const [ocrError, setOcrError]       = useState<string | null>(null)
  const [manualCode, setManualCode]   = useState('')

  // OCR 辨識後待確認的碼（可編輯）
  const [ocrEditCodes, setOcrEditCodes] = useState<string[]>([])

  // Single mode
  const [singleEntry, setSingleEntry] = useState<ScanEntry | null>(null)
  const [editItem, setEditItem]       = useState<MailItem | null>(null)

  // Batch mode
  const [batchEntries, setBatchEntries]     = useState<ScanEntry[]>([])
  const [unmatchedCodes, setUnmatchedCodes] = useState<string[]>([])
  const [enabledFields, setEnabledFields]   = useState<Set<string>>(new Set())
  const [batchForm]                         = Form.useForm()
  const [batchUpdating, setBatchUpdating]   = useState(false)
  const [batchResult, setBatchResult]       = useState<BatchResult | null>(null)

  // 擷取郵件文字
  const [showSampleCamera, setShowSampleCamera] = useState(false)
  const [sampleLoading, setSampleLoading]       = useState(false)
  const [sampleText, setSampleText]             = useState<string | null>(null)
  const [sampleError, setSampleError]           = useState<string | null>(null)

  const resetScan = useCallback(() => {
    setOcrError(null)
    setOcrEditCodes([])
    setSingleEntry(null)
    setShowCamera(false)
  }, [])

  const handleManualAdd = useCallback(() => {
    const code = manualCode.trim()
    if (!code) return
    const entry = matchCode(code, items)
    if (mode === 'single') {
      setSingleEntry(entry)
    } else {
      if (entry.status === 'matched' && entry.matchedItem) {
        setBatchEntries(prev => {
          const ids = new Set(prev.filter(e => e.matchedItem).map(e => e.matchedItem!.id))
          if (ids.has(entry.matchedItem!.id)) return prev
          return [...prev, entry]
        })
      } else {
        setUnmatchedCodes(prev => prev.includes(code) ? prev : [...prev, code])
      }
    }
    setManualCode('')
  }, [manualCode, mode, items])

  const handleConfirmSingle = useCallback((code: string) => {
    if (!code.trim()) return
    setSingleEntry(matchCode(code.trim(), items))
    setOcrEditCodes([])
  }, [items])

  const handleConfirmBatch = useCallback((codes: string[]) => {
    const cleaned = codes.map(c => c.trim()).filter(Boolean)

    setBatchEntries(prev => {
      const existingIds = new Set(prev.filter(e => e.matchedItem).map(e => e.matchedItem!.id))
      const toAdd: ScanEntry[] = []
      for (const code of cleaned) {
        const entry = matchCode(code, items)
        // 只加入明確匹配，ambiguous 丟警告區
        if (entry.status === 'matched' && entry.matchedItem && !existingIds.has(entry.matchedItem.id)) {
          existingIds.add(entry.matchedItem.id)
          toAdd.push(entry)
        }
      }
      return [...prev, ...toAdd]
    })

    setUnmatchedCodes(prev => {
      const needsReview = cleaned.filter(c => {
        const e = matchCode(c, items)
        return e.status === 'unmatched' || e.status === 'ambiguous'
      })
      const toAdd = needsReview.filter(c => !prev.includes(c))
      return toAdd.length ? [...prev, ...toAdd] : prev
    })

    setOcrEditCodes([])
  }, [items])

  const handleCapture = useCallback(async (dataUrl: string) => {
    setShowCamera(false)
    setOcrLoading(true)
    setOcrError(null)
    setOcrEditCodes([])

    const blob = await fetch(dataUrl).then(r => r.blob())
    const file = new File([blob], 'scan.jpg', { type: 'image/jpeg' })
    const { codes, error } = await runOcr(file)

    setOcrLoading(false)

    if (error) { setOcrError(error); return }

    if (mode === 'single') {
      if (codes.length === 0) { setOcrError('未辨識到追蹤碼，請重新拍照'); return }
      setOcrEditCodes([codes[0]])
    } else {
      // Batch: 填入可編輯暫存，使用 norm() 去重
      setOcrEditCodes(prev => {
        const seen = new Set(prev.map(norm))
        const toAdd = codes.filter(code => {
          const key = norm(code)
          if (!key || seen.has(key)) return false
          seen.add(key)
          return true
        })
        return [...prev, ...toAdd]
      })
    }
  }, [mode])

  const handleSampleCapture = useCallback(async (dataUrl: string) => {
    setShowSampleCamera(false)
    setSampleLoading(true)
    setSampleError(null)
    const blob = await fetch(dataUrl).then(r => r.blob())
    const file = new File([blob], 'sample.jpg', { type: 'image/jpeg' })
    const { rawText, error } = await runOcr(file)
    setSampleLoading(false)
    if (error) { setSampleError(error); return }
    setSampleText(rawText || '（無辨識文字）')
  }, [])

  const clearBatch = () => {
    setBatchEntries([])
    setUnmatchedCodes([])
    setBatchResult(null)
    setOcrError(null)
    setOcrEditCodes([])
    batchForm.resetFields()
    setEnabledFields(new Set())
  }

  const toggleField = (key: string) => {
    setEnabledFields(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const applyBatch = async () => {
    const toUpdate = batchEntries.filter(e => e.matchedItem)
    if (toUpdate.length === 0 || enabledFields.size === 0) return

    const values = batchForm.getFieldsValue()
    const body: Record<string, unknown> = {}
    for (const key of enabledFields) {
      const v = values[key]
      body[key] = (key === 'pickupDate' || key === 'returnDate')
        ? (v ? v.toISOString() : null)
        : (v ?? null)
    }

    setBatchUpdating(true)
    const results = await mailApi.batchUpdate(toUpdate.map(e => e.matchedItem!.id), body)
    setBatchUpdating(false)

    const success = results.filter(r => r.status === 'fulfilled').length
    const failed  = results.filter(r => r.status === 'rejected').length
    setBatchResult({ success, failed })
    if (success > 0) onRefresh()
  }

  // ── Single mode ────────────────────────────────────────────────────────────

  const singlePane = (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Space.Compact style={{ width: '100%', maxWidth: 400 }}>
        <Input
          placeholder="手動輸入追蹤碼"
          value={manualCode}
          onChange={e => setManualCode(e.target.value)}
          onPressEnter={handleManualAdd}
          allowClear
        />
        <Button icon={<PlusOutlined />} onClick={handleManualAdd}>加入</Button>
      </Space.Compact>

      {!showCamera && (
        <Button icon={<CameraOutlined />} type="primary"
          onClick={() => { resetScan(); setShowCamera(true) }}
          disabled={ocrLoading}>
          開啟相機掃描
        </Button>
      )}

      {showCamera && <WebcamCapture onCapture={handleCapture} />}

      {ocrLoading && (
        <Space><Spin size="small" /><Typography.Text type="secondary">OCR 辨識中…</Typography.Text></Space>
      )}
      {ocrError && <Alert type="error" message={ocrError} />}

      {/* OCR 辨識結果確認（可編輯） */}
      {ocrEditCodes.length > 0 && (
        <Card size="small" title="OCR 辨識結果（可修改後查詢）">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Input
              value={ocrEditCodes[0]}
              onChange={e => setOcrEditCodes([e.target.value])}
              onPressEnter={() => handleConfirmSingle(ocrEditCodes[0])}
              placeholder="追蹤碼"
              allowClear
            />
            <Space>
              <Button type="primary" onClick={() => handleConfirmSingle(ocrEditCodes[0])}>查詢</Button>
              <Button onClick={() => setOcrEditCodes([])}>取消</Button>
            </Space>
          </Space>
        </Card>
      )}

      {singleEntry && (singleEntry.status === 'unmatched' ? (
        <Alert type="warning" showIcon icon={<CloseCircleOutlined />}
          message={`未找到符合「${singleEntry.rawCode}」的郵件`}
          description="請確認追蹤碼是否正確，或重新掃描。"
          action={<Button size="small" onClick={resetScan}>重新掃描</Button>}
        />
      ) : (
        <Card size="small" title={
          <Space>
            <CheckCircleOutlined style={{ color: '#52c41a' }} />
            找到匹配郵件
            {singleEntry.status === 'ambiguous' && (
              <Tag color="orange" icon={<ExclamationCircleOutlined />}>可能重複</Tag>
            )}
          </Space>
        }>
          {singleEntry.status === 'ambiguous' && (
            <Alert type="warning" style={{ marginBottom: 8 }}
              message={`有 ${singleEntry.candidates?.length} 筆前綴相符，已選最長追蹤碼作為主要匹配`} />
          )}
          <Descriptions size="small" column={2}>
            <Descriptions.Item label="追蹤碼">{singleEntry.matchedItem!.trackingCode}</Descriptions.Item>
            <Descriptions.Item label="狀態">{singleEntry.matchedItem!.status}</Descriptions.Item>
            <Descriptions.Item label="收件人">{singleEntry.matchedItem!.recipientName ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="類型">{singleEntry.matchedItem!.mailType}</Descriptions.Item>
          </Descriptions>
          <Space style={{ marginTop: 12 }} wrap>
            <Button type="primary" icon={<CheckCircleOutlined />}
              onClick={async () => {
                await fetch(`/api/items/${singleEntry.matchedItem!.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json', ...await adminAuthHeaders() },
                  body: JSON.stringify({ scanStatus: '已掃描' }),
                })
                onRefresh(); resetScan()
              }}>
              標記已掃描
            </Button>
            <Button danger icon={<ExclamationCircleOutlined />}
              onClick={async () => {
                await fetch(`/api/items/${singleEntry.matchedItem!.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json', ...await adminAuthHeaders() },
                  body: JSON.stringify({ scanStatus: '異常' }),
                })
                onRefresh(); resetScan()
              }}>
              標記異常
            </Button>
            <Button icon={<EditOutlined />}
              onClick={() => setEditItem(singleEntry.matchedItem!)}>
              修改這筆
            </Button>
            <Button onClick={resetScan}>重新掃描</Button>
          </Space>
        </Card>
      ))}

      <EditMailModal
        item={editItem}
        onSaved={() => { setEditItem(null); setSingleEntry(null); onRefresh() }}
        onCancel={() => setEditItem(null)}
      />
    </Space>
  )

  // ── Batch mode ─────────────────────────────────────────────────────────────

  const matchedCount = batchEntries.filter(e => e.matchedItem).length

  const batchPane = (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Space.Compact style={{ width: '100%', maxWidth: 400 }}>
        <Input
          placeholder="手動輸入追蹤碼"
          value={manualCode}
          onChange={e => setManualCode(e.target.value)}
          onPressEnter={handleManualAdd}
          allowClear
        />
        <Button icon={<PlusOutlined />} onClick={handleManualAdd} disabled={batchUpdating}>加入</Button>
      </Space.Compact>

      <Space wrap>
        {!showCamera ? (
          <Button icon={<CameraOutlined />} type="primary"
            onClick={() => setShowCamera(true)}
            disabled={ocrLoading || batchUpdating}>
            掃描下一件
          </Button>
        ) : (
          <Button onClick={() => setShowCamera(false)}>關閉相機</Button>
        )}
        {(batchEntries.length > 0 || unmatchedCodes.length > 0) && (
          <Button danger onClick={clearBatch} disabled={batchUpdating}>清空清單</Button>
        )}
      </Space>

      {showCamera && <WebcamCapture onCapture={handleCapture} />}

      {ocrLoading && (
        <Space><Spin size="small" /><Typography.Text type="secondary">OCR 辨識中…</Typography.Text></Space>
      )}
      {ocrError && <Alert type="error" message={ocrError} />}

      {/* OCR 辨識結果確認（可編輯後加入清單） */}
      {ocrEditCodes.length > 0 && (
        <Card size="small" title={`OCR 辨識到 ${ocrEditCodes.length} 個追蹤碼（可修改）`}>
          <Space direction="vertical" style={{ width: '100%' }}>
            {ocrEditCodes.map((code, i) => (
              <Space.Compact key={i} style={{ width: '100%' }}>
                <Input
                  value={code}
                  onChange={e => {
                    const next = [...ocrEditCodes]; next[i] = e.target.value; setOcrEditCodes(next)
                  }}
                />
                <Button danger icon={<DeleteOutlined />}
                  onClick={() => setOcrEditCodes(prev => prev.filter((_, idx) => idx !== i))} />
              </Space.Compact>
            ))}
            <Space>
              <Button type="primary" onClick={() => handleConfirmBatch(ocrEditCodes)}>加入清單</Button>
              <Button onClick={() => setOcrEditCodes([])}>取消</Button>
            </Space>
          </Space>
        </Card>
      )}

      {batchEntries.length > 0 && (
        <Table<ScanEntry>
          dataSource={batchEntries}
          rowKey={e => e.matchedItem?.id ?? e.rawCode}
          size="small"
          pagination={false}
          title={() => <strong>已匹配 {matchedCount} 筆</strong>}
          columns={[
            {
              title: '追蹤碼',
              render: (_, e) => (
                <Space>
                  {e.matchedItem!.trackingCode}
                  {e.status === 'ambiguous' && <Tag color="orange">可能重複</Tag>}
                </Space>
              ),
            },
            { title: '收件人', render: (_, e) => e.matchedItem!.recipientName ?? '—' },
            { title: '狀態',   render: (_, e) => e.matchedItem!.status },
            {
              title: '', width: 48,
              render: (_, e) => (
                <Button size="small" danger icon={<DeleteOutlined />}
                  onClick={() => setBatchEntries(prev =>
                    prev.filter(x => x.matchedItem?.id !== e.matchedItem!.id)
                  )} />
              ),
            },
          ]}
        />
      )}

      {unmatchedCodes.length > 0 && (
        <Alert type="warning"
          message={`${unmatchedCodes.length} 筆未匹配或需人工確認`}
          description={
            <List size="small" dataSource={unmatchedCodes}
              renderItem={code => <List.Item>{code}</List.Item>} />
          }
        />
      )}

      {matchedCount > 0 && (
        <Card size="small" title="批量設定欄位">
          <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
            勾選要套用的欄位，未勾選的欄位不會被修改。
          </Typography.Text>
          <Form form={batchForm} layout="vertical">
            {BATCH_FIELDS.map(({ key, label }) => (
              <Space key={key} align="start" style={{ marginBottom: 4 }}>
                <Checkbox
                  checked={enabledFields.has(key)}
                  onChange={() => toggleField(key)}
                  style={{ marginTop: 28 }}
                />
                <Form.Item name={key} label={label} style={{ marginBottom: 0, minWidth: 260 }}>
                  {key === 'scanStatus' ? (
                    <Select disabled={!enabledFields.has(key)} allowClear
                      options={[{ value: '未掃描' }, { value: '已掃描' }, { value: '異常' }]} />
                  ) : key === 'status' ? (
                    <Select disabled={!enabledFields.has(key)} allowClear
                      options={[{ value: '待領取' }, { value: '已領取' }, { value: '已退回' }]} />
                  ) : key === 'pickupMethod' ? (
                    <Select disabled={!enabledFields.has(key)} allowClear
                      options={PICKUP_METHODS.map(v => ({ value: v }))} />
                  ) : key === 'mailType' ? (
                    <Select disabled={!enabledFields.has(key)} allowClear
                      options={[{ value: '普通' }, { value: '掛號' }, { value: '公文' }, { value: '包裹' }]} />
                  ) : key === 'pickupDate' || key === 'returnDate' ? (
                    <DatePicker showTime={{ format: 'HH:mm' }} format="YYYY/MM/DD HH:mm"
                      disabled={!enabledFields.has(key)} style={{ width: '100%' }} />
                  ) : key === 'deadlineDays' ? (
                    <InputNumber min={1} max={365} disabled={!enabledFields.has(key)} style={{ width: '100%' }} />
                  ) : (
                    <Input disabled={!enabledFields.has(key)} />
                  )}
                </Form.Item>
              </Space>
            ))}
          </Form>
          <Button type="primary" style={{ marginTop: 8 }}
            onClick={applyBatch}
            loading={batchUpdating}
            disabled={enabledFields.size === 0 || matchedCount === 0}>
            套用到 {matchedCount} 筆
          </Button>
        </Card>
      )}

      {batchResult && (
        <Alert
          type={batchResult.failed === 0 ? 'success' : 'warning'}
          message={`更新完成：成功 ${batchResult.success} 筆${batchResult.failed > 0 ? `，失敗 ${batchResult.failed} 筆` : ''}`}
          closable
          onClose={() => setBatchResult(null)}
        />
      )}
    </Space>
  )

  // ── Layout ─────────────────────────────────────────────────────────────────

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      {/* 擷取郵件文字 — 內嵌可折疊面板 */}
      <Collapse
        ghost
        onChange={keys => {
          const activeKeys = Array.isArray(keys) ? keys : [keys]
          if (!activeKeys.includes('sample')) setShowSampleCamera(false)
        }}
        items={[{
          key: 'sample',
          label: <Space><SnippetsOutlined />擷取郵件文字</Space>,
          children: (
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              {!showSampleCamera
                ? <Button icon={<CameraOutlined />}
                    onClick={() => setShowSampleCamera(true)}
                    loading={sampleLoading}>
                    開啟相機拍攝
                  </Button>
                : <WebcamCapture onCapture={handleSampleCapture} />
              }
              {sampleError && <Alert type="error" message={sampleError} />}
              {sampleText && (
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Typography.Text type="secondary">
                    OCR 辨識文字（可選取任意部分複製）：
                  </Typography.Text>
                  <Input.TextArea
                    value={sampleText}
                    rows={8}
                    readOnly
                    style={{ fontFamily: 'monospace' }}
                  />
                  <Space>
                    <Typography.Text copyable={{ text: sampleText }}>複製全部文字</Typography.Text>
                    <Button size="small" onClick={() => setSampleText(null)}>清除</Button>
                  </Space>
                </Space>
              )}
            </Space>
          ),
        }]}
      />

      <Segmented
        value={mode}
        onChange={v => { setMode(v as 'single' | 'batch'); resetScan() }}
        options={[
          { label: '單筆掃描', value: 'single' },
          { label: '批次掃描', value: 'batch' },
        ]}
      />

      {mode === 'single' ? singlePane : batchPane}
    </Space>
  )
}

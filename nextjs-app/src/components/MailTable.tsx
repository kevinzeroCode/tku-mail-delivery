'use client'
import { useState } from 'react'
import {
  Table, Button, Space, Select, Input, Tooltip, Popconfirm,
  message, Modal, Form, DatePicker, InputNumber, Image, Tag, Alert, Drawer,
  Descriptions, Divider, Upload, Collapse,
} from 'antd'
import {
  BellOutlined, CheckOutlined, RollbackOutlined,
  EditOutlined, DeleteOutlined, EyeOutlined, PictureOutlined, UploadOutlined,
} from '@ant-design/icons'
import type { ColumnsType, TableRowSelection } from 'antd/es/table/interface'
import dayjs from 'dayjs'
import StatusBadge from './StatusBadge'
import type { MailItem } from '@/lib/types'

interface Props {
  items: MailItem[]
  onRefresh: () => void
}

export default function MailTable({ items, onRefresh }: Props) {
  const [editingItem, setEditingItem] = useState<MailItem | null>(null)
  const [editForm] = Form.useForm()
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null)
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterType, setFilterType] = useState<string>('')
  const [search, setSearch] = useState('')
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [batchLoading, setBatchLoading] = useState(false)
  const [detailItem, setDetailItem] = useState<MailItem | null>(null)
  const [photoOcrEdit, setPhotoOcrEdit] = useState<string>('')
  const [photoOcrSaving, setPhotoOcrSaving] = useState(false)
  const [photoOcrLoading, setPhotoOcrLoading] = useState(false)

  const filtered = items.filter(item => {
    if (filterStatus && item.status !== filterStatus) return false
    if (filterType && item.mailType !== filterType) return false
    if (search && !item.trackingCode.includes(search) && !(item.recipientName ?? '').includes(search)) return false
    return true
  })

  // ── 單筆操作 ──────────────────────────────────────────

  const sendNotify = async (item: MailItem) => {
    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: item.id }),
    })
    if (res.ok) {
      message.success(`已發送 Teams 通知`)
      onRefresh()
    } else {
      const d = await res.json()
      message.error(d.error ?? '通知失敗')
    }
  }

  const updateStatus = async (item: MailItem, status: string) => {
    const body: Record<string, unknown> = { status }
    if (status === '已領取') body.pickupDate = new Date().toISOString()
    const res = await fetch(`/api/items/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      message.error(d.error ?? '狀態更新失敗')
      return
    }
    message.success('狀態已更新')
    onRefresh()
  }

  const deleteItem = async (id: number) => {
    const res = await fetch(`/api/items/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      message.error(d.error ?? '刪除失敗')
      return
    }
    message.success('已刪除')
    onRefresh()
  }

  const openEdit = (item: MailItem) => {
    setEditingItem(item)
    setEditPhotoFile(null)
    setEditPhotoPreview(item.photoPath ?? null)
    editForm.setFieldsValue({
      recipientName: item.recipientName,
      recipientEmail: item.recipientEmail,
      pickupMethod: item.pickupMethod,
      pickupPerson: item.pickupPerson,
      mailType: item.mailType,
      deadlineDays: item.deadlineDays,
      notes: item.notes,
      pickupDate: item.pickupDate ? dayjs(item.pickupDate) : null,
    })
  }

  const saveEdit = async () => {
    if (!editingItem) return
    const values = editForm.getFieldsValue()

    let newPhotoPath: string | undefined
    if (editPhotoFile) {
      const fd = new FormData()
      fd.append('file', editPhotoFile)
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!uploadRes.ok) {
        message.error('照片上傳失敗')
        return
      }
      const uploadData = await uploadRes.json()
      newPhotoPath = uploadData.savedPath
    }

    const body: Record<string, unknown> = {
      ...values,
      pickupDate: values.pickupDate?.toISOString(),
    }
    if (newPhotoPath !== undefined) body.photoPath = newPhotoPath

    const res = await fetch(`/api/items/${editingItem.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      message.error(d.error ?? '儲存失敗')
      return
    }
    message.success('已儲存')
    setEditingItem(null)
    setEditPhotoFile(null)
    setEditPhotoPreview(null)
    onRefresh()
  }

  // ── 批量操作 ──────────────────────────────────────────

  const selectedItems = items.filter(i => selectedRowKeys.includes(i.id))

  const batchAction = async (action: 'notify' | 'pickup' | 'return' | 'delete') => {
    setBatchLoading(true)
    const targets = action === 'notify'
      ? selectedItems.filter(i => i.status === '待領取')
      : selectedItems

    try {
      await Promise.all(targets.map(item => {
        if (action === 'notify') {
          return fetch('/api/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemId: item.id }),
          })
        }
        if (action === 'delete') {
          return fetch(`/api/items/${item.id}`, { method: 'DELETE' })
        }
        const status = action === 'pickup' ? '已領取' : '已退回'
        return fetch(`/api/items/${item.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status,
            ...(action === 'pickup' ? { pickupDate: new Date().toISOString() } : {}),
          }),
        })
      }))

      message.success(`已完成 ${targets.length} 筆操作`)
      setSelectedRowKeys([])
      onRefresh()
    } catch {
      message.error('部分操作失敗')
    } finally {
      setBatchLoading(false)
    }
  }

  const rowSelection: TableRowSelection<MailItem> = {
    selectedRowKeys,
    onChange: keys => setSelectedRowKeys(keys),
    selections: [
      Table.SELECTION_ALL,
      Table.SELECTION_INVERT,
      {
        key: 'pending',
        text: '選取所有待領取',
        onSelect: () => setSelectedRowKeys(filtered.filter(i => i.status === '待領取').map(i => i.id)),
      },
    ],
  }

  // ── 行樣式（逾期標色）──────────────────────────────────

  const deadlineColor = (item: MailItem) => {
    if (item.status !== '待領取') return {}
    const deadline = dayjs(item.receivedDate).add(item.deadlineDays, 'day')
    if (dayjs().isAfter(deadline)) return { background: '#fff1f0' }
    if (deadline.diff(dayjs(), 'day') <= 2) return { background: '#fffbe6' }
    return {}
  }

  // ── 欄位定義 ──────────────────────────────────────────

  const columns: ColumnsType<MailItem> = [
    {
      title: '追蹤碼',
      dataIndex: 'trackingCode',
      key: 'trackingCode',
      width: 110,
      render: (v, record) => (
        <Space size={4}>
          <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{v}</span>
          {(record.photoPath || record.listImagePath) && (
            <Tooltip title="有附圖">
              <PictureOutlined style={{ color: '#1677ff', cursor: 'pointer' }}
                onClick={() => setDetailItem(record)} />
            </Tooltip>
          )}
        </Space>
      ),
    },
    { title: '類型', dataIndex: 'mailType', key: 'mailType', width: 70 },
    {
      title: '到件',
      dataIndex: 'receivedDate',
      key: 'receivedDate',
      width: 100,
      render: v => dayjs(v).format('MM/DD'),
    },
    {
      title: '期限',
      key: 'deadline',
      width: 100,
      render: (_, record) => {
        const d = dayjs(record.receivedDate).add(record.deadlineDays, 'day')
        const overdue = record.status === '待領取' && dayjs().isAfter(d)
        return (
          <span style={{ color: overdue ? '#ff4d4f' : undefined }}>
            {d.format('MM/DD')}
          </span>
        )
      },
    },
    { title: '收件人', dataIndex: 'recipientName', key: 'recipientName', width: 90 },
    {
      title: '狀態',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: v => <StatusBadge status={v} />,
    },
    { title: '領取方式', dataIndex: 'pickupMethod', key: 'pickupMethod', width: 90, render: (v: string | null) => v ?? '—' },
    { title: '領取人', dataIndex: 'pickupPerson', key: 'pickupPerson', width: 80 },
    {
      title: '通知',
      key: 'notificationSent',
      width: 55,
      render: (_, record) => record.notificationSent
        ? <Tooltip title={`${dayjs(record.notificationDate).format('MM/DD')} 已通知`}>
            <BellOutlined style={{ color: '#52c41a' }} />
          </Tooltip>
        : <span style={{ color: '#d9d9d9' }}>—</span>,
    },
    { title: '備註', dataIndex: 'notes', key: 'notes', ellipsis: true },
    {
      title: '操作',
      key: 'actions',
      width: 190,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="詳細 / 圖片預覽">
            <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailItem(record)} />
          </Tooltip>
          <Tooltip title="編輯">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          </Tooltip>
          {record.status === '待領取' && (
            <>
              <Tooltip title="發送通知">
                <Button size="small" icon={<BellOutlined />} onClick={() => sendNotify(record)} />
              </Tooltip>
              <Tooltip title="已領取">
                <Button size="small" type="primary" icon={<CheckOutlined />}
                  onClick={() => updateStatus(record, '已領取')} />
              </Tooltip>
              <Tooltip title="已退回">
                <Button size="small" danger icon={<RollbackOutlined />}
                  onClick={() => updateStatus(record, '已退回')} />
              </Tooltip>
            </>
          )}
          <Popconfirm title="確定刪除？" onConfirm={() => deleteItem(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <>
      {/* 批量操作列 */}
      {selectedRowKeys.length > 0 && (
        <Alert
          style={{ marginBottom: 12 }}
          message={
            <Space wrap>
              <span>已選取 <strong>{selectedRowKeys.length}</strong> 筆</span>
              <Button size="small" icon={<BellOutlined />} loading={batchLoading}
                onClick={() => batchAction('notify')}>
                批量通知（待領取）
              </Button>
              <Button size="small" type="primary" icon={<CheckOutlined />} loading={batchLoading}
                onClick={() => batchAction('pickup')}>
                批量已領取
              </Button>
              <Button size="small" icon={<RollbackOutlined />} loading={batchLoading}
                onClick={() => batchAction('return')}>
                批量已退回
              </Button>
              <Popconfirm title={`確定刪除 ${selectedRowKeys.length} 筆？`}
                onConfirm={() => batchAction('delete')}>
                <Button size="small" danger icon={<DeleteOutlined />} loading={batchLoading}>
                  批量刪除
                </Button>
              </Popconfirm>
              <Button size="small" onClick={() => setSelectedRowKeys([])}>取消選取</Button>
            </Space>
          }
          type="info"
          showIcon={false}
        />
      )}

      {/* 篩選列 */}
      <Space style={{ marginBottom: 12 }} wrap>
        <Input.Search
          placeholder="搜尋追蹤碼 / 收件人"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 220 }}
          allowClear
        />
        <Select placeholder="狀態" value={filterStatus || undefined}
          onChange={setFilterStatus} allowClear style={{ width: 110 }}
          options={[{ value: '待領取' }, { value: '已領取' }, { value: '已退回' }]} />
        <Select placeholder="類型" value={filterType || undefined}
          onChange={setFilterType} allowClear style={{ width: 110 }}
          options={[{ value: '普通' }, { value: '掛號' }, { value: '公文' }, { value: '包裹' }]} />
        <span style={{ color: '#888' }}>共 {filtered.length} 筆</span>
      </Space>

      <Table
        dataSource={filtered}
        columns={columns}
        rowKey="id"
        size="small"
        rowSelection={rowSelection}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: t => `共 ${t} 筆` }}
        onRow={record => ({ style: deadlineColor(record) })}
        scroll={{ x: 1100 }}
      />

      {/* 編輯 Modal */}
      <Modal title="編輯郵件" open={!!editingItem} onOk={saveEdit}
        onCancel={() => { setEditingItem(null); setEditPhotoFile(null); setEditPhotoPreview(null) }}
        okText="儲存" cancelText="取消">
        <Form form={editForm} layout="vertical">
          <Space style={{ width: '100%' }}>
            <Form.Item name="recipientName" label="收件人姓名" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
            <Form.Item name="recipientEmail" label="收件人 Email" style={{ flex: 1 }}>
              <Input />
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
          <Space style={{ width: '100%' }}>
            <Form.Item name="pickupPerson" label="領取人" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
            <Form.Item name="pickupDate" label="領取日期" style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          <Space style={{ width: '100%' }}>
            <Form.Item name="mailType" label="類型" style={{ width: 120 }}>
              <Select options={[{ value: '普通' }, { value: '掛號' }, { value: '公文' }, { value: '包裹' }]} />
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
        <Space align="start">
          <Upload
            accept="image/*"
            showUploadList={false}
            beforeUpload={file => {
              setEditPhotoFile(file)
              const reader = new FileReader()
              reader.onload = e => setEditPhotoPreview(e.target?.result as string)
              reader.readAsDataURL(file)
              return false
            }}
          >
            <Button icon={<UploadOutlined />}>
              {editPhotoPreview ? '更換照片' : '新增照片'}
            </Button>
          </Upload>
          {editPhotoPreview && (
            <div style={{ position: 'relative' }}>
              <Image
                src={editPhotoPreview}
                width={120}
                height={90}
                style={{ objectFit: 'cover', borderRadius: 6 }}
                alt="貨物照片預覽"
              />
              {editPhotoFile && (
                <div style={{ fontSize: 11, color: '#1677ff', marginTop: 2 }}>新照片（待儲存）</div>
              )}
            </div>
          )}
        </Space>
      </Modal>

      {/* 詳細 / 圖片預覽 Drawer */}
      <Drawer
        title={`郵件詳細 — ${detailItem?.trackingCode}`}
        open={!!detailItem}
        onClose={() => { setDetailItem(null); setPhotoOcrEdit('') }}
        width={480}
        afterOpenChange={open => { if (open && detailItem) setPhotoOcrEdit(detailItem.photoOcrText ?? '') }}
      >
        {detailItem && (
          <>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="追蹤碼">{detailItem.trackingCode}</Descriptions.Item>
              <Descriptions.Item label="類型">{detailItem.mailType}</Descriptions.Item>
              <Descriptions.Item label="收件人">{detailItem.recipientName ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Email">{detailItem.recipientEmail ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="到件日期">
                {dayjs(detailItem.receivedDate).format('YYYY/MM/DD HH:mm')}
              </Descriptions.Item>
              <Descriptions.Item label="領取期限">
                {dayjs(detailItem.receivedDate).add(detailItem.deadlineDays, 'day').format('YYYY/MM/DD')}
              </Descriptions.Item>
              <Descriptions.Item label="狀態"><StatusBadge status={detailItem.status} /></Descriptions.Item>
              {detailItem.pickupMethod && (
                <Descriptions.Item label="領取方式">{detailItem.pickupMethod}</Descriptions.Item>
              )}
              {detailItem.pickupPerson && (
                <Descriptions.Item label="領取人">{detailItem.pickupPerson}</Descriptions.Item>
              )}
              {detailItem.pickupDate && (
                <Descriptions.Item label="領取日期">
                  {dayjs(detailItem.pickupDate).format('YYYY/MM/DD')}
                </Descriptions.Item>
              )}
              {detailItem.notes && (
                <Descriptions.Item label="備註">{detailItem.notes}</Descriptions.Item>
              )}
            </Descriptions>

            {(detailItem.photoPath || detailItem.listImagePath) && (
              <>
                <Divider>附件圖片</Divider>
                <Image.PreviewGroup>
                  <Space wrap>
                    {detailItem.photoPath && (
                      <div style={{ textAlign: 'center' }}>
                        <Image
                          src={detailItem.photoPath}
                          width={200}
                          height={160}
                          style={{ objectFit: 'cover', borderRadius: 8, cursor: 'pointer' }}
                          alt="貨物照片"
                        />
                        <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>貨物照片</div>
                      </div>
                    )}
                    {detailItem.listImagePath && (
                      <div style={{ textAlign: 'center' }}>
                        <Image
                          src={detailItem.listImagePath}
                          width={200}
                          height={160}
                          style={{ objectFit: 'cover', borderRadius: 8, cursor: 'pointer' }}
                          alt="簽收清單"
                        />
                        <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>簽收清單</div>
                      </div>
                    )}
                  </Space>
                </Image.PreviewGroup>
                {detailItem.photoPath && (
                  <Collapse
                    ghost
                    style={{ marginTop: 8 }}
                    items={[{
                      key: 'photo-ocr',
                      label: '貨物照片 OCR 文字',
                      children: (
                        <Space direction="vertical" style={{ width: '100%' }}>
                          <Button
                            size="small"
                            loading={photoOcrLoading}
                            onClick={async () => {
                              setPhotoOcrLoading(true)
                              try {
                                const imgRes = await fetch(detailItem.photoPath!)
                                const blob = await imgRes.blob()
                                const file = new File([blob], 'photo.jpg', { type: blob.type })
                                const fd = new FormData()
                                fd.append('file', file)
                                const res = await fetch('/api/ocr', { method: 'POST', body: fd })
                                const data = await res.json()
                                if (data.rawText) {
                                  setPhotoOcrEdit(data.rawText)
                                } else if (data.error) {
                                  message.warning(data.error)
                                }
                              } catch {
                                message.error('OCR 執行失敗')
                              } finally {
                                setPhotoOcrLoading(false)
                              }
                            }}
                          >
                            對照片執行 OCR
                          </Button>
                          <Input.TextArea
                            rows={4}
                            placeholder="點擊上方按鈕對照片執行 OCR，結果會顯示在這裡，也可手動編輯"
                            value={photoOcrEdit}
                            onChange={e => setPhotoOcrEdit(e.target.value)}
                          />
                          <Button
                            size="small"
                            type="primary"
                            loading={photoOcrSaving}
                            disabled={!photoOcrEdit}
                            onClick={async () => {
                              setPhotoOcrSaving(true)
                              const res = await fetch(`/api/items/${detailItem.id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ photoOcrText: photoOcrEdit }),
                              })
                              setPhotoOcrSaving(false)
                              if (res.ok) {
                                message.success('已儲存')
                                onRefresh()
                              } else {
                                message.error('儲存失敗')
                              }
                            }}
                          >
                            儲存 OCR 文字
                          </Button>
                        </Space>
                      ),
                    }]}
                  />
                )}
              </>
            )}

            {detailItem.ocrRawText && (
              <>
                <Divider style={{ marginBottom: 8 }} />
                <Collapse
                  ghost
                  items={[{
                    key: 'ocr',
                    label: 'OCR 原始文字',
                    children: (
                      <pre style={{
                        background: '#f5f5f5', padding: 12, borderRadius: 8,
                        fontSize: 11, maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap',
                        margin: 0,
                      }}>
                        {detailItem.ocrRawText}
                      </pre>
                    ),
                  }]}
                />
              </>
            )}
          </>
        )}
      </Drawer>
    </>
  )
}

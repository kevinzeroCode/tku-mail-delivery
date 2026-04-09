'use client'
import { memo, useMemo, useState } from 'react'
import {
  Table, Button, Space, Input, Tooltip, Alert, Drawer,
  Descriptions, Divider, Collapse, Image, message, notification, Popconfirm,
} from 'antd'
import {
  BellOutlined, CheckOutlined, RollbackOutlined,
  EditOutlined, DeleteOutlined, EyeOutlined, PictureOutlined, SearchOutlined, UploadOutlined,
} from '@ant-design/icons'
import type { ColumnsType, TableRowSelection, FilterDropdownProps } from 'antd/es/table/interface'
import dayjs from 'dayjs'
import StatusBadge from './StatusBadge'
import { ConfirmActionModal } from './ConfirmActionModal'
import { PickupModal } from './PickupModal'
import { EditMailModal } from './EditMailModal'
import { mailApi } from '@/services/mail'
import type { MailItem } from '@/lib/types'
import type { ConfirmAction } from './ConfirmActionModal'

// ── Pre-computed row type (D6: avoid re-parsing dates in onFilter) ────────────

type ComputedItem = MailItem & {
  _receivedFmt: string   // "MM/DD"
  _deadlineFmt: string   // "MM/DD"
}

// ── Shared fuzzy-search filter dropdown ──────────────────────────────────────

function textFilterDropdown(placeholder: string) {
  return ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: FilterDropdownProps) => (
    <div style={{ padding: 8 }} onKeyDown={e => e.stopPropagation()}>
      <Input
        autoFocus
        placeholder={placeholder}
        value={selectedKeys[0] as string}
        onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
        onPressEnter={() => confirm()}
        style={{ marginBottom: 8, display: 'block' }}
      />
      <Space>
        <Button type="primary" size="small" onClick={() => confirm()}>篩選</Button>
        <Button size="small" onClick={() => { clearFilters?.(); confirm() }}>清除</Button>
      </Space>
    </div>
  )
}

const searchIcon = (filtered: boolean) => (
  <SearchOutlined style={{ color: filtered ? '#1677ff' : undefined }} />
)

const fuzzy = (value: unknown, text: string | null | undefined) =>
  String(text ?? '').toLowerCase().includes(String(value).toLowerCase())

// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  items: MailItem[]
  onRefresh: () => void
}

export default memo(function MailTable({ items, onRefresh }: Props) {
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [batchLoading, setBatchLoading] = useState(false)
  const [pendingAction, setPendingAction] = useState<ConfirmAction | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [pickupItem, setPickupItem] = useState<MailItem | null>(null)
  const [editItem, setEditItem] = useState<MailItem | null>(null)
  const [detailItem, setDetailItem] = useState<MailItem | null>(null)
  const [photoOcrEdit, setPhotoOcrEdit] = useState('')
  const [photoOcrLoading, setPhotoOcrLoading] = useState(false)
  const [photoOcrSaving, setPhotoOcrSaving] = useState(false)

  // D6: pre-compute formatted dates once when data changes, not on every filter call
  const computedItems = useMemo<ComputedItem[]>(() =>
    items.map(item => ({
      ...item,
      _receivedFmt: dayjs(item.receivedDate).format('MM/DD'),
      _deadlineFmt: dayjs(item.receivedDate).add(item.deadlineDays, 'day').format('MM/DD'),
    })),
    [items],
  )

  // ── Row highlight ───────────────────────────────────────────────────────────

  const deadlineStyle = (item: ComputedItem) => {
    if (item.status !== '待領取') return {}
    const deadline = dayjs(item.receivedDate).add(item.deadlineDays, 'day')
    if (dayjs().isAfter(deadline)) return { background: '#fff1f0' }
    if (deadline.diff(dayjs(), 'day') <= 2) return { background: '#fffbe6' }
    return {}
  }

  // ── Confirm action (notify / return / delete) ───────────────────────────────

  const handleConfirmAction = async () => {
    if (!pendingAction) return
    setActionLoading(true)
    try {
      const { type, item } = pendingAction
      if (type === 'notify') {
        await mailApi.notify(item.id)
        message.success('已發送 Teams 通知')
      } else if (type === 'return') {
        await mailApi.put(item.id, { status: '已退回' })
        message.success('已標記為退回')
      } else {
        await mailApi.delete(item.id)
        message.success('已刪除')
      }
      setPendingAction(null)
      onRefresh()
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : '操作失敗')
    } finally {
      setActionLoading(false)
    }
  }

  // ── Batch operations (D4: Promise.allSettled for granular error reporting) ──

  const batchAction = async (action: 'notify' | 'pickup' | 'return' | 'delete') => {
    const selected = items.filter(i => selectedRowKeys.includes(i.id))
    const targets = action === 'notify' ? selected.filter(i => i.status === '待領取') : selected
    if (!targets.length) return

    setBatchLoading(true)
    const results = await Promise.allSettled(targets.map(item => {
      if (action === 'notify') return mailApi.notify(item.id)
      if (action === 'delete') return mailApi.delete(item.id)
      return mailApi.put(item.id, {
        status: action === 'pickup' ? '已領取' : '已退回',
        ...(action === 'pickup' ? { pickupDate: new Date().toISOString() } : {}),
      })
    }))
    setBatchLoading(false)

    const succeeded = results.filter(r => r.status === 'fulfilled').length
    const failed = results.length - succeeded

    if (failed > 0) {
      notification.warning({
        message: '批量操作部分失敗',
        description: `成功 ${succeeded} 筆，失敗 ${failed} 筆，請重新整理後確認。`,
      })
    } else {
      message.success(`全部 ${succeeded} 筆操作成功`)
    }

    setSelectedRowKeys([])
    onRefresh()
  }

  const rowSelection: TableRowSelection<ComputedItem> = {
    selectedRowKeys,
    onChange: keys => setSelectedRowKeys(keys),
    selections: [
      Table.SELECTION_ALL,
      Table.SELECTION_INVERT,
      {
        key: 'pending',
        text: '選取所有待領取',
        onSelect: () => setSelectedRowKeys(items.filter(i => i.status === '待領取').map(i => i.id)),
      },
    ],
  }

  // ── Column definitions ──────────────────────────────────────────────────────

  const columns: ColumnsType<ComputedItem> = [
    {
      title: '追蹤碼',
      dataIndex: 'trackingCode',
      key: 'trackingCode',
      width: 120,
      filterDropdown: textFilterDropdown('搜尋追蹤碼…'),
      filterIcon: searchIcon,
      onFilter: (v, r) => fuzzy(v, r.trackingCode),
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
    {
      title: '類型',
      dataIndex: 'mailType',
      key: 'mailType',
      width: 70,
      filters: [
        { text: '普通', value: '普通' },
        { text: '掛號', value: '掛號' },
        { text: '公文', value: '公文' },
        { text: '包裹', value: '包裹' },
      ],
      onFilter: (v, r) => r.mailType === v,
    },
    {
      title: '到件',
      key: 'receivedDate',
      width: 90,
      render: (_, r) => r._receivedFmt,
      filterDropdown: textFilterDropdown('如：03/15'),
      filterIcon: searchIcon,
      onFilter: (v, r) => fuzzy(v, r._receivedFmt),
    },
    {
      title: '期限',
      key: 'deadline',
      width: 90,
      render: (_, r) => {
        const overdue = r.status === '待領取' &&
          dayjs().isAfter(dayjs(r.receivedDate).add(r.deadlineDays, 'day'))
        return <span style={{ color: overdue ? '#ff4d4f' : undefined }}>{r._deadlineFmt}</span>
      },
      filterDropdown: textFilterDropdown('如：03/20'),
      filterIcon: searchIcon,
      onFilter: (v, r) => fuzzy(v, r._deadlineFmt),
    },
    {
      title: '收件人',
      dataIndex: 'recipientName',
      key: 'recipientName',
      width: 90,
      filterDropdown: textFilterDropdown('搜尋收件人…'),
      filterIcon: searchIcon,
      onFilter: (v, r) => fuzzy(v, r.recipientName),
    },
    {
      title: '狀態',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      filters: [
        { text: '待領取', value: '待領取' },
        { text: '已領取', value: '已領取' },
        { text: '已退回', value: '已退回' },
      ],
      onFilter: (v, r) => r.status === v,
      render: v => <StatusBadge status={v} />,
    },
    {
      title: '領取方式',
      dataIndex: 'pickupMethod',
      key: 'pickupMethod',
      width: 95,
      filters: [
        { text: '自行領取', value: '自行領取' },
        { text: '代收通知', value: '代收通知' },
        { text: '付費寄回', value: '付費寄回' },
        { text: '說明告知', value: '說明告知' },
        { text: '其他', value: '其他' },
        { text: '（未設定）', value: '__null__' },
      ],
      onFilter: (v, r) => v === '__null__' ? !r.pickupMethod : r.pickupMethod === v,
      render: (v: string | null) => v ?? '—',
    },
    {
      title: '領取人',
      dataIndex: 'pickupPerson',
      key: 'pickupPerson',
      width: 80,
      filterDropdown: textFilterDropdown('搜尋領取人…'),
      filterIcon: searchIcon,
      onFilter: (v, r) => fuzzy(v, r.pickupPerson),
    },
    {
      title: '通知',
      key: 'notificationSent',
      width: 60,
      filters: [
        { text: '已通知', value: 'true' },
        { text: '未通知', value: 'false' },
      ],
      onFilter: (v, r) => String(r.notificationSent) === v,
      render: (_, r) => r.notificationSent
        ? <Tooltip title={`${dayjs(r.notificationDate).format('MM/DD')} 已通知`}>
            <BellOutlined style={{ color: '#52c41a' }} />
          </Tooltip>
        : <span style={{ color: '#d9d9d9' }}>—</span>,
    },
    {
      title: '備註',
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: true,
      filterDropdown: textFilterDropdown('搜尋備註…'),
      filterIcon: searchIcon,
      onFilter: (v, r) => fuzzy(v, r.notes),
    },
    {
      title: '操作',
      key: 'actions',
      width: 185,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="詳細 / 圖片預覽">
            <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailItem(record)} />
          </Tooltip>
          <Tooltip title="編輯">
            <Button size="small" icon={<EditOutlined />} onClick={() => setEditItem(record)} />
          </Tooltip>
          {record.status === '待領取' && (
            <>
              <Tooltip title="發送通知">
                <Button size="small" icon={<BellOutlined />}
                  onClick={() => setPendingAction({ type: 'notify', item: record })} />
              </Tooltip>
              <Tooltip title="已領取（填寫後確認）">
                <Button size="small" type="primary" icon={<CheckOutlined />}
                  onClick={() => setPickupItem(record)} />
              </Tooltip>
              <Tooltip title="退回">
                <Button size="small" danger icon={<RollbackOutlined />}
                  onClick={() => setPendingAction({ type: 'return', item: record })} />
              </Tooltip>
            </>
          )}
          <Tooltip title="刪除">
            <Button size="small" danger icon={<DeleteOutlined />}
              onClick={() => setPendingAction({ type: 'delete', item: record })} />
          </Tooltip>
        </Space>
      ),
    },
  ]

  // ── Render ──────────────────────────────────────────────────────────────────

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
                onClick={() => batchAction('notify')}>批量通知（待領取）</Button>
              <Button size="small" type="primary" icon={<CheckOutlined />} loading={batchLoading}
                onClick={() => batchAction('pickup')}>批量已領取</Button>
              <Button size="small" icon={<RollbackOutlined />} loading={batchLoading}
                onClick={() => batchAction('return')}>批量已退回</Button>
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

      <Table
        dataSource={computedItems}
        columns={columns}
        rowKey="id"
        size="small"
        rowSelection={rowSelection}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: t => `共 ${t} 筆` }}
        onRow={record => ({ style: deadlineStyle(record) })}
        scroll={{ x: 1150 }}
      />

      {/* ── Modals ────────────────────────────────────────────────────── */}

      <ConfirmActionModal
        action={pendingAction}
        loading={actionLoading}
        onConfirm={handleConfirmAction}
        onCancel={() => setPendingAction(null)}
      />

      <PickupModal
        item={pickupItem}
        onSaved={() => { setPickupItem(null); onRefresh() }}
        onCancel={() => setPickupItem(null)}
      />

      <EditMailModal
        item={editItem}
        onSaved={() => { setEditItem(null); onRefresh() }}
        onCancel={() => setEditItem(null)}
      />

      {/* ── Detail Drawer ─────────────────────────────────────────────── */}
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
                        <Image src={detailItem.photoPath} width={200} height={160}
                          style={{ objectFit: 'cover', borderRadius: 8, cursor: 'pointer' }}
                          alt="貨物照片" />
                        <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>貨物照片</div>
                      </div>
                    )}
                    {detailItem.listImagePath && (
                      <div style={{ textAlign: 'center' }}>
                        <Image src={detailItem.listImagePath} width={200} height={160}
                          style={{ objectFit: 'cover', borderRadius: 8, cursor: 'pointer' }}
                          alt="簽收清單" />
                        <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>簽收清單</div>
                      </div>
                    )}
                  </Space>
                </Image.PreviewGroup>
                {detailItem.photoPath && (
                  <Collapse ghost style={{ marginTop: 8 }} items={[{
                    key: 'photo-ocr',
                    label: '貨物照片 OCR 文字',
                    children: (
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <Button size="small" loading={photoOcrLoading}
                          onClick={async () => {
                            setPhotoOcrLoading(true)
                            try {
                              const imgRes = await fetch(detailItem.photoPath!)
                              const blob = await imgRes.blob()
                              const file = new File([blob], 'photo.jpg', { type: blob.type })
                              const text = await mailApi.ocr(file)
                              if (text) setPhotoOcrEdit(text)
                              else message.warning('OCR 無法辨識')
                            } catch { message.error('OCR 執行失敗') }
                            finally { setPhotoOcrLoading(false) }
                          }}>
                          對照片執行 OCR
                        </Button>
                        <Input.TextArea rows={4}
                          placeholder="點擊上方按鈕對照片執行 OCR，結果會顯示在這裡，也可手動編輯"
                          value={photoOcrEdit}
                          onChange={e => setPhotoOcrEdit(e.target.value)} />
                        <Button size="small" type="primary" loading={photoOcrSaving}
                          disabled={!photoOcrEdit}
                          onClick={async () => {
                            setPhotoOcrSaving(true)
                            try {
                              await mailApi.put(detailItem.id, { photoOcrText: photoOcrEdit })
                              message.success('已儲存')
                              onRefresh()
                            } catch (e: unknown) {
                              message.error(e instanceof Error ? e.message : '儲存失敗')
                            } finally {
                              setPhotoOcrSaving(false)
                            }
                          }}>
                          儲存 OCR 文字
                        </Button>
                      </Space>
                    ),
                  }]} />
                )}
              </>
            )}

            {detailItem.ocrRawText && (
              <>
                <Divider style={{ marginBottom: 8 }} />
                <Collapse ghost items={[{
                  key: 'ocr',
                  label: 'OCR 原始文字',
                  children: (
                    <pre style={{
                      background: '#f5f5f5', padding: 12, borderRadius: 8, fontSize: 11,
                      maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap', margin: 0,
                    }}>
                      {detailItem.ocrRawText}
                    </pre>
                  ),
                }]} />
              </>
            )}
          </>
        )}
      </Drawer>
    </>
  )
})

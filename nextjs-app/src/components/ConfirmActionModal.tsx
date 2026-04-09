'use client'
import { memo } from 'react'
import { Modal, Descriptions } from 'antd'
import StatusBadge from './StatusBadge'
import type { MailItem } from '@/lib/types'

export type ConfirmActionType = 'notify' | 'return' | 'delete'
export type ConfirmAction = { type: ConfirmActionType; item: MailItem }

const CONFIG: Record<ConfirmActionType, {
  title: string
  okText: string
  danger: boolean
  description: (item: MailItem) => string
}> = {
  notify: {
    title: '確認發送通知',
    okText: '發送通知',
    danger: false,
    description: item => `確定要發送 Teams 通知給「${item.recipientName ?? '（未知）'}」？`,
  },
  return: {
    title: '確認退回郵件',
    okText: '確定退回',
    danger: true,
    description: () => '確定將此郵件標記為「已退回」？',
  },
  delete: {
    title: '確認刪除郵件',
    okText: '刪除',
    danger: true,
    description: () => '確定要刪除此筆郵件？此操作無法復原。',
  },
}

interface Props {
  action: ConfirmAction | null
  loading: boolean
  onConfirm: () => void
  onCancel: () => void
}

export const ConfirmActionModal = memo(function ConfirmActionModal({ action, loading, onConfirm, onCancel }: Props) {
  const cfg = action ? CONFIG[action.type] : null

  return (
    <Modal
      title={cfg?.title}
      open={!!action}
      onOk={onConfirm}
      onCancel={onCancel}
      okText={cfg?.okText}
      cancelText="取消"
      okButtonProps={{ danger: cfg?.danger, loading }}
      destroyOnClose
    >
      {action && (
        <>
          <Descriptions column={1} size="small" bordered style={{ marginBottom: 12 }}>
            <Descriptions.Item label="追蹤碼">
              <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                {action.item.trackingCode}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="類型">{action.item.mailType}</Descriptions.Item>
            <Descriptions.Item label="收件人">{action.item.recipientName ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="狀態">
              <StatusBadge status={action.item.status} />
            </Descriptions.Item>
            {action.item.notes && (
              <Descriptions.Item label="備註">{action.item.notes}</Descriptions.Item>
            )}
          </Descriptions>
          <p style={{ margin: 0 }}>{cfg?.description(action.item)}</p>
        </>
      )}
    </Modal>
  )
})

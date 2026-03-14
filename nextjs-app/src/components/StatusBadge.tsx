'use client'
import { Tag } from 'antd'

const colorMap: Record<string, string> = {
  '待領取': 'orange',
  '已領取': 'green',
  '已退回': 'red',
}

export default function StatusBadge({ status }: { status: string }) {
  return <Tag color={colorMap[status] ?? 'default'}>{status}</Tag>
}

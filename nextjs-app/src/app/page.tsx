'use client'
import { useState } from 'react'
import {
  Layout, Card, Input, Button, Result, Descriptions, Tag,
  Typography, Space, Alert,
} from 'antd'
import { SearchOutlined, MailOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import StatusBadge from '@/components/StatusBadge'
import type { MailItem } from '@/lib/types'

const { Header, Content } = Layout
const { Title, Text } = Typography

type QueryItem = Pick<MailItem,
  'id' | 'trackingCode' | 'mailType' | 'receivedDate' | 'status' |
  'notificationSent' | 'notificationDate' | 'deadlineDays' | 'pickupDate' | 'returnDate' | 'notes'>

export default function QueryPage() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<QueryItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = async () => {
    if (!code.trim()) return
    setLoading(true)
    setError(null)
    setResults(null)

    try {
      const res = await fetch(`/api/query?code=${encodeURIComponent(code.trim())}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResults(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : '查詢失敗')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#1677ff', display: 'flex', alignItems: 'center', gap: 12 }}>
        <MailOutlined style={{ color: '#fff', fontSize: 24 }} />
        <Title level={4} style={{ color: '#fff', margin: 0, flex: 1 }}>郵件收發查詢系統</Title>
        <Button type="text" style={{ color: '#fff' }} href="/portal">用戶自助服務</Button>
        <Button type="text" style={{ color: '#fff' }} href="/admin">管理後台</Button>
      </Header>

      <Content style={{ padding: '40px 24px', maxWidth: 640, margin: '0 auto', width: '100%' }}>
        <Card>
          <Title level={5} style={{ marginTop: 0 }}>查詢郵件狀態</Title>
          <Text type="secondary">
            請輸入郵件追蹤碼（簽收清單上的前 6-8 碼數字）。
            僅顯示未領取及三個月以內已完成郵件。
          </Text>

          <Space.Compact style={{ width: '100%', marginTop: 16 }}>
            <Input
              size="large"
              placeholder="例如：964044"
              value={code}
              onChange={e => setCode(e.target.value)}
              onPressEnter={handleSearch}
              maxLength={12}
            />
            <Button size="large" type="primary" icon={<SearchOutlined />}
              loading={loading} onClick={handleSearch}>
              查詢
            </Button>
          </Space.Compact>
        </Card>

        {error && (
          <Alert type="warning" message={error} style={{ marginTop: 16 }} showIcon />
        )}

        {results && results.map(item => {
          const deadline = dayjs(item.receivedDate).add(item.deadlineDays, 'day')
          const isOverdue = item.status === '待領取' && dayjs().isAfter(deadline)

          return (
            <Card key={item.id} style={{ marginTop: 16 }}>
              {isOverdue && (
                <Alert type="error" message="⚠️ 已超過領取期限，請盡速聯絡收發室" style={{ marginBottom: 12 }} />
              )}
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="追蹤碼">{item.trackingCode}</Descriptions.Item>
                <Descriptions.Item label="郵件類型">{item.mailType}</Descriptions.Item>
                <Descriptions.Item label="到件日期">
                  {dayjs(item.receivedDate).format('YYYY 年 MM 月 DD 日')}
                </Descriptions.Item>
                <Descriptions.Item label="領取期限">
                  {deadline.format('YYYY 年 MM 月 DD 日')}
                  {isOverdue && <Tag color="red" style={{ marginLeft: 8 }}>已逾期</Tag>}
                </Descriptions.Item>
                <Descriptions.Item label="狀態"><StatusBadge status={item.status} /></Descriptions.Item>
                {item.status === '已領取' && item.pickupDate && (
                  <Descriptions.Item label="領取日期時間">
                    {dayjs(item.pickupDate).format('YYYY 年 MM 月 DD 日 HH:mm')}
                  </Descriptions.Item>
                )}
                {item.status === '已退回' && item.returnDate && (
                  <Descriptions.Item label="退回日期時間">
                    {dayjs(item.returnDate).format('YYYY 年 MM 月 DD 日 HH:mm')}
                  </Descriptions.Item>
                )}
                {item.notes && (
                  <Descriptions.Item label="備註">{item.notes}</Descriptions.Item>
                )}
              </Descriptions>
            </Card>
          )
        })}

        {results && results.length === 0 && (
          <Result status="404" title="查無資料" subTitle="請確認追蹤碼是否正確" />
        )}
      </Content>
    </Layout>
  )
}

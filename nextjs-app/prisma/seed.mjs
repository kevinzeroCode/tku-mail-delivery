// 測試資料種子腳本 — 執行：node prisma/seed.mjs
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const now = new Date()
const daysAgo = (d) => new Date(now - d * 86400000)
const daysLater = (d) => new Date(now.getTime() + d * 86400000)

async function main() {
  // 清空現有測試資料（保留 AdminUser 和 Setting）
  await prisma.mailRequest.deleteMany()
  await prisma.mailItem.deleteMany()

  // 確保 Setting 存在
  await prisma.setting.upsert({
    where: { key: 'deadlineDays' },
    update: {},
    create: { key: 'deadlineDays', value: '7' },
  })

  const items = await prisma.mailItem.createManyAndReturn({ data: [
    // ── 待領取：正常範圍內 ───────────────────────────────────────
    {
      trackingCode: '2350210',
      mailType: '掛號',
      receivedDate: daysAgo(1),
      recipientName: '王小明',
      recipientEmail: '410410001@o365.tku.edu.tw',
      deadlineDays: 7,
      notificationSent: true,
      notificationDate: daysAgo(1),
      status: '待領取',
      scanStatus: '已掃描',
      notes: '已發通知，等待來取',
    },
    {
      trackingCode: '2350211',
      mailType: '包裹',
      receivedDate: daysAgo(2),
      recipientName: '李小花',
      foreignName: 'Hsiao-Hua Li',
      recipientEmail: '410410002@o365.tku.edu.tw',
      deadlineDays: 7,
      notificationSent: false,
      status: '待領取',
      scanStatus: '已掃描',
      notes: '包裹較大，放置架位 B-3',
    },
    {
      trackingCode: '2350212',
      mailType: '公文',
      receivedDate: daysAgo(0),
      recipientName: '張教授',
      deadlineDays: 14,
      notificationSent: true,
      notificationDate: daysAgo(0),
      status: '待領取',
      scanStatus: '未掃描',
    },
    {
      trackingCode: '2350213',
      mailType: '普通',
      receivedDate: daysAgo(3),
      recipientName: '陳大偉',
      recipientEmail: '410410003@o365.tku.edu.tw',
      deadlineDays: 7,
      notificationSent: false,
      status: '待領取',
      scanStatus: '未掃描',
    },
    // ── 待領取：即將逾期（黃底預警，< 2 天剩餘）──────────────────
    {
      trackingCode: '2350220',
      mailType: '掛號',
      receivedDate: daysAgo(6),
      recipientName: '林雅婷',
      recipientEmail: '410410004@o365.tku.edu.tw',
      deadlineDays: 7,
      notificationSent: true,
      notificationDate: daysAgo(6),
      status: '待領取',
      scanStatus: '未掃描',
      notes: '即將逾期，請儘快聯繫',
    },
    // ── 待領取：已逾期（紅底）────────────────────────────────────
    {
      trackingCode: '2350230',
      mailType: '掛號',
      receivedDate: daysAgo(10),
      recipientName: '黃志豪',
      recipientEmail: '410410005@o365.tku.edu.tw',
      deadlineDays: 7,
      notificationSent: true,
      notificationDate: daysAgo(10),
      status: '待領取',
      scanStatus: '異常',
      notes: '已逾期 3 天，嘗試聯繫無回應',
    },
    {
      trackingCode: '2350231',
      mailType: '包裹',
      receivedDate: daysAgo(14),
      recipientName: '吳美玲',
      deadlineDays: 7,
      notificationSent: true,
      notificationDate: daysAgo(14),
      status: '待領取',
      scanStatus: '未掃描',
    },
    // ── 已領取 ───────────────────────────────────────────────────
    {
      trackingCode: '2350240',
      mailType: '掛號',
      receivedDate: daysAgo(5),
      recipientName: '王小明',
      recipientEmail: '410410001@o365.tku.edu.tw',
      deadlineDays: 7,
      notificationSent: true,
      notificationDate: daysAgo(5),
      pickupMethod: '自行領取',
      pickupPerson: '王小明',
      pickupDate: daysAgo(2),
      status: '已領取',
      scanStatus: '已掃描',
    },
    {
      trackingCode: '2350241',
      mailType: '公文',
      receivedDate: daysAgo(8),
      recipientName: '劉所長',
      deadlineDays: 14,
      notificationSent: true,
      notificationDate: daysAgo(8),
      pickupMethod: '代收通知',
      pickupPerson: '劉秘書',
      pickupDate: daysAgo(3),
      status: '已領取',
      scanStatus: '已掃描',
      notes: '由秘書代收',
    },
    {
      trackingCode: '2350242',
      mailType: '普通',
      receivedDate: daysAgo(20),
      recipientName: '鄭同學',
      deadlineDays: 7,
      notificationSent: true,
      pickupMethod: '自行領取',
      pickupPerson: '鄭同學',
      pickupDate: daysAgo(15),
      status: '已領取',
      scanStatus: '已掃描',
    },
    // ── 已退回 ───────────────────────────────────────────────────
    {
      trackingCode: '2350250',
      mailType: '掛號',
      receivedDate: daysAgo(30),
      recipientName: '未知收件人',
      deadlineDays: 7,
      notificationSent: false,
      returnDate: daysAgo(22),
      status: '已退回',
      scanStatus: '未掃描',
      notes: '查無此人，退回寄件人',
    },
    {
      trackingCode: '2350251',
      mailType: '包裹',
      receivedDate: daysAgo(15),
      recipientName: '周同學',
      recipientEmail: '410410006@o365.tku.edu.tw',
      deadlineDays: 7,
      notificationSent: true,
      notificationDate: daysAgo(15),
      returnDate: daysAgo(7),
      status: '已退回',
      scanStatus: '未掃描',
      notes: '已出國，申請退回',
    },
  ]})

  // 建立幾筆 MailRequest（用戶申請）
  const [item0, item1, item2] = items

  await prisma.mailRequest.createMany({ data: [
    {
      mailItemId: item0.id,
      userEmail: '410410001@o365.tku.edu.tw',
      type: 'pickup_signed',
      requestData: JSON.stringify({ note: '今天下午三點後來取' }),
      status: '待處理',
    },
    {
      mailItemId: item1.id,
      userEmail: '410410002@o365.tku.edu.tw',
      type: 'reject_return',
      requestData: JSON.stringify({ reason: '訂錯商品，請直接退回' }),
      status: '待處理',
    },
    {
      mailItemId: item2.id,
      userEmail: '410410003@o365.tku.edu.tw',
      type: 'change_pickup',
      requestData: JSON.stringify({ newMethod: '付費寄回', address: '台北市大安區羅斯福路 123 號' }),
      status: '已核准',
      adminNote: '已安排寄回',
    },
  ]})

  const mailCount = await prisma.mailItem.count()
  const reqCount = await prisma.mailRequest.count()
  console.log(`✅ 種子完成：${mailCount} 筆郵件，${reqCount} 筆申請`)
  console.log('   待領取（正常）：4 筆')
  console.log('   待領取（即將逾期）：1 筆')
  console.log('   待領取（已逾期）：2 筆')
  console.log('   已領取：3 筆')
  console.log('   已退回：2 筆')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())

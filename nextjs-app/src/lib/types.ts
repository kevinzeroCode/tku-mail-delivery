export type MailStatus = '待領取' | '已領取' | '已退回'
export type MailType = '普通' | '掛號' | '公文' | '包裹'

export interface MailItem {
  id: number
  trackingCode: string
  mailType: MailType
  receivedDate: string
  photoPath: string | null
  listImagePath: string | null
  ocrRawText: string | null
  photoOcrText: string | null
  recipientName: string | null
  recipientEmail: string | null
  notificationSent: boolean
  notificationDate: string | null
  deadlineDays: number
  pickupMethod: string | null
  pickupPerson: string | null
  pickupDate: string | null
  status: MailStatus
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface OcrResult {
  trackingCodes: string[]
  rawText: string
}

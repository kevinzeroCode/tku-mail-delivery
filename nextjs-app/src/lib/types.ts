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
  returnDate: string | null
  status: MailStatus
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type MailRequestType = 'reject_return' | 'change_pickup' | 'wrong_recipient' | 'pickup_signed'
export type MailRequestStatus = '待處理' | '已核准' | '已拒絕'

export interface UserProfile {
  id: number | null
  email: string
  name: string | null
  studentId: string | null
  defaultPickup: string | null
  notifyEmail: string | null
  schoolStatus: string | null
  notes: string | null
}

export interface MailRequest {
  id: number
  mailItemId: number
  userEmail: string
  type: MailRequestType
  requestData: string | null
  status: MailRequestStatus
  adminNote: string | null
  createdAt: string
  updatedAt: string
  mailItem?: { trackingCode: string; mailType: string; recipientName: string | null; status: string }
}

export interface OcrResult {
  trackingCodes: string[]
  rawText: string
}

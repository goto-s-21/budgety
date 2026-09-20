export interface ParsedTransaction {
  date: string | null
  time: string | null
  merchant: string | null
  amount: number | null
  paymentMethod: string
  source: 'gmail'
  sourceId: string
}

export interface GmailMessage {
  id: string
  from: string
  subject: string
  body: string
  internalDate: string
}

export interface PaymentNotificationParser {
  serviceName: string
  canParse(message: GmailMessage): boolean
  parse(message: GmailMessage): ParsedTransaction | null
}
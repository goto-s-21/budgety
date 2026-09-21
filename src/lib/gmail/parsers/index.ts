import type { GmailMessage, ParsedTransaction, PaymentNotificationParser } from '../types'
import { SmbcUsageNoticeParser } from './smbcUsageNotice'
import { SmbcCardParser } from './smbc'
import { RakutenPayParser } from './rakutenPay'
import { PaypayCardParser } from './paypayCard'
import { MercariParser } from './mercari'

export const PARSERS: PaymentNotificationParser[] = [
  SmbcUsageNoticeParser,
  SmbcCardParser,
  RakutenPayParser,
  PaypayCardParser,
  MercariParser,
]

export function parseMessage(message: GmailMessage): ParsedTransaction | null {
  for (const parser of PARSERS) {
    if (parser.canParse(message)) {
      return parser.parse(message)
    }
  }
  return null
}

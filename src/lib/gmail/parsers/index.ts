// src/lib/gmail/parsers/index.ts
// 各パーサーをcanParseで順に試し、最初にマッチしたものでparseするディスパッチャ。
// 新しいサービスに対応する場合はここにパーサーを追加するだけでよい。

import type { GmailMessage, ParsedTransaction, PaymentNotificationParser } from '../types'
import { SmbcCardParser } from './smbc'
import { RakutenPayParser } from './rakutenPay'
import { PaypayCardParser } from './paypayCard'

export const PARSERS: PaymentNotificationParser[] = [
  SmbcCardParser,
  RakutenPayParser,
  PaypayCardParser,
]

export function parseMessage(message: GmailMessage): ParsedTransaction | null {
  for (const parser of PARSERS) {
    if (parser.canParse(message)) {
      return parser.parse(message)
    }
  }
  return null
}

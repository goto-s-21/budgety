import type { PaymentNotificationParser } from '../types'
import { SmbcCardParser } from './smbc'
import { RakutenPayParser } from './rakutenpay'
import { PayPayCardParser } from './paypayCard'
import { MercariParser } from './mercari'

export const PARSERS: PaymentNotificationParser[] = [
  SmbcCardParser,
  RakutenPayParser,
  PayPayCardParser,
  MercariParser,
]

export function findParser(message: { from: string }): PaymentNotificationParser | null {
  return PARSERS.find((p) => p.canParse(message as any)) || null
}
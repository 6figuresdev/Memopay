export type TxStatus = 'pending' | 'completed' | 'failed' | 'processing'
export type TxDirection = 'sent' | 'received'

export interface Transaction {
  id: string
  direction: TxDirection
  status: TxStatus
  amount: number // USDC
  from: string
  to: string
  memo: string
  hash: string
  createdAt: string // ISO
  confirmedAt?: string
  chain: string
  fee: number
}

export type RequestStatus = 'pending' | 'paid' | 'expired' | 'cancelled'

export interface PaymentRequest {
  id: string
  title: string
  description: string
  amount: number
  currency: 'USDC'
  from: string
  to: string
  status: RequestStatus
  createdAt: string
  expiresAt: string
  paidAt?: string
  txId?: string
  memo: string
}

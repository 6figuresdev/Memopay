import { useState, useCallback, useEffect } from 'react'
import type { PaymentRequest } from './types'

const STORAGE_KEY = 'memopay_requests_v1'

function loadReqs(): PaymentRequest[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PaymentRequest[]) : []
  } catch {
    return []
  }
}

function saveReqs(reqs: PaymentRequest[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reqs))
}

export function usePaymentRequests() {
  const [reqs, setReqs] = useState<PaymentRequest[]>(loadReqs)

  // Persist on every change
  useEffect(() => { saveReqs(reqs) }, [reqs])

  const addRequest = useCallback(
    (data: Omit<PaymentRequest, 'id' | 'status' | 'createdAt' | 'paidAt' | 'txId'>) => {
      const req: PaymentRequest = {
        ...data,
        id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        status: 'pending',
        createdAt: new Date().toISOString(),
      }
      setReqs((prev) => [req, ...prev])
    },
    [],
  )

  const cancelRequest = useCallback((id: string) => {
    setReqs((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'cancelled' as const } : r)))
  }, [])

  const updateRequestStatus = useCallback(
    (id: string, status: PaymentRequest['status'], txId?: string) => {
      setReqs((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, status, paidAt: status === 'paid' ? new Date().toISOString() : r.paidAt, txId: txId ?? r.txId }
            : r,
        ),
      )
    },
    [],
  )

  return { reqs, addRequest, cancelRequest, updateRequestStatus }
}

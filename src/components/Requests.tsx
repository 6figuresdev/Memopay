import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, Link, X, CheckCircle2, Loader2, ExternalLink, FileText } from 'lucide-react'
import { isAddress, type Address } from 'viem'
import { toast } from 'sonner'
import StatusBadge from '@/components/ui/StatusBadge'
import type { PaymentRequest } from '@/data/types'
import { useSendUsdc } from '@/hooks/useSendUsdc'
import { buildShareLink } from '@/lib/share'

const card: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '12px',
  boxShadow: 'var(--shadow-sm)',
}

const sheetSpring = { type: 'spring', stiffness: 400, damping: 42 } as const

function PayButton({ req, onPaid }: { req: PaymentRequest; onPaid: (id: string, txHash: string) => void }) {
  const { send, hash, isPending, isConfirming, isSuccess, wrongChain, isSwitching } = useSendUsdc()
  const disabled = isPending || isConfirming || req.status !== 'pending'

  useEffect(() => {
    if (!isSuccess || !hash) return
    toast.success(`Paid ${req.amount} USDC`)
    onPaid(req.id, hash)
  }, [isSuccess, hash]) // eslint-disable-line react-hooks/exhaustive-deps

  const label = (() => {
    if (wrongChain || isSwitching) return 'Switch network'
    if (isPending)    return <span className="flex items-center gap-1.5"><Loader2 className="size-3.5 animate-spin" />Confirm…</span>
    if (isConfirming) return <span className="flex items-center gap-1.5"><Loader2 className="size-3.5 animate-spin" />Confirming…</span>
    if (isSuccess)    return <span className="flex items-center gap-1.5"><CheckCircle2 className="size-3.5" />Paid!</span>
    return `Pay ${req.amount} USDC`
  })()

  return (
    <button
      disabled={disabled}
      onClick={() => send(req.from as Address, String(req.amount))}
      className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
      style={{ background: isSuccess ? 'var(--success)' : 'var(--accent)' }}
      data-testid={`pay-btn-${req.id}`}
    >
      {label}
    </button>
  )
}

function CreateForm({
  myAddress, onSubmit, onClose,
}: {
  myAddress: string
  onSubmit: (data: Omit<PaymentRequest, 'id' | 'status' | 'createdAt' | 'paidAt' | 'txId'>) => void
  onClose: () => void
}) {
  const [title,  setTitle]  = useState('')
  const [desc,   setDesc]   = useState('')
  const [amount, setAmount] = useState('')
  const [payer,  setPayer]  = useState('')
  const [days,   setDays]   = useState('7')

  const isValidAmt   = /^\d+(\.\d{1,6})?$/.test(amount) && parseFloat(amount) > 0
  const isValidPayer = payer === '' || isAddress(payer)
  const canCreate    = title.trim() && isValidAmt && isValidPayer

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canCreate) return
    const expiresAt = new Date(Date.now() + parseInt(days) * 86400_000).toISOString()
    onSubmit({ title: title.trim(), description: desc.trim(), amount: parseFloat(amount), currency: 'USDC', from: myAddress, to: payer || '', expiresAt, memo: desc.trim() })
    onClose()
  }

  const fieldStyle = (invalid?: boolean): React.CSSProperties => ({
    background: 'var(--surface-muted)',
    border: `1px solid ${invalid ? 'var(--danger)' : 'var(--border)'}`,
    color: 'var(--ink)',
    borderRadius: '8px',
    padding: '10px 12px',
    fontSize: '14px',
    outline: 'none',
    width: '100%',
  })

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end justify-center"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={{ background: 'rgba(0,0,0,0.40)' }}
        onClick={onClose}
      >
        <motion.section
          className="relative w-full max-w-md overflow-hidden rounded-t-2xl"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderBottom: 'none', boxShadow: '0 -4px 24px rgba(0,0,0,0.12)' }}
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          transition={sheetSpring}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mx-auto mt-3 h-1 w-10 rounded-full" style={{ background: 'var(--border-strong)' }} />
          <form onSubmit={handleSubmit} className="space-y-4 px-6 pb-8 pt-5">
            <div className="flex items-center justify-between">
              <h2 className="display text-lg font-bold" style={{ color: 'var(--ink)' }}>New Request</h2>
              <button type="button" onClick={onClose} className="rounded-lg p-1.5"
                style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
                <X className="size-4" />
              </button>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Title *</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Invoice #123" data-testid="req-title" style={fieldStyle()} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Description</label>
              <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Optional note" data-testid="req-desc" style={fieldStyle()} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Amount (USDC) *</label>
                <input
                  inputMode="decimal" value={amount}
                  onChange={(e) => { const v = e.target.value.replace(/[^0-9.]/g, ''); if (v === '' || /^\d*\.?\d*$/.test(v)) setAmount(v) }}
                  placeholder="0.00" data-testid="req-amount" style={fieldStyle(amount !== '' && !isValidAmt)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Expires in</label>
                <select value={days} onChange={(e) => setDays(e.target.value)} data-testid="req-expires" style={fieldStyle()}>
                  {['1', '3', '7', '14', '30'].map((d) => <option key={d} value={d}>{d} day{d !== '1' ? 's' : ''}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Payer address (optional)</label>
              <input
                value={payer} onChange={(e) => setPayer(e.target.value.trim())} placeholder="0x… or leave blank for anyone"
                data-testid="req-payer" className="mono" style={fieldStyle(payer !== '' && !isValidPayer)} spellCheck={false}
              />
            </div>

            <button
              type="submit" disabled={!canCreate} data-testid="req-submit"
              className="w-full rounded-xl py-3.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: 'var(--accent)' }}
            >
              Create Request
            </button>
          </form>
        </motion.section>
      </motion.div>
    </AnimatePresence>
  )
}

function ReqCard({ req, address, onCancel, onMarkPaid, onRefreshTx }: {
  req: PaymentRequest; address: string
  onCancel: (id: string) => void
  onMarkPaid: (id: string, status: PaymentRequest['status'], txId?: string) => void
  onRefreshTx: () => void
}) {
  const copyLink = async () => {
    const link = await buildShareLink(`?to=${req.from}&amount=${req.amount}&memo=${encodeURIComponent(req.title)}`)
    void navigator.clipboard.writeText(link)
    toast.success('Payment link copied')
  }
  const isOwn = req.from.toLowerCase() === address.toLowerCase()

  return (
    <li className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }} data-testid="request-row">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold" style={{ color: 'var(--ink)' }}>{req.title}</p>
          {req.description && <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--subtle)' }}>{req.description}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={req.status} />
            <span className="text-xs" style={{ color: 'var(--subtle)' }}>
              Expires {new Date(req.expiresAt).toLocaleDateString()}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="display tabular-nums text-base font-bold" style={{ color: 'var(--ink)' }}>{req.amount}</p>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>USDC</span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => { void copyLink() }}
          data-testid={`copy-link-${req.id}`}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold"
          style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink-2)' }}
        >
          <Link className="size-3.5" /> Copy link
        </button>
        {!isOwn && <PayButton req={req} onPaid={(id, hash) => { onMarkPaid(id, 'paid', hash); onRefreshTx() }} />}
        {isOwn && req.status === 'pending' && (
          <button
            onClick={() => onCancel(req.id)}
            data-testid={`cancel-req-${req.id}`}
            className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold"
            style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger-border)' }}
          >
            <X className="size-3.5" /> Cancel
          </button>
        )}
      </div>
    </li>
  )
}

interface Props {
  reqs: PaymentRequest[]
  address: string
  onAdd: (data: Omit<PaymentRequest, 'id' | 'status' | 'createdAt' | 'paidAt' | 'txId'>) => void
  onCancel: (id: string) => void
  onMarkPaid: (id: string, status: PaymentRequest['status'], txId?: string) => void
  onRefreshTx: () => void
}

export default function Requests({ reqs, address, onAdd, onCancel, onMarkPaid, onRefreshTx }: Props) {
  const [showForm, setShowForm] = useState(false)
  const pending  = reqs.filter((r) => r.status === 'pending')
  const resolved = reqs.filter((r) => r.status !== 'pending')

  return (
    <div className="space-y-5" data-testid="requests-page">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="display text-2xl font-bold" style={{ color: 'var(--ink)', letterSpacing: '-0.025em' }}>
            Payment Requests
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            Create requests and share payment links.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          data-testid="new-request-btn"
          className="flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold text-white"
          style={{ background: 'var(--violet)' }}
        >
          <Plus className="size-4" /> New Request
        </button>
      </div>

      {pending.length > 0 && (
        <div style={card} className="overflow-hidden">
          <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-muted)' }}>
            <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
              Open · {pending.length}
            </h2>
          </div>
          <ul>{pending.map((req) => (
            <ReqCard key={req.id} req={req} address={address} onCancel={onCancel} onMarkPaid={onMarkPaid} onRefreshTx={onRefreshTx} />
          ))}</ul>
        </div>
      )}

      {resolved.length > 0 && (
        <div style={card} className="overflow-hidden">
          <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-muted)' }}>
            <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
              History · {resolved.length}
            </h2>
          </div>
          <ul>
            {resolved.map((req) => (
              <li key={req.id} className="flex items-center justify-between px-5 py-3.5"
                style={{ borderBottom: '1px solid var(--border)' }} data-testid="request-row-resolved">
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{req.title}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <StatusBadge status={req.status} />
                    {req.txId && (
                      <a href={`https://explorer.testnet.arc.io/tx/${req.txId}`} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-0.5 text-xs" style={{ color: 'var(--subtle)' }}>
                        Tx <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>
                </div>
                <p className="display tabular-nums text-sm font-bold" style={{ color: 'var(--muted)' }}>
                  {req.amount} USDC
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {reqs.length === 0 && (
        <div style={card} className="py-16 text-center">
          <FileText className="mx-auto mb-3 size-8" style={{ color: 'var(--border-strong)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>No requests yet</p>
          <p className="mt-1 text-xs" style={{ color: 'var(--subtle)' }}>Create one and share the payment link.</p>
        </div>
      )}

      {showForm && <CreateForm myAddress={address} onSubmit={onAdd} onClose={() => setShowForm(false)} />}
    </div>
  )
}

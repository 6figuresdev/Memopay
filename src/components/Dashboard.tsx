import { useMemo, useState, useEffect } from 'react'
import {
  ArrowUpRight, ArrowDownLeft, Clock, Loader2, Send, QrCode,
  ExternalLink, Copy, Check, Activity,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { TokenUSDC } from '@web3icons/react'
import { isAddress, type Address } from 'viem'
import { toast } from 'sonner'
import { Amount, usdcDecimalsFor } from '@/onchain-money'
import type { LiveTransfer } from '@/hooks/useUsdcTransfers'
import type { PaymentRequest } from '@/data/types'
import type { Page } from './types'
import { useSendUsdc } from '@/hooks/useSendUsdc'
import { buildShareLink } from '@/lib/share'

const ARC_TESTNET_ID = 5042002
const USDC_DEC = usdcDecimalsFor(ARC_TESTNET_ID)

function fmtUsdc(raw: bigint) { return Amount.fromRaw(raw, USDC_DEC).toFixed(2) }
function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n)
}
function shortenAddr(addr: string) { return `${addr.slice(0, 6)}…${addr.slice(-4)}` }

// Opaque solid card
const card: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '12px',
  boxShadow: 'var(--shadow-sm)',
}

// The only animation left: bottom sheet slide-in (real UX)
const sheetSpring = { type: 'spring', stiffness: 400, damping: 42 } as const

function Sheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
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
          {/* Top handle */}
          <div className="mx-auto mt-3 h-1 w-10 rounded-full" style={{ background: 'var(--border-strong)' }} />
          {children}
        </motion.section>
      </motion.div>
    </AnimatePresence>
  )
}

// ─── Send Sheet ───────────────────────────────────────────────────────────────
function QuickSend({ onClose, onSent }: { onClose: () => void; onSent: () => void }) {
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const { send, isPending, isConfirming, isSuccess, isSwitching, wrongChain, reset, writeError } = useSendUsdc()

  const isValidAddr = isAddress(to)
  const isValidAmt = /^\d+(\.\d{1,6})?$/.test(amount) && parseFloat(amount) > 0
  const canSend = isValidAddr && isValidAmt && !isPending && !isConfirming

  useEffect(() => {
    if (!isSuccess) return
    toast.success(`Sent ${amount} USDC`)
    onSent()
    const t = setTimeout(() => { reset(); setTo(''); setAmount(''); onClose() }, 1400)
    return () => clearTimeout(t)
  }, [isSuccess]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!writeError) return
    const msg = writeError.message?.toLowerCase() ?? ''
    if (msg.includes('user rejected') || msg.includes('denied')) return
    toast.error('Transaction failed')
  }, [writeError])

  const ctaLabel = (() => {
    if (wrongChain || isSwitching) return 'Switch to Arc Testnet'
    if (isPending) return <span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" />Confirm in wallet…</span>
    if (isConfirming) return <span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" />Confirming…</span>
    if (isSuccess) return 'Sent!'
    return 'Send USDC'
  })()

  return (
    <Sheet onClose={() => { if (!isPending && !isConfirming) onClose() }}>
      <div className="px-6 pb-8 pt-5 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="display text-lg font-bold" style={{ color: 'var(--ink)' }}>Send USDC</h2>
          <button onClick={onClose} className="rounded-lg px-2.5 py-1 text-xs font-medium"
            style={{ background: 'var(--surface-muted)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
            Close
          </button>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
            Recipient
          </label>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value.trim())}
            placeholder="0x…"
            data-testid="send-to"
            className="mono w-full rounded-lg px-3 py-2.5 text-sm outline-none"
            style={{ background: 'var(--surface-muted)', border: `1px solid ${to && !isValidAddr ? 'var(--danger)' : 'var(--border)'}`, color: 'var(--ink)' }}
            spellCheck={false}
          />
          {to && !isValidAddr && <p className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>Invalid address</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
            Amount (USDC)
          </label>
          <div className="flex items-baseline gap-2 rounded-lg px-3 py-2.5"
            style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => { const v = e.target.value.replace(/[^0-9.]/g, ''); if (v === '' || /^\d*\.?\d*$/.test(v)) setAmount(v) }}
              placeholder="0.00"
              data-testid="send-amount"
              className="display w-full bg-transparent text-4xl font-bold tabular-nums outline-none placeholder:opacity-20"
              style={{ color: 'var(--ink)' }}
            />
            <span className="text-sm font-semibold" style={{ color: 'var(--muted)' }}>USDC</span>
          </div>
          <div className="mt-2 flex gap-2">
            {['0.10', '0.25', '1.00', '5.00'].map((p) => (
              <button key={p} onClick={() => setAmount(p)}
                className="flex-1 rounded-md py-1.5 text-xs font-semibold"
                style={{
                  background: amount === p ? 'var(--accent)' : 'var(--surface-muted)',
                  color: amount === p ? '#fff' : 'var(--ink-2)',
                  border: '1px solid var(--border)',
                }}>
                ${p}
              </button>
            ))}
          </div>
        </div>

        <button
          disabled={!canSend && !wrongChain && !isSwitching}
          onClick={() => send(to as Address, amount)}
          data-testid="send-submit"
          className="w-full rounded-xl py-3.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: isSuccess ? 'var(--success)' : 'var(--accent)' }}
        >
          {ctaLabel}
        </button>
      </div>
    </Sheet>
  )
}

// ─── Receive Sheet ────────────────────────────────────────────────────────────
function Receive({ address, onClose }: { address: Address; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const [shareLink, setShareLink] = useState('')

  useEffect(() => {
    void buildShareLink(`?to=${address}&memo=Payment`).then(setShareLink)
  }, [address])

  const copyAddr = () => {
    void navigator.clipboard.writeText(address)
    setCopied(true)
    toast.success('Address copied')
    setTimeout(() => setCopied(false), 2000)
  }

  const copyLink = () => {
    if (!shareLink) return
    void navigator.clipboard.writeText(shareLink)
    toast.success('Payment link copied')
  }

  return (
    <Sheet onClose={onClose}>
      <div className="px-6 pb-8 pt-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="display text-lg font-bold" style={{ color: 'var(--ink)' }}>Receive USDC</h2>
          <button onClick={onClose} className="rounded-lg px-2.5 py-1 text-xs font-medium"
            style={{ background: 'var(--surface-muted)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
            Close
          </button>
        </div>

        {/* Address block */}
        <div className="rounded-xl p-5 text-center"
          style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-xl"
            style={{ background: 'var(--teal-bg)', border: '1px solid var(--border)' }}>
            <QrCode className="size-8" style={{ color: 'var(--teal)' }} />
          </div>
          <p className="mono mb-1 break-all text-xs leading-relaxed" style={{ color: 'var(--ink-2)' }}>
            {address}
          </p>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>Arc Testnet · USDC</p>
        </div>

        <button
          onClick={copyAddr}
          data-testid="copy-address-btn"
          className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white"
          style={{ background: 'var(--teal)' }}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? 'Copied!' : 'Copy Address'}
        </button>

        {/* Payment link */}
        <div className="rounded-xl p-4" style={{ background: 'var(--accent-bg)', border: '1px solid var(--border)' }}>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--accent-text)' }}>
            Payment link
          </p>
          <p className="mono mb-3 break-all text-xs leading-relaxed" style={{ color: 'var(--ink-2)' }}>
            {shareLink || '…'}
          </p>
          <button
            onClick={copyLink}
            disabled={!shareLink}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
            style={{ background: 'var(--accent)' }}
          >
            <Copy className="size-3.5" /> Copy link
          </button>
        </div>
      </div>
    </Sheet>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
interface Props {
  address: Address
  transfers: LiveTransfer[]
  txLoading: boolean
  rawBalance: bigint | undefined
  balanceLoading: boolean
  reqs: PaymentRequest[]
  onNavigate: (page: Page) => void
}

export default function Dashboard({ address, transfers, txLoading, rawBalance, balanceLoading, reqs, onNavigate }: Props) {
  const [sendOpen, setSendOpen] = useState(false)
  const [receiveOpen, setReceiveOpen] = useState(false)

  const stats = useMemo(() => {
    const totalIn  = transfers.filter((t) => t.direction === 'received').reduce((s, t) => s + t.amount, 0n)
    const totalOut = transfers.filter((t) => t.direction === 'sent').reduce((s, t) => s + t.amount, 0n)
    const openReqs = reqs.filter((r) => r.status === 'pending').length
    return { totalIn, totalOut, openReqs }
  }, [transfers, reqs])

  const recent = transfers.slice(0, 6)

  return (
    <div className="space-y-4" data-testid="dashboard-page">

      {/* Balance card */}
      <section className="rounded-2xl p-6" style={{ ...card, boxShadow: 'var(--shadow-md)' }}>
        <div className="mb-1 flex items-center gap-2">
          <TokenUSDC variant="branded" size={16} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
            USDC Balance · Arc Testnet
          </span>
        </div>

        <div className="mt-3 flex items-end gap-2">
          {balanceLoading ? (
            <span className="display text-5xl font-bold tabular-nums" style={{ color: 'var(--ink)', opacity: 0.25 }}>—</span>
          ) : (
            <span className="display text-5xl font-bold tabular-nums" style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}>
              {rawBalance !== undefined ? Amount.fromRaw(rawBalance, USDC_DEC).toFixed(2) : '0.00'}
            </span>
          )}
          <span className="mb-1 text-xl font-medium" style={{ color: 'var(--muted)' }}>USDC</span>
        </div>
        <p className="mono mt-1 text-xs" style={{ color: 'var(--subtle)' }}>{shortenAddr(address)}</p>

        {/* 3-button row */}
        <div className="mt-5 flex gap-2.5">
          <button
            onClick={() => setSendOpen(true)}
            data-testid="quick-send-btn"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white"
            style={{ background: 'var(--accent)' }}
          >
            <Send className="size-4" /> Send
          </button>
          <button
            onClick={() => setReceiveOpen(true)}
            data-testid="receive-btn"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white"
            style={{ background: 'var(--teal)' }}
          >
            <QrCode className="size-4" /> Receive
          </button>
          <button
            onClick={() => onNavigate('requests')}
            data-testid="new-request-nav-btn"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white"
            style={{ background: 'var(--violet)' }}
          >
            <Copy className="size-4" /> Request
          </button>
        </div>
      </section>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Received', value: fmtCurrency(Number(fmtUsdc(stats.totalIn))),  color: 'var(--success)', bg: 'var(--success-bg)', border: 'var(--success-border)', icon: ArrowDownLeft },
          { label: 'Sent',     value: fmtCurrency(Number(fmtUsdc(stats.totalOut))), color: 'var(--danger)',  bg: 'var(--danger-bg)',  border: 'var(--danger-border)',  icon: ArrowUpRight },
          { label: 'Requests', value: String(stats.openReqs), color: 'var(--violet)', bg: 'var(--violet-bg)', border: 'var(--border)', icon: Clock },
        ].map((s) => {
          const Icon = s.icon
          return (
            <div key={s.label} className="rounded-xl p-4"
              style={{ background: s.bg, border: `1px solid ${s.border}` }}>
              <Icon className="mb-2 size-4" style={{ color: s.color }} />
              <p className="display tabular-nums text-base font-bold" style={{ color: 'var(--ink)' }}>{s.value}</p>
              <p className="text-xs font-medium" style={{ color: s.color }}>{s.label}</p>
            </div>
          )
        })}
      </div>

      {/* Recent activity */}
      <section style={card} className="overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5"
          style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2">
            <Activity className="size-4" style={{ color: 'var(--muted)' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Recent Activity</h2>
          </div>
          <div className="flex items-center gap-2">
            {txLoading && <Loader2 className="size-3.5 animate-spin" style={{ color: 'var(--subtle)' }} />}
            <button
              onClick={() => onNavigate('transactions')}
              className="text-xs font-semibold"
              style={{ color: 'var(--accent)' }}
            >
              View all →
            </button>
          </div>
        </div>

        {txLoading && recent.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-5 animate-spin" style={{ color: 'var(--muted)' }} />
          </div>
        ) : recent.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>No activity yet</p>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--subtle)' }}>Send or receive USDC to see transactions here.</p>
          </div>
        ) : (
          <ul data-testid="recent-tx-list">
            {recent.map((tx) => (
              <li key={tx.id}
                className="flex items-center justify-between px-5 py-3.5"
                style={{ borderBottom: '1px solid var(--border)' }}
                data-testid="tx-row">
                <div className="flex items-center gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: tx.direction === 'received' ? 'var(--success-bg)' : 'var(--danger-bg)' }}>
                    {tx.direction === 'received'
                      ? <ArrowDownLeft className="size-4" style={{ color: 'var(--success)' }} />
                      : <ArrowUpRight  className="size-4" style={{ color: 'var(--danger)' }} />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                      {tx.direction === 'received' ? `From ${shortenAddr(tx.from)}` : `To ${shortenAddr(tx.to)}`}
                    </p>
                    <p className="mono text-xs" style={{ color: 'var(--subtle)' }}>Block {tx.blockNumber.toString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="display tabular-nums text-sm font-bold"
                    style={{ color: tx.direction === 'received' ? 'var(--success)' : 'var(--danger)' }}>
                    {tx.direction === 'received' ? '+' : '−'}{fmtUsdc(tx.amount)} USDC
                  </p>
                  <a href={tx.explorerUrl} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-0.5 text-xs"
                    style={{ color: 'var(--subtle)' }}>
                    ArcScan <ExternalLink className="size-3" />
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {sendOpen    && <QuickSend onClose={() => setSendOpen(false)}    onSent={() => {}} />}
      {receiveOpen && <Receive   address={address} onClose={() => setReceiveOpen(false)} />}
    </div>
  )
}

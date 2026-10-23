import { useState, useCallback, useEffect } from 'react'
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
} from 'wagmi'
import { erc20Abi, isAddress, type Address } from 'viem'
import { ConnectKitButton } from 'connectkit'
import { motion, AnimatePresence } from 'framer-motion'
import { TokenUSDC, NetworkArc } from '@web3icons/react'
import {
  ArrowUpRight,
  ArrowDownLeft,
  ExternalLink,
  Loader2,
  X,
  Clock,
  Send,
  CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import { getUsdc, buildTxExplorerUrl, requireChain } from '@/onchain-facts'
import { Amount, usdcDecimalsFor } from '@/onchain-money'

// ─── Chain / token constants ─────────────────────────────────────────────────
const ARC_TESTNET_ID = 5042002
const usdcFact = getUsdc(ARC_TESTNET_ID)!
const USDC_ADDRESS = usdcFact.address as Address
const CHAIN_NAME = requireChain(ARC_TESTNET_ID).name
const EXPLORER_BASE = requireChain(ARC_TESTNET_ID).explorerBase
const USDC_DECIMALS = usdcDecimalsFor(ARC_TESTNET_ID)

// ─── Helpers ─────────────────────────────────────────────────────────────────
function shortenAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function parseOnchainError(err: unknown): string {
  const msg = (err as { message?: string })?.message?.toLowerCase() ?? ''
  if (msg.includes('user rejected') || msg.includes('user denied')) return 'Transaction cancelled.'
  if (msg.includes('insufficient')) return 'Insufficient USDC balance.'
  if (msg.includes('reverted')) return 'Transaction reverted on-chain.'
  if (msg.includes('network') || msg.includes('timeout')) return 'Network error — please retry.'
  return 'Something went wrong.'
}

// ─── Glass style helpers ──────────────────────────────────────────────────────
const glass = {
  card: {
    background: 'var(--surface)',
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    border: '1px solid var(--border)',
    borderRadius: '24px',
  } as React.CSSProperties,
  inner: {
    background: 'var(--surface-muted)',
    borderRadius: '16px',
    border: '1px solid var(--border)',
  } as React.CSSProperties,
}

const spectral =
  'linear-gradient(90deg,#6366f1,#8b5cf6,#ec4899,#f59e0b,#10b981,#3b82f6,#6366f1)'

const springs = {
  sheet: { type: 'spring', stiffness: 380, damping: 40 } as const,
  fade: { duration: 0.18 },
}

// ─── Quick amount presets ─────────────────────────────────────────────────────
const PRESETS = ['0.10', '0.25', '0.50', '1.00']

// ─── Types ────────────────────────────────────────────────────────────────────
interface TxRecord {
  id: string
  hash: string
  to: string
  amount: string
  memo: string
  ts: number
}

// ─── Balance card ─────────────────────────────────────────────────────────────
function BalanceCard({ address }: { address: Address }) {
  const { data: raw, isLoading } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [address],
    chainId: ARC_TESTNET_ID,
  })

  const formatted =
    raw !== undefined
      ? Amount.fromRaw(raw, USDC_DECIMALS).toFixed(2)
      : null

  return (
    <section style={glass.card} className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <NetworkArc variant="branded" size={20} />
          <span
            className="text-xs font-semibold tracking-wide uppercase"
            style={{ color: 'var(--muted)', letterSpacing: '0.07em' }}
          >
            {CHAIN_NAME}
          </span>
        </div>
        <div
          className="flex items-center gap-1 rounded-full px-2.5 py-1"
          style={{ background: 'rgba(26,128,71,0.10)' }}
        >
          <span
            className="size-1.5 rounded-full"
            style={{ background: 'var(--success)', display: 'inline-block' }}
          />
          <span className="text-xs font-semibold" style={{ color: 'var(--success)' }}>
            Live
          </span>
        </div>
      </div>

      <div className="mb-1 flex items-baseline gap-2">
        {isLoading ? (
          <span
            className="display text-5xl font-bold tabular-nums"
            style={{ color: 'var(--ink)', opacity: 0.3 }}
          >
            ···
          </span>
        ) : (
          <span
            className="display text-5xl font-bold tabular-nums"
            style={{ color: 'var(--ink)' }}
          >
            {formatted ?? '0.00'}
          </span>
        )}
        <div className="flex items-center gap-1">
          <TokenUSDC variant="branded" size={20} />
          <span className="text-lg font-semibold" style={{ color: 'var(--subtle)' }}>
            USDC
          </span>
        </div>
      </div>

      <p className="text-xs" style={{ color: 'var(--muted)' }}>
        {shortenAddress(address)} · Arc Testnet
      </p>
    </section>
  )
}

// ─── Send sheet ───────────────────────────────────────────────────────────────
interface SendSheetProps {
  open: boolean
  onClose: () => void
  senderAddress: Address
  onSent: (record: TxRecord) => void
}

function SendSheet({ open, onClose, senderAddress, onSent }: SendSheetProps) {
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')

  const { chainId } = useAccount()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const { writeContract, data: hash, isPending, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const wrongChain = chainId !== ARC_TESTNET_ID

  // Balance for "max" button
  const { data: rawBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [senderAddress],
    chainId: ARC_TESTNET_ID,
  })
  const formattedBalance =
    rawBalance !== undefined
      ? Amount.fromRaw(rawBalance, USDC_DECIMALS).toFixed(2)
      : null

  const isValidAddress = isAddress(to)
  const isValidAmount = /^\d+(\.\d{1,6})?$/.test(amount) && parseFloat(amount) > 0
  const canSend = isValidAddress && isValidAmount && !isPending && !isConfirming

  const handleSend = useCallback(() => {
    if (wrongChain) {
      switchChain({ chainId: ARC_TESTNET_ID })
      return
    }
    if (!isValidAddress || !isValidAmount) return
    try {
      const parsed = Amount.parse(amount, USDC_DECIMALS)
      writeContract({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [to, parsed.raw],
        chainId: ARC_TESTNET_ID,
      })
    } catch (e) {
      toast.error(parseOnchainError(e))
    }
  }, [wrongChain, switchChain, isValidAddress, isValidAmount, amount, to, writeContract])

  // On success: persist record and close
  useEffect(() => {
    if (!isSuccess || !hash) return
    const record: TxRecord = {
      id: hash,
      hash,
      to,
      amount,
      memo,
      ts: Date.now(),
    }
    onSent(record)
    const timer = setTimeout(() => {
      reset()
      setTo('')
      setAmount('')
      setMemo('')
      onClose()
    }, 1800)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess, hash])

  const handleClose = () => {
    if (isPending || isConfirming) return
    reset()
    onClose()
  }

  const ctaLabel = (() => {
    if (!isValidAddress && to.length > 0) return 'Invalid address'
    if (wrongChain) return `Switch to ${CHAIN_NAME}`
    if (isSwitching) return 'Switching network…'
    if (isPending)
      return (
        <span className="flex items-center justify-center gap-2">
          <Loader2 className="size-4 animate-spin" /> Confirm in wallet…
        </span>
      )
    if (isConfirming)
      return (
        <span className="flex items-center justify-center gap-2">
          <Loader2 className="size-4 animate-spin" /> Confirming…
        </span>
      )
    if (isSuccess) return <span className="flex items-center justify-center gap-2"><CheckCircle2 className="size-4" /> Sent!</span>
    return 'Send USDC'
  })()

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={springs.fade}
          onClick={handleClose}
        >
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
          <motion.section
            className="relative w-full max-w-md overflow-hidden rounded-t-3xl"
            style={{
              background: 'rgba(255,255,255,0.92)',
              backdropFilter: 'blur(40px) saturate(200%)',
              WebkitBackdropFilter: 'blur(40px) saturate(200%)',
            }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={springs.sheet}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Spectral strip */}
            <div className="h-1" style={{ background: spectral }} />

            {/* Handle + header */}
            <div className="flex items-center justify-between px-5 pb-1 pt-3">
              <div className="mx-auto h-1 w-10 rounded-full bg-black/10" />
            </div>
            <div className="flex items-center justify-between px-5 pb-4 pt-1">
              <h2
                className="display text-xl font-bold"
                style={{ color: 'var(--ink)' }}
              >
                Send USDC
              </h2>
              <button
                onClick={handleClose}
                className="flex size-8 items-center justify-center rounded-full transition-colors"
                style={{ background: 'var(--surface-muted)' }}
              >
                <X className="size-4" style={{ color: 'var(--muted)' }} />
              </button>
            </div>

            <div className="space-y-3 px-5 pb-8">
              {/* Recipient */}
              <div style={glass.inner} className="p-4">
                <label
                  className="mb-1.5 block text-xs font-semibold"
                  style={{ color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}
                >
                  Recipient
                </label>
                <input
                  value={to}
                  onChange={(e) => setTo(e.target.value.trim())}
                  placeholder="0x…"
                  className="mono w-full bg-transparent text-sm outline-none placeholder:opacity-30"
                  style={{ color: 'var(--ink)' }}
                  spellCheck={false}
                />
                {to.length > 0 && !isValidAddress && (
                  <p className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>
                    Not a valid address
                  </p>
                )}
              </div>

              {/* Amount */}
              <div style={glass.inner} className="p-4">
                <div className="flex items-center justify-between">
                  <label
                    className="text-xs font-semibold"
                    style={{ color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}
                  >
                    Amount
                  </label>
                  <button
                    disabled={!formattedBalance}
                    onClick={() => formattedBalance && setAmount(formattedBalance)}
                    className="text-xs font-semibold disabled:opacity-40"
                    style={{ color: 'var(--accent-hover)' }}
                  >
                    {formattedBalance ? `Bal: ${formattedBalance} · Max` : '—'}
                  </button>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <input
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^0-9.]/g, '')
                      if (v === '' || /^\d*\.?\d*$/.test(v)) setAmount(v)
                    }}
                    placeholder="0.00"
                    className="display w-full bg-transparent text-4xl font-bold tabular-nums outline-none placeholder:opacity-20"
                    style={{ color: 'var(--ink)' }}
                  />
                  <span className="text-base font-semibold" style={{ color: 'var(--subtle)' }}>
                    USDC
                  </span>
                </div>
                {/* Quick presets */}
                <div className="mt-3 flex gap-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p}
                      onClick={() => setAmount(p)}
                      className="flex-1 rounded-xl py-1.5 text-xs font-semibold transition-colors"
                      style={{
                        background: amount === p ? 'var(--accent)' : 'var(--surface)',
                        color: amount === p ? '#fff' : 'var(--ink-2)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      ${p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Memo */}
              <div style={glass.inner} className="p-4">
                <label
                  className="mb-1.5 block text-xs font-semibold"
                  style={{ color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}
                >
                  Memo (optional)
                </label>
                <input
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="e.g. Coffee split"
                  className="w-full bg-transparent text-sm outline-none placeholder:opacity-30"
                  style={{ color: 'var(--ink)' }}
                />
              </div>

              {/* Success receipt */}
              <AnimatePresence>
                {isSuccess && hash && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    style={{ ...glass.inner, borderColor: 'rgba(26,128,71,0.25)' }}
                    className="flex items-center justify-between p-4"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="size-4" style={{ color: 'var(--success)' }} />
                      <span className="text-sm font-semibold" style={{ color: 'var(--success)' }}>
                        Confirmed
                      </span>
                    </div>
                    <a
                      href={buildTxExplorerUrl(ARC_TESTNET_ID, hash)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs"
                      style={{ color: 'var(--accent-hover)' }}
                    >
                      ArcScan <ExternalLink className="size-3" />
                    </a>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* CTA */}
              <button
                disabled={!canSend && !wrongChain && !isSwitching}
                onClick={handleSend}
                className="w-full rounded-2xl py-4 text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                style={{ background: isSuccess ? 'var(--success)' : 'var(--accent)' }}
              >
                {ctaLabel}
              </button>

              <p
                className="text-center text-xs"
                style={{ color: 'var(--subtle)' }}
              >
                Transactions on Arc Testnet are final and gas-free (USDC as gas).
              </p>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Activity feed ────────────────────────────────────────────────────────────
interface ActivityFeedProps {
  records: TxRecord[]
}

function ActivityFeed({ records }: ActivityFeedProps) {
  if (records.length === 0) {
    return (
      <section style={glass.card} className="p-5">
        <h3
          className="mb-3 text-xs font-semibold uppercase"
          style={{ color: 'var(--muted)', letterSpacing: '0.08em' }}
        >
          Activity
        </h3>
        <div className="flex flex-col items-center py-6">
          <Clock className="mb-2 size-8 opacity-20" style={{ color: 'var(--ink)' }} />
          <p className="text-sm" style={{ color: 'var(--subtle)' }}>
            No transactions yet
          </p>
        </div>
      </section>
    )
  }

  return (
    <section style={glass.card} className="p-5">
      <h3
        className="mb-3 text-xs font-semibold uppercase"
        style={{ color: 'var(--muted)', letterSpacing: '0.08em' }}
      >
        Activity
      </h3>
      <ul className="space-y-2">
        {records.map((r) => (
          <motion.li
            key={r.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            style={glass.inner}
            className="flex items-center justify-between p-3"
          >
            <div className="flex items-center gap-3">
              <div
                className="flex size-8 items-center justify-center rounded-xl"
                style={{ background: 'rgba(186,43,76,0.10)' }}
              >
                <ArrowUpRight className="size-4" style={{ color: 'var(--danger)' }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                  {r.memo || 'Sent'}
                </p>
                <p className="mono text-xs" style={{ color: 'var(--subtle)' }}>
                  {shortenAddress(r.to)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p
                className="display tabular-nums text-sm font-bold"
                style={{ color: 'var(--danger)' }}
              >
                −{r.amount} USDC
              </p>
              <a
                href={`${EXPLORER_BASE}/tx/${r.hash}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-end gap-0.5 text-xs"
                style={{ color: 'var(--subtle)' }}
              >
                View <ExternalLink className="size-3" />
              </a>
            </div>
          </motion.li>
        ))}
      </ul>
    </section>
  )
}

// ─── Root component ───────────────────────────────────────────────────────────
export default function PaymentApp() {
  const { address, isConnected, isConnecting } = useAccount()
  const [sendOpen, setSendOpen] = useState(false)
  const [records, setRecords] = useState<TxRecord[]>([])

  const handleSent = useCallback((r: TxRecord) => {
    setRecords((prev) => [r, ...prev])
    toast.success(`Sent ${r.amount} USDC!`)
  }, [])

  return (
    <div
      className="flex min-h-dvh flex-col items-center px-4 py-8"
      style={{ background: 'var(--bg-gradient)' }}
    >
      {/* Header */}
      <header className="mb-8 flex w-full max-w-md items-center justify-between">
        <div className="flex items-center gap-2">
          <TokenUSDC variant="branded" size={28} />
          <span
            className="display text-xl font-bold"
            style={{ color: 'var(--ink)' }}
          >
            Arc Pay
          </span>
        </div>
        <ConnectKitButton />
      </header>

      {/* Main content */}
      <main className="w-full max-w-md space-y-4">
        {!isConnected ? (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            style={glass.card}
            className="p-8 text-center"
          >
            <div className="mb-4 flex justify-center">
              <div
                className="flex size-16 items-center justify-center rounded-2xl"
                style={{ background: 'var(--surface-muted)' }}
              >
                <TokenUSDC variant="branded" size={36} />
              </div>
            </div>
            <h1
              className="display mb-2 text-2xl font-bold"
              style={{ color: 'var(--ink)' }}
            >
              {isConnecting ? 'Connecting…' : 'Send USDC on Arc'}
            </h1>
            <p className="mb-6 text-sm text-pretty" style={{ color: 'var(--muted)' }}>
              USDC is the native gas token on Arc. Connect your wallet to send payments with near-zero fees and sub-second confirmation.
            </p>
            <ConnectKitButton label="Connect Wallet" />
          </motion.section>
        ) : (
          <>
            {/* Balance */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <BalanceCard address={address!} />
            </motion.div>

            {/* Action row */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 }}
              className="flex gap-3"
            >
              <button
                onClick={() => setSendOpen(true)}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl py-4 text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: 'var(--accent)' }}
              >
                <Send className="size-4" />
                Send
              </button>
              <button
                onClick={() => {
                  const link = `${window.location.origin}?to=${address}`
                  void navigator.clipboard.writeText(link)
                  toast.success('Payment link copied!')
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl border py-4 text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: 'var(--surface)',
                  borderColor: 'var(--border)',
                  color: 'var(--ink)',
                }}
              >
                <ArrowDownLeft className="size-4" />
                Receive
              </button>
            </motion.div>

            {/* Activity */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
            >
              <ActivityFeed records={records} />
            </motion.div>

            {/* Testnet hint */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-center text-xs"
              style={{ color: 'var(--subtle)' }}
            >
              Need test USDC? Use the "Get test USDC" button in the Arc Studio sidebar.
            </motion.p>
          </>
        )}
      </main>

      {/* Send sheet */}
      {isConnected && address && (
        <SendSheet
          open={sendOpen}
          onClose={() => setSendOpen(false)}
          senderAddress={address}
          onSent={handleSent}
        />
      )}
    </div>
  )
}

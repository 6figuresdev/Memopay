import { useState, useMemo, useRef, useEffect } from 'react'
import {
  LayoutDashboard,
  FileText,
  ArrowLeftRight,
  BarChart3,
  Zap,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldCheck,
  LogOut,
  ChevronDown,
} from 'lucide-react'
import { ConnectKitButton } from 'connectkit'
import { useAccount, useReadContract, useSwitchChain, useDisconnect } from 'wagmi'
import { erc20Abi, type Address } from 'viem'
import { TokenUSDC } from '@web3icons/react'
import { Amount, usdcDecimalsFor } from '@/onchain-money'
import { getUsdc, requireChain } from '@/onchain-facts'
import { useUsdcTransfers } from '@/hooks/useUsdcTransfers'
import { usePaymentRequests } from '@/data/store'
import Dashboard from '@/components/Dashboard'
import Requests from '@/components/Requests'
import Transactions from '@/components/Transactions'
import Analytics from '@/components/Analytics'

type Page = 'dashboard' | 'requests' | 'transactions' | 'analytics'

const ARC_TESTNET_ID = 5042002
const usdcFact = getUsdc(ARC_TESTNET_ID)!
const USDC_ADDRESS = usdcFact.address as Address
const CHAIN = requireChain(ARC_TESTNET_ID)

const NAV: Array<{ id: Page; label: string; icon: React.ElementType; activeColor: string }> = [
  { id: 'dashboard',    label: 'Dashboard',    icon: LayoutDashboard, activeColor: 'var(--accent)'  },
  { id: 'requests',     label: 'Requests',     icon: FileText,        activeColor: 'var(--violet)'  },
  { id: 'transactions', label: 'Transactions', icon: ArrowLeftRight,  activeColor: 'var(--teal)'    },
  { id: 'analytics',    label: 'Analytics',    icon: BarChart3,       activeColor: 'var(--amber)'   },
]

// Shared card style — opaque, solid border, no blur
export const card: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '12px',
  boxShadow: 'var(--shadow-sm)',
}

// User menu — address chip + disconnect dropdown
function UserMenu({ address, balance }: { address: Address; balance: string | null }) {
  const { disconnect } = useDisconnect()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const short = `${address.slice(0, 6)}…${address.slice(-4)}`
  // Deterministic color from address
  const hue = parseInt(address.slice(2, 4), 16) * 1.4

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium"
        style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }}
      >
        {/* Avatar */}
        <span
          className="flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
          style={{ background: `hsl(${hue},60%,50%)` }}
        >
          {address.slice(2, 4).toUpperCase()}
        </span>
        {balance !== null && (
          <span className="hidden items-center gap-1 md:flex">
            <TokenUSDC variant="branded" size={12} />
            <span className="display tabular-nums text-xs font-bold">{balance}</span>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>USDC</span>
          </span>
        )}
        <span className="hidden text-xs md:block" style={{ color: 'var(--muted)' }}>{short}</span>
        <ChevronDown className="size-3.5" style={{ color: 'var(--muted)' }} />
      </button>

      {open && (
        <div
          className="absolute right-0 z-50 mt-1 w-52 rounded-xl p-1"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
        >
          {/* Address row */}
          <div className="px-3 py-2">
            <p className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>Connected wallet</p>
            <p className="mt-0.5 font-mono text-xs" style={{ color: 'var(--muted)' }}>
              {address.slice(0, 10)}…{address.slice(-8)}
            </p>
          </div>
          <div style={{ borderTop: '1px solid var(--border)', margin: '2px 0' }} />
          <button
            onClick={() => { disconnect(); setOpen(false) }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
            style={{ color: 'var(--danger)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--danger-bg)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <LogOut className="size-4" />
            Disconnect
          </button>
        </div>
      )}
    </div>
  )
}

// Wrong-chain banner
function WrongChainBanner({ chainId }: { chainId: number | undefined }) {
  const { switchChain, isPending } = useSwitchChain()
  if (chainId === ARC_TESTNET_ID || !chainId) return null
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm"
      style={{ background: 'var(--danger-bg)', borderBottom: '1px solid var(--danger-border)' }}>
      <span className="font-medium" style={{ color: 'var(--danger)' }}>
        Wrong network — switch to Arc Testnet.
      </span>
      <button
        onClick={() => switchChain({ chainId: ARC_TESTNET_ID })}
        disabled={isPending}
        className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        style={{ background: 'var(--danger)' }}
      >
        {isPending ? 'Switching…' : 'Switch'}
      </button>
    </div>
  )
}

// Connect landing — header with connect button top-right
function ConnectLanding() {
  const features = [
    { icon: ArrowUpRight,  label: 'Send USDC',   desc: 'Real on-chain transfers',   color: 'var(--accent)',  bg: 'var(--accent-bg)'  },
    { icon: ArrowDownLeft, label: 'Receive',      desc: 'Shareable payment links',   color: 'var(--teal)',    bg: 'var(--teal-bg)'    },
    { icon: FileText,      label: 'Requests',     desc: 'Create invoices instantly', color: 'var(--violet)', bg: 'var(--violet-bg)'  },
    { icon: ShieldCheck,   label: 'Verified',     desc: 'Every tx on ArcScan',       color: 'var(--success)', bg: 'var(--success-bg)' },
  ]
  return (
    <div className="flex min-h-dvh flex-col" style={{ background: 'var(--bg)' }}>
      {/* Top bar with connect button in top-right */}
      <header className="flex items-center justify-between px-5 py-3"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg"
            style={{ background: 'var(--accent)' }}>
            <Zap className="size-4 text-white" />
          </div>
          <span className="display text-base font-bold" style={{ color: 'var(--ink)' }}>MemoPay</span>
        </div>
        <ConnectKitButton label="Connect Wallet" />
      </header>

      {/* Centered content */}
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          {/* Hero */}
          <div className="mb-8 flex flex-col items-center gap-3 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl"
              style={{ background: 'var(--accent)', boxShadow: '0 4px 12px rgba(79,70,229,0.25)' }}>
              <Zap className="size-7 text-white" />
            </div>
            <div>
              <h1 className="display text-3xl font-bold" style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}>
                MemoPay
              </h1>
              <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
                USDC payments on Arc Testnet
              </p>
            </div>
          </div>

          {/* Feature grid */}
          <div className="mb-6 grid grid-cols-2 gap-2">
            {features.map((f) => {
              const Icon = f.icon
              return (
                <div key={f.label} className="rounded-xl p-3"
                  style={{ background: f.bg, border: '1px solid var(--border)' }}>
                  <Icon className="mb-1.5 size-4" style={{ color: f.color }} />
                  <p className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>{f.label}</p>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>{f.desc}</p>
                </div>
              )
            })}
          </div>

          <p className="text-center text-xs" style={{ color: 'var(--subtle)' }}>
            Arc Testnet · USDC · Use "Get test USDC" in the sidebar
          </p>
        </div>
      </div>
    </div>
  )
}

// Main app
export default function App() {
  const { address, isConnected, chainId } = useAccount()
  const [page, setPage] = useState<Page>('dashboard')

  const { data: rawBalance, isLoading: balanceLoading } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: ARC_TESTNET_ID,
    query: { enabled: !!address, refetchInterval: 8000 },
  })

  const formattedBalance = useMemo(() => {
    if (rawBalance === undefined) return null
    return Amount.fromRaw(rawBalance, usdcDecimalsFor(ARC_TESTNET_ID)).toFixed(2)
  }, [rawBalance])

  const { transfers, loading: txLoading, refetch } = useUsdcTransfers(address)
  const { reqs, addRequest, cancelRequest, updateRequestStatus } = usePaymentRequests()

  if (!isConnected) return <ConnectLanding />

  return (
    <div className="flex min-h-dvh flex-col" style={{ background: 'var(--bg)' }}>
      <WrongChainBanner chainId={chainId} />

      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-5 py-3"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        {/* Logo */}
        <button onClick={() => setPage('dashboard')} className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg"
            style={{ background: 'var(--accent)' }}>
            <Zap className="size-4 text-white" />
          </div>
          <span className="display text-base font-bold" style={{ color: 'var(--ink)' }}>MemoPay</span>
          <span className="hidden rounded-md px-1.5 py-0.5 text-xs font-medium md:inline-block"
            style={{ background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success-border)' }}>
            {CHAIN.name}
          </span>
        </button>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-0.5 md:flex">
          {NAV.map((item) => {
            const Icon = item.icon
            const active = page === item.id
            return (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                data-testid={`nav-${item.id}`}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium"
                style={{
                  background: active ? 'var(--accent-bg)' : 'transparent',
                  color: active ? 'var(--accent-text)' : 'var(--muted)',
                  borderBottom: active ? `2px solid var(--accent)` : '2px solid transparent',
                }}
              >
                <Icon className="size-3.5" />
                {item.label}
              </button>
            )
          })}
        </nav>

        {/* User menu */}
        <UserMenu address={address!} balance={formattedBalance} />
      </header>

      {/* Page */}
      <main className="flex-1 px-4 py-6 md:px-6">
        <div className="mx-auto max-w-2xl">
          {page === 'dashboard' && (
            <Dashboard
              address={address!}
              transfers={transfers}
              txLoading={txLoading}
              rawBalance={rawBalance}
              balanceLoading={balanceLoading}
              reqs={reqs}
              onNavigate={setPage}
            />
          )}
          {page === 'requests' && (
            <Requests
              reqs={reqs}
              address={address!}
              onAdd={addRequest}
              onCancel={cancelRequest}
              onMarkPaid={updateRequestStatus}
              onRefreshTx={() => { void refetch() }}
            />
          )}
          {page === 'transactions' && (
            <Transactions transfers={transfers} loading={txLoading} address={address!} />
          )}
          {page === 'analytics' && (
            <Analytics transfers={transfers} reqs={reqs} address={address!} />
          )}
        </div>
      </main>

      {/* Bottom nav (mobile) */}
      <nav
        className="sticky bottom-0 z-40 flex items-center justify-around border-t px-1 py-1 md:hidden"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        {NAV.map((item) => {
          const Icon = item.icon
          const active = page === item.id
          return (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              data-testid={`mobile-nav-${item.id}`}
              className="flex flex-col items-center gap-0.5 rounded-lg px-3 py-2 text-xs font-medium"
              style={{
                color: active ? item.activeColor : 'var(--muted)',
                minHeight: '48px',
                minWidth: '56px',
                justifyContent: 'center',
              }}
            >
              <Icon className="size-5" />
              {item.label}
            </button>
          )
        })}
      </nav>
    </div>
  )
}

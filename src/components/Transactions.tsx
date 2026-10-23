import { useState, useMemo } from 'react'
import { ArrowUpRight, ArrowDownLeft, Loader2, ExternalLink, ArrowLeftRight, Search } from 'lucide-react'
import { Amount, usdcDecimalsFor } from '@/onchain-money'
import type { LiveTransfer } from '@/hooks/useUsdcTransfers'
import type { Address } from 'viem'

const USDC_DEC = usdcDecimalsFor(5042002)
function fmtUsdc(raw: bigint) { return Amount.fromRaw(raw, USDC_DEC).toFixed(2) }
function shortenAddr(addr: string) { return `${addr.slice(0, 6)}…${addr.slice(-4)}` }

const card: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '12px',
  boxShadow: 'var(--shadow-sm)',
}

type Filter = 'all' | 'sent' | 'received'

interface Props {
  transfers: LiveTransfer[]
  loading: boolean
  address: Address
}

export default function Transactions({ transfers, loading, address }: Props) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  void address

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return transfers.filter((t) => {
      if (filter === 'sent'     && t.direction !== 'sent')     return false
      if (filter === 'received' && t.direction !== 'received') return false
      if (q) {
        const match =
          t.from.toLowerCase().includes(q) ||
          t.to.toLowerCase().includes(q) ||
          t.txHash.toLowerCase().includes(q) ||
          fmtUsdc(t.amount).includes(q)
        if (!match) return false
      }
      return true
    })
  }, [transfers, search, filter])

  const FILTERS: Array<{ id: Filter; label: string; color: string; bg: string }> = [
    { id: 'all',      label: 'All',      color: 'var(--ink)',     bg: 'var(--surface-muted)' },
    { id: 'received', label: 'Received', color: 'var(--success)', bg: 'var(--success-bg)'    },
    { id: 'sent',     label: 'Sent',     color: 'var(--danger)',  bg: 'var(--danger-bg)'     },
  ]

  return (
    <div className="space-y-4" data-testid="transactions-page">
      <div>
        <h1 className="display text-2xl font-bold" style={{ color: 'var(--ink)', letterSpacing: '-0.025em' }}>
          Transactions
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
          Live USDC transfers on Arc Testnet · last 5,000 blocks
        </p>
      </div>

      {/* Filter bar */}
      <div style={card} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2" style={{ color: 'var(--subtle)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search address or hash…"
            data-testid="tx-search"
            className="w-full rounded-lg py-2 pl-9 pr-3 text-sm outline-none"
            style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }}
          />
        </div>
        <div className="flex gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              data-testid={`filter-${f.id}`}
              className="rounded-md px-3.5 py-1.5 text-xs font-semibold"
              style={{
                background: filter === f.id ? f.bg : 'var(--surface-muted)',
                color: filter === f.id ? f.color : 'var(--muted)',
                border: `1px solid ${filter === f.id ? f.color : 'var(--border)'}`,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div style={card} className="overflow-hidden">
        {loading && filtered.length === 0 ? (
          <div className="flex items-center justify-center py-14">
            <Loader2 className="size-6 animate-spin" style={{ color: 'var(--muted)' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-14 text-center">
            <ArrowLeftRight className="mx-auto mb-3 size-7" style={{ color: 'var(--border-strong)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
              {search || filter !== 'all' ? 'No results — try clearing filters.' : 'No USDC transfers in the last 5,000 blocks.'}
            </p>
          </div>
        ) : (
          <ul>
            {filtered.map((tx) => (
              <li
                key={tx.id}
                className="flex items-center justify-between px-5 py-3.5"
                style={{ borderBottom: '1px solid var(--border)' }}
                data-testid="tx-row"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: tx.direction === 'received' ? 'var(--success-bg)' : 'var(--danger-bg)' }}
                  >
                    {tx.direction === 'received'
                      ? <ArrowDownLeft className="size-4" style={{ color: 'var(--success)' }} />
                      : <ArrowUpRight  className="size-4" style={{ color: 'var(--danger)' }} />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                      {tx.direction === 'received'
                        ? <span>From <span className="mono">{shortenAddr(tx.from)}</span></span>
                        : <span>To <span className="mono">{shortenAddr(tx.to)}</span></span>}
                    </p>
                    <p className="mono text-xs" style={{ color: 'var(--subtle)' }}>
                      Block {tx.blockNumber.toString()}
                    </p>
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
      </div>

      <p className="text-center text-xs" style={{ color: 'var(--subtle)' }}>
        {loading ? 'Scanning chain…' : `${filtered.length} of ${transfers.length} transfers`}
      </p>
    </div>
  )
}

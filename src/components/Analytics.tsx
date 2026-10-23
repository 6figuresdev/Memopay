import { useMemo } from 'react'
import { Amount, usdcDecimalsFor } from '@/onchain-money'
import type { LiveTransfer } from '@/hooks/useUsdcTransfers'
import type { PaymentRequest } from '@/data/types'
import type { Address } from 'viem'

const USDC_DEC = usdcDecimalsFor(5042002)
function fmtUsdc(raw: bigint) { return Amount.fromRaw(raw, USDC_DEC).toFixed(2) }
function fmtNum(n: number) {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

const card: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '12px',
  boxShadow: 'var(--shadow-sm)',
}

// Simple static bar chart — no animation
function BarChart({ transfers }: { transfers: LiveTransfer[] }) {
  const bars = useMemo(() => {
    if (transfers.length === 0) return []
    const max = transfers.reduce((m, t) => (t.blockNumber > m ? t.blockNumber : m), 0n)
    const min = transfers.reduce((m, t) => (t.blockNumber < m ? t.blockNumber : m), BigInt('9999999999'))
    const range = max - min || 1n
    const BUCKETS = 8
    const bucketSize = range / BigInt(BUCKETS) || 1n
    const data = Array.from({ length: BUCKETS }, (_, i) => {
      const lo = min + BigInt(i) * bucketSize
      const hi = i === BUCKETS - 1 ? max + 1n : lo + bucketSize
      const slice = transfers.filter((t) => t.blockNumber >= lo && t.blockNumber < hi)
      const volume = slice.reduce((s, t) => s + t.amount, 0n)
      return { label: `…${lo.toString().slice(-4)}`, volume }
    })
    const peak = data.reduce((m, b) => (b.volume > m ? b.volume : m), 0n) || 1n
    return data.map((b) => ({ ...b, pct: Number((b.volume * 100n) / peak) }))
  }, [transfers])

  if (bars.length === 0) {
    return <div className="flex h-28 items-center justify-center text-xs" style={{ color: 'var(--subtle)' }}>No transfer data yet</div>
  }

  return (
    <div className="flex h-28 items-end gap-1.5" data-testid="bar-chart">
      {bars.map((b, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-t-sm"
            style={{
              background: b.pct > 60 ? 'var(--accent)' : b.pct > 30 ? 'var(--violet)' : 'var(--border-strong)',
              height: `${Math.max(b.pct, 4)}%`,
              minHeight: '4px',
            }}
          />
          <span style={{ color: 'var(--subtle)', fontSize: '9px' }}>{b.label}</span>
        </div>
      ))}
    </div>
  )
}

function buildDonutSlices(segs: Array<{ value: number; color: string }>, radius: number) {
  const total = segs.reduce((s, x) => s + x.value, 0) || 1
  const c = 2 * Math.PI * radius
  type Slice = { dash: number; offset: number; color: string; index: number }
  const slices: Slice[] = []
  let cumOffset = 0
  for (let i = 0; i < segs.length; i++) {
    const dash = (segs[i].value / total) * c
    slices.push({ dash, offset: cumOffset, color: segs[i].color, index: i })
    cumOffset += dash
  }
  return { slices, circumference: c }
}

function DonutChart({ segments }: { segments: Array<{ label: string; value: number; color: string }> }) {
  const R = 36
  const { slices, circumference } = buildDonutSlices(segments, R)
  const total = segments.reduce((s, x) => s + x.value, 0)

  return (
    <div className="flex items-center gap-8" data-testid="donut-chart">
      <svg viewBox="0 0 100 100" className="size-24 shrink-0">
        <circle cx={50} cy={50} r={R} fill="none" stroke="var(--border)" strokeWidth={10} />
        {slices.map((sl) => (
          <circle key={sl.index} cx={50} cy={50} r={R} fill="none"
            stroke={sl.color} strokeWidth={10}
            strokeDasharray={`${sl.dash} ${circumference - sl.dash}`}
            strokeDashoffset={-sl.offset}
            strokeLinecap="butt"
            transform="rotate(-90 50 50)"
          />
        ))}
        <text x={50} y={46} textAnchor="middle" fontSize={14} fontWeight="700" fill="var(--ink)" fontFamily="Space Grotesk, sans-serif">{total}</text>
        <text x={50} y={58} textAnchor="middle" fontSize={8} fill="var(--muted)" fontFamily="DM Sans, sans-serif">transfers</text>
      </svg>
      <ul className="space-y-2.5">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2.5 text-sm">
            <span className="size-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
            <span style={{ color: 'var(--muted)' }}>{s.label}</span>
            <span className="ml-auto tabular-nums font-semibold" style={{ color: 'var(--ink)' }}>{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

interface Props {
  transfers: LiveTransfer[]
  reqs: PaymentRequest[]
  address: Address
}

export default function Analytics({ transfers, reqs, address }: Props) {
  void address

  const stats = useMemo(() => {
    const totalIn  = transfers.filter((t) => t.direction === 'received').reduce((s, t) => s + t.amount, 0n)
    const totalOut = transfers.filter((t) => t.direction === 'sent').reduce((s, t) => s + t.amount, 0n)
    const net = totalIn >= totalOut
      ? { value: fmtNum(Number(fmtUsdc(totalIn - totalOut))),  positive: true }
      : { value: fmtNum(Number(fmtUsdc(totalOut - totalIn))), positive: false }
    const reqPaid    = reqs.filter((r) => r.status === 'paid').length
    const reqPending = reqs.filter((r) => r.status === 'pending').length
    const reqFailed  = reqs.filter((r) => r.status === 'expired' || r.status === 'cancelled').length
    return { totalIn, totalOut, net, reqPaid, reqPending, reqFailed }
  }, [transfers, reqs])

  const donutSegs = [
    { label: 'Received', value: transfers.filter((t) => t.direction === 'received').length, color: 'var(--success)' },
    { label: 'Sent',     value: transfers.filter((t) => t.direction === 'sent').length,     color: 'var(--danger)'  },
  ]

  const reqOutcomes = [
    { label: 'Paid',              value: stats.reqPaid,    color: 'var(--success)' },
    { label: 'Pending',           value: stats.reqPending, color: 'var(--violet)'  },
    { label: 'Expired/Cancelled', value: stats.reqFailed,  color: 'var(--muted)'   },
  ]
  const maxReq = Math.max(...reqOutcomes.map((r) => r.value), 1)

  const kpis = [
    { label: 'Received',  value: `$${fmtNum(Number(fmtUsdc(stats.totalIn)))}`,  color: 'var(--success)',  bg: 'var(--success-bg)',  border: 'var(--success-border)' },
    { label: 'Sent',      value: `$${fmtNum(Number(fmtUsdc(stats.totalOut)))}`, color: 'var(--danger)',   bg: 'var(--danger-bg)',   border: 'var(--danger-border)'  },
    { label: stats.net.positive ? 'Net Inflow' : 'Net Outflow', value: `$${stats.net.value}`,
      color: stats.net.positive ? 'var(--success)' : 'var(--danger)',
      bg: stats.net.positive ? 'var(--success-bg)' : 'var(--danger-bg)',
      border: stats.net.positive ? 'var(--success-border)' : 'var(--danger-border)',
    },
  ]

  return (
    <div className="space-y-5" data-testid="analytics-page">
      <div>
        <h1 className="display text-2xl font-bold" style={{ color: 'var(--ink)', letterSpacing: '-0.025em' }}>Analytics</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>Derived from your live on-chain activity</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl p-4"
            style={{ background: k.bg, border: `1px solid ${k.border}` }}
            data-testid="kpi-card">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: k.color }}>{k.label}</p>
            <p className="display mt-2 text-xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>{k.value}</p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>USDC</p>
          </div>
        ))}
      </div>

      {/* Volume bar chart */}
      <div style={card} className="p-5">
        <h2 className="mb-4 text-sm font-semibold" style={{ color: 'var(--ink)' }}>Volume by Block Range</h2>
        <BarChart transfers={transfers} />
      </div>

      {/* Direction donut */}
      <div style={card} className="p-5">
        <h2 className="mb-4 text-sm font-semibold" style={{ color: 'var(--ink)' }}>Transaction Breakdown</h2>
        <DonutChart segments={donutSegs} />
      </div>

      {/* Request outcomes */}
      {reqs.length > 0 && (
        <div style={card} className="p-5" data-testid="req-outcomes">
          <h2 className="mb-4 text-sm font-semibold" style={{ color: 'var(--ink)' }}>Request Outcomes</h2>
          <div className="space-y-4">
            {reqOutcomes.map((r) => (
              <div key={r.label}>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span style={{ color: 'var(--muted)' }}>{r.label}</span>
                  <span className="tabular-nums font-semibold" style={{ color: 'var(--ink)' }}>{r.value}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
                  <div className="h-full rounded-full"
                    style={{ background: r.color, width: `${(r.value / maxReq) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

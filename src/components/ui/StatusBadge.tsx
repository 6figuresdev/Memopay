import type { TxStatus, RequestStatus } from '@/data/types'

type AnyStatus = TxStatus | RequestStatus

const CONFIG: Record<AnyStatus, { label: string; bg: string; color: string }> = {
  completed: { label: 'Completed', bg: 'rgba(26,128,71,0.10)', color: 'var(--success)' },
  paid:      { label: 'Paid',      bg: 'rgba(26,128,71,0.10)', color: 'var(--success)' },
  pending:   { label: 'Pending',   bg: 'rgba(245,158,11,0.12)', color: '#b45309' },
  processing:{ label: 'Processing',bg: 'rgba(59,130,246,0.10)', color: '#1d4ed8' },
  failed:    { label: 'Failed',    bg: 'rgba(186,43,76,0.10)', color: 'var(--danger)' },
  expired:   { label: 'Expired',   bg: 'rgba(107,101,128,0.12)', color: 'var(--muted)' },
  cancelled: { label: 'Cancelled', bg: 'rgba(107,101,128,0.12)', color: 'var(--muted)' },
}

export default function StatusBadge({ status }: { status: AnyStatus }) {
  const c = CONFIG[status] ?? CONFIG.pending
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ background: c.bg, color: c.color }}
      data-testid={`status-badge-${status}`}
    >
      <span
        className="size-1.5 rounded-full"
        style={{ background: c.color, display: 'inline-block' }}
      />
      {c.label}
    </span>
  )
}

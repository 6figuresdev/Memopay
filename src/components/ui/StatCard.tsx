import type { ReactNode } from 'react'

interface StatCardProps {
  label: string
  value: string
  sub?: string
  icon: ReactNode
  iconBg: string
  trend?: { value: string; positive: boolean }
}

const glass = {
  card: {
    background: 'var(--surface)',
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    border: '1px solid var(--border)',
    borderRadius: '20px',
  } as React.CSSProperties,
}

export default function StatCard({ label, value, sub, icon, iconBg, trend }: StatCardProps) {
  return (
    <div style={glass.card} className="p-4" data-testid="stat-card">
      <div className="mb-3 flex items-center justify-between">
        <div
          className="flex size-9 items-center justify-center rounded-xl"
          style={{ background: iconBg }}
        >
          {icon}
        </div>
        {trend && (
          <span
            className="text-xs font-semibold"
            style={{ color: trend.positive ? 'var(--success)' : 'var(--danger)' }}
          >
            {trend.positive ? '↑' : '↓'} {trend.value}
          </span>
        )}
      </div>
      <div
        className="display mb-0.5 text-2xl font-bold tabular-nums"
        style={{ color: 'var(--ink)' }}
      >
        {value}
      </div>
      <div className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
        {label}
      </div>
      {sub && (
        <div className="mt-1 text-xs" style={{ color: 'var(--subtle)' }}>
          {sub}
        </div>
      )}
    </div>
  )
}

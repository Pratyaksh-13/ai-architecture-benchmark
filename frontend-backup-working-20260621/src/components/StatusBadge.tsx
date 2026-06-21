type Status = 'pending' | 'generating' | 'done' | 'failed'

interface StatusBadgeProps {
  status: Status
  size?: 'sm' | 'md'
}

const config: Record<Status, { label: string; classes: string; dot?: boolean }> = {
  pending: {
    label: 'pending',
    classes: 'border border-graphite/40 text-graphite bg-transparent',
  },
  generating: {
    label: 'generating',
    classes: 'border border-blueprint/50 text-blueprint bg-blueprint/5',
    dot: true,
  },
  done: {
    label: 'done',
    classes: 'border border-ink/40 text-ink bg-transparent',
  },
  failed: {
    label: 'failed',
    classes: 'border border-annotation/50 text-annotation bg-annotation/5',
  },
}

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const { label, classes, dot } = config[status] ?? config.pending
  const sizeClasses = size === 'sm' ? 'text-[9px] px-2 py-0.5' : 'text-[11px] px-2.5 py-1'

  return (
    <span className={`inline-flex items-center gap-1 rounded-sm font-mono font-medium tracking-wider uppercase ${sizeClasses} ${classes}`}>
      {dot && (
        <span className="w-1.5 h-1.5 rounded-full bg-blueprint animate-pulse-dot" />
      )}
      {label}
    </span>
  )
}


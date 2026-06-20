type Status = 'pending' | 'generating' | 'done' | 'failed'

interface StatusBadgeProps {
  status: Status
  size?: 'sm' | 'md'
}

const config: Record<Status, { label: string; classes: string; dot?: boolean }> = {
  pending: {
    label: 'pending',
    classes: 'bg-dark-600 text-slate-400 border border-dark-500',
  },
  generating: {
    label: 'generating',
    classes: 'bg-blue-950/60 text-blue-400 border border-blue-900/50',
    dot: true,
  },
  done: {
    label: 'done',
    classes: 'bg-teal-950/60 text-teal-400 border border-teal-900/50',
  },
  failed: {
    label: 'failed',
    classes: 'bg-red-950/60 text-red-400 border border-red-900/50',
  },
}

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const { label, classes, dot } = config[status] ?? config.pending
  const sizeClasses = size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1'

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold tracking-wide uppercase ${sizeClasses} ${classes}`}>
      {dot && (
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse-dot" />
      )}
      {label}
    </span>
  )
}

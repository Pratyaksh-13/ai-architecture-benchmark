// Reusable skeleton shimmer components for loading states

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`skeleton rounded-sm ${className}`} />
}

export function SkeletonCard() {
  return (
    <div className="bg-paper border border-hairline rounded-sm p-5 space-y-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
      <Skeleton className="h-3 w-4/6" />
      <Skeleton className="h-32 w-full mt-4 rounded-sm" />
      <div className="grid grid-cols-2 gap-3 pt-2">
        <div className="space-y-2">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-2.5 w-full" />
          <Skeleton className="h-2.5 w-5/6" />
          <Skeleton className="h-2.5 w-4/6" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-2.5 w-full" />
          <Skeleton className="h-2.5 w-5/6" />
          <Skeleton className="h-2.5 w-4/6" />
        </div>
      </div>
    </div>
  )
}

export function SkeletonRow() {
  return (
    <div className="bg-paper border border-hairline rounded-sm px-5 py-4 flex items-center justify-between gap-4">
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-5 w-16 rounded-sm" />
    </div>
  )
}

export function SkeletonStat() {
  return (
    <div className="bg-paper border border-hairline rounded-sm p-5">
      <Skeleton className="h-8 w-16 mb-2" />
      <Skeleton className="h-3 w-28" />
    </div>
  )
}


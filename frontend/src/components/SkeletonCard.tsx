// Reusable skeleton shimmer components for loading states

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`skeleton rounded ${className}`} />
}

export function SkeletonCard() {
  return (
    <div className="bg-dark-800 border border-dark-700 rounded-xl p-5 space-y-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
      <Skeleton className="h-3 w-4/6" />
      <Skeleton className="h-32 w-full mt-4 rounded-lg" />
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
    <div className="bg-dark-800 border border-dark-700 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-5 w-16 rounded-full" />
    </div>
  )
}

export function SkeletonStat() {
  return (
    <div className="bg-dark-800 border border-dark-700 rounded-xl p-5">
      <Skeleton className="h-8 w-16 mb-2" />
      <Skeleton className="h-3 w-28" />
    </div>
  )
}

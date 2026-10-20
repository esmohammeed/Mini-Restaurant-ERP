// Skeleton shown while the dashboard's server queries run.

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-gray-100 ${className}`} />;
}

export default function DashboardLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
      <SkeletonBlock className="h-8 w-64" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="card space-y-3">
            <SkeletonBlock className="h-4 w-24" />
            <SkeletonBlock className="h-8 w-28" />
            <SkeletonBlock className="h-3 w-32" />
          </div>
        ))}
      </div>

      <div className="card space-y-3">
        <SkeletonBlock className="h-4 w-48" />
        <SkeletonBlock className="h-56 w-full" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card space-y-3">
          <SkeletonBlock className="h-4 w-40" />
          <SkeletonBlock className="h-32 w-full" />
        </div>
        <div className="card space-y-3">
          <SkeletonBlock className="h-4 w-40" />
          <SkeletonBlock className="h-32 w-full" />
        </div>
      </div>

      <div className="card space-y-3">
        <SkeletonBlock className="h-4 w-32" />
        <SkeletonBlock className="h-40 w-full" />
      </div>
    </div>
  );
}

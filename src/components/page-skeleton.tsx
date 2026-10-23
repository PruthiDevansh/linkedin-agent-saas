// Shown instantly while a page loads, so every click gives feedback right away.
export function PageSkeleton() {
  const block = "animate-pulse rounded-2xl border border-border bg-surface";
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="mb-6 space-y-2">
        <div className="h-7 w-56 animate-pulse rounded-lg bg-surface-2" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded bg-surface-2" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className={`${block} h-24`} />)}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className={`${block} h-72 lg:col-span-2`} />
        <div className={`${block} h-72`} />
      </div>
    </div>
  );
}

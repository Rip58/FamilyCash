function Bar({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-full bg-surface-2 ${className}`} />;
}

export default function Loading() {
  return (
    <div className="pt-2" aria-busy="true" aria-label="Cargando">
      <div className="mb-3 flex h-11 items-center justify-between">
        <Bar className="h-8 w-8" />
        <Bar className="h-5 w-48" />
        <Bar className="h-8 w-8" />
      </div>
      <Bar className="mb-4 h-4 w-64" />
      {[4, 3, 2].map((rows, i) => (
        <div key={i} className="mb-3 rounded-card bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <Bar className="h-5 w-32" />
            <Bar className="h-5 w-8" />
          </div>
          {Array.from({ length: rows }).map((_, j) => (
            <div key={j} className="flex h-[52px] items-center">
              <Bar className="h-4 w-40" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

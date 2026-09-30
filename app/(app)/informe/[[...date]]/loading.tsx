export default function Loading() {
  return (
    <div className="animate-pulse space-y-3 pb-4 pt-4" aria-busy="true" aria-label="Cargando informe">
      <div className="flex items-center gap-2">
        <div className="h-11 w-11 rounded-full bg-surface" />
        <div className="mx-auto h-11 w-40 rounded-control bg-surface" />
        <div className="h-11 w-11 rounded-full bg-surface" />
      </div>
      <div className="h-11 rounded-control bg-surface" />
      <div className="h-28 rounded-card bg-surface" />
      <div className="h-48 rounded-card bg-surface" />
      <div className="h-48 rounded-card bg-surface" />
    </div>
  );
}

export default function Loading() {
  return (
    <div className="animate-pulse space-y-3 pb-4 pt-4" aria-busy="true" aria-label="Cargando historial">
      <div className="h-11 w-48 rounded-control bg-surface" />
      <div className="h-11 rounded-control bg-surface" />
      <div className="h-24 rounded-card bg-surface" />
      <div className="h-48 rounded-card bg-surface" />
    </div>
  );
}

/** Esqueleto genérico mientras carga una pantalla (feedback inmediato al cambiar de pestaña). */
export function PageSkeleton({ label, blocks = [96, 220, 160] }: { label: string; blocks?: number[] }) {
  return (
    <div className="animate-pulse space-y-3 pb-4 pt-4" aria-busy="true" aria-label={label}>
      <div className="h-9 w-40 rounded-control bg-surface" />
      <div className="h-11 rounded-control bg-surface" />
      {blocks.map((h, i) => (
        <div key={i} className="rounded-card bg-surface" style={{ height: h }} />
      ))}
    </div>
  );
}

export default function Loading() {
  return (
    <div className="animate-pulse pt-2" aria-busy="true" aria-label="Cargando semana">
      <div className="flex items-center justify-between gap-2">
        <div className="h-11 w-11 rounded-full bg-surface" />
        <div className="h-5 w-48 rounded bg-surface" />
        <div className="h-11 w-11 rounded-full bg-surface" />
      </div>
      <div className="mb-3 mt-2 flex gap-2">
        <div className="h-11 flex-1 rounded-control bg-surface" />
        <div className="h-11 w-11 rounded-full bg-surface" />
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="h-[96px] rounded-card bg-surface" />
        ))}
      </div>
    </div>
  );
}

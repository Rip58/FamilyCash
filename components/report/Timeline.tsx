import type { ReportSegment } from "@/lib/report";

const PALETTE = ["#2563eb", "#c2410c", "#0f766e", "#7c3aed", "#be123c", "#4d7c0f", "#a16207", "#0e7490"];

export function segmentColor(i: number): string {
  return PALETTE[i % PALETTE.length]!;
}

interface TimelineProps {
  segments: ReportSegment[];
  length: number;
  breakFrom: number;
  breakTo: number;
}

/** Barra horizontal proporcional al turno, con el descanso sombreado. */
export function Timeline({ segments, length, breakFrom, breakTo }: TimelineProps) {
  const pct = (m: number) => `${(m / length) * 100}%`;
  return (
    <div
      className="relative h-7 w-full overflow-hidden rounded-[8px] bg-surface-2"
      role="img"
      aria-label={segments.map((s) => `${s.start} a ${s.end} ${s.label}`).join(", ")}
    >
      {segments.map((s, i) => (
        <div
          key={i}
          className="absolute inset-y-0 flex items-center overflow-hidden border-r border-surface px-1.5 text-[11px] font-semibold leading-none text-white"
          style={{ left: pct(s.relStart), width: pct(s.relEnd - s.relStart), backgroundColor: segmentColor(s.colorIndex) }}
        >
          <span className="truncate">{s.label}</span>
        </div>
      ))}
      {breakTo > breakFrom && (
        <div
          aria-hidden
          className="absolute inset-y-0"
          style={{
            left: pct(breakFrom),
            width: pct(breakTo - breakFrom),
            background: "repeating-linear-gradient(135deg, rgba(120,120,128,0.55) 0 3px, rgba(120,120,128,0.2) 3px 6px)",
          }}
        />
      )}
    </div>
  );
}

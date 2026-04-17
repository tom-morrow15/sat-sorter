import { useMemo } from 'react';

export interface GaugeSegment {
  /** Unique id for this segment (usually bucket id). */
  id: string;
  /** Relative weight of the segment — segments are normalized to fill the arc. */
  value: number;
  /** Fill color (hex or CSS color). */
  color: string;
}

interface SpendingGaugeProps {
  segments: GaugeSegment[];
  /** Size of the SVG in CSS pixels. Height ends up ~half of this. */
  size?: number;
  /** Stroke thickness of the arc. */
  thickness?: number;
  /** Gap (in degrees) between neighboring segments. */
  gap?: number;
  /** Content rendered centered inside the semi-circle. */
  children?: React.ReactNode;
}

/**
 * Convert polar coordinates (in degrees, 0° = right, counter-clockwise +) to
 * SVG Cartesian coords anchored at (cx, cy). SVG y grows downward so we negate
 * sin to keep the math intuitive (positive angles go upward on screen).
 */
function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy - r * Math.sin(rad),
  };
}

/** Build an SVG arc path between two angles (in degrees). Drawn clockwise. */
function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polar(cx, cy, r, startDeg);
  const end = polar(cx, cy, r, endDeg);
  const sweep = Math.abs(endDeg - startDeg);
  const largeArc = sweep > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

/**
 * Semi-circular gauge that ALWAYS fills a full 180° arc, split proportionally
 * between its segments — matches the Dollarwise spending-breakdown look.
 */
export function SpendingGauge({
  segments,
  size = 320,
  thickness = 22,
  gap = 3,
  children,
}: SpendingGaugeProps) {
  // A half-circle of radius r is a rectangle of width 2r and height r. We need
  // a little padding around it so the stroke's round caps aren't clipped.
  const pad = Math.ceil(thickness / 2) + 2;
  const viewW = size + pad * 2;
  const viewH = Math.round(size / 2) + pad * 2;
  const cx = viewW / 2;
  const cy = pad + Math.round(size / 2); // baseline of the arc
  const r = size / 2 - pad;

  // Arc sweeps from 180° (left) clockwise to 0° (right).
  const ARC_START = 180;
  const ARC_END = 0;
  const ARC_SWEEP = ARC_START - ARC_END; // 180

  const paths = useMemo(() => {
    const positive = segments.filter((s) => s.value > 0);
    const total = positive.reduce((sum, s) => sum + s.value, 0);
    if (total <= 0 || positive.length === 0) return [];

    // Reserve a small gap between neighbors — but never more arc than we have.
    const totalGap = Math.min((positive.length - 1) * gap, ARC_SWEEP - 1);
    const available = ARC_SWEEP - totalGap;

    let cursor = ARC_START;
    const out: Array<{ id: string; d: string; color: string }> = [];

    positive.forEach((seg, i) => {
      const share = seg.value / total;
      const segSweep = share * available;
      const start = cursor;
      const end = cursor - segSweep; // clockwise => decreasing degrees
      if (segSweep > 0.01) {
        out.push({ id: seg.id, color: seg.color, d: arcPath(cx, cy, r, start, end) });
      }
      // Apply gap between segments (not after the last one).
      cursor = end - (i < positive.length - 1 ? gap : 0);
    });

    return out;
  }, [segments, cx, cy, r, gap]);

  const trackPath = arcPath(cx, cy, r, ARC_START, ARC_END);
  const hasData = paths.length > 0;

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${viewW} ${viewH}`}
        preserveAspectRatio="xMidYMid meet"
        className="block w-full h-auto"
        role="img"
        aria-label="Spending breakdown gauge"
      >
        {/* Track (always a full semi-circle) */}
        <path
          d={trackPath}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={thickness}
          strokeLinecap="round"
          opacity={hasData ? 0.4 : 0.25}
        />

        {/* Colored segments, drawn over the track */}
        {paths.map((p) => (
          <path
            key={p.id}
            d={p.d}
            fill="none"
            stroke={p.color}
            strokeWidth={thickness}
            strokeLinecap="round"
          />
        ))}
      </svg>

      {/* Center content — absolutely positioned inside the semi-circle area.
          Using percentages based on the SVG viewBox so it scales perfectly with
          the responsive SVG. */}
      <div
        className="absolute inset-x-0 flex items-end justify-center pointer-events-none"
        style={{
          // Top of the half-circle area:
          top: `${(pad / viewH) * 100}%`,
          // Bottom sits at the arc baseline so children hug the inside of the arc.
          height: `${((cy - pad) / viewH) * 100}%`,
        }}
      >
        <div className="text-center px-6 pb-1 w-full max-w-[75%]">{children}</div>
      </div>
    </div>
  );
}

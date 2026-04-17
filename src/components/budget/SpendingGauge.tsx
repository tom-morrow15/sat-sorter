import { useMemo } from 'react';

export interface GaugeSegment {
  /** Unique id for this segment (usually bucket id). */
  id: string;
  /** Value to draw — how large this slice is relative to the others. */
  value: number;
  /** Fill color (hex or CSS color). */
  color: string;
}

interface SpendingGaugeProps {
  segments: GaugeSegment[];
  /** Optional: overall "capacity". If provided and total < capacity, the arc
   *  will be partially filled. If omitted, segments fill the entire arc. */
  capacity?: number;
  /** Size of the SVG in CSS pixels (square-ish; height is ~half of width). */
  size?: number;
  /** Stroke thickness of the arc. */
  thickness?: number;
  /** Gap (in degrees) between neighboring segments. */
  gap?: number;
  /** Content rendered centered below the arc (the headline number area). */
  children?: React.ReactNode;
}

/**
 * Convert polar coordinates (in degrees, 0deg = right, counter-clockwise +) to
 * SVG Cartesian, anchored at (cx, cy). Note SVG y-axis grows downward so we
 * negate sin to keep math intuitive (positive angles go upward).
 */
function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy - r * Math.sin(rad),
  };
}

/** Build an SVG arc path between two angles (in degrees). */
function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polar(cx, cy, r, startDeg);
  const end = polar(cx, cy, r, endDeg);
  const sweep = Math.abs(endDeg - startDeg);
  const largeArc = sweep > 180 ? 1 : 0;
  // Counter-clockwise in our math = clockwise in SVG coords because we flipped y.
  // We draw from start -> end going clockwise in the display.
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

export function SpendingGauge({
  segments,
  capacity,
  size = 320,
  thickness = 22,
  gap = 3,
  children,
}: SpendingGaugeProps) {
  const width = size;
  // Half-circle plus a bit of headroom for the stroke cap.
  const height = Math.round(size / 2 + thickness);
  const cx = width / 2;
  const cy = Math.round(size / 2 + thickness / 2);
  const r = (size - thickness) / 2;

  // Arc goes from 180° (left) to 0° (right) — top semicircle.
  const ARC_START = 180;
  const ARC_END = 0;
  const ARC_SWEEP = ARC_START - ARC_END; // 180

  const { total, effectiveCapacity, paths } = useMemo(() => {
    const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);
    const effectiveCapacity = capacity && capacity > total ? capacity : total;

    if (effectiveCapacity <= 0) {
      return { total, effectiveCapacity, paths: [] as Array<{ id: string; d: string; color: string }> };
    }

    // How much of the 180° arc is "filled" by real spending.
    const filledSweep = (total / effectiveCapacity) * ARC_SWEEP;

    // Leave a tiny gap between segments (but never consume more arc than we have).
    const gaps = Math.max(0, segments.length - 1) * gap;
    const available = Math.max(0, filledSweep - gaps);

    let cursor = ARC_START;
    const paths: Array<{ id: string; d: string; color: string }> = [];

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const share = total > 0 ? Math.max(0, seg.value) / total : 0;
      const segSweep = share * available;
      const start = cursor;
      const end = cursor - segSweep; // clockwise => decreasing degrees
      if (segSweep > 0.01) {
        paths.push({
          id: seg.id,
          color: seg.color,
          d: arcPath(cx, cy, r, start, end),
        });
      }
      cursor = end - gap;
    }

    return { total, effectiveCapacity, paths };
  }, [segments, capacity, cx, cy, r, gap]);

  // Background track (always the full half-circle).
  const trackPath = arcPath(cx, cy, r, ARC_START, ARC_END);

  return (
    <div className="relative w-full flex flex-col items-center">
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Spending breakdown gauge"
      >
        {/* Track */}
        <path
          d={trackPath}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={thickness}
          strokeLinecap="round"
          opacity={0.5}
        />

        {/* Filled segments */}
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

        {/* If there are no segments, show a subtle dashed outline to hint at the shape. */}
        {total === 0 && (
          <path
            d={trackPath}
            fill="none"
            stroke="hsl(var(--muted-foreground))"
            strokeWidth={1}
            strokeDasharray="4 4"
            opacity={0.3}
          />
        )}
      </svg>

      {/* Center content sits visually inside the half-circle. */}
      <div
        className="absolute inset-x-0 flex flex-col items-center justify-end pointer-events-none"
        style={{ top: 0, height: `${cy}px` }}
      >
        <div className="text-center px-4 pb-1">{children}</div>
      </div>

      {/* Capacity hint: tiny labels at each end of the arc when capacity is known. */}
      {capacity && capacity > 0 && effectiveCapacity > 0 && (
        <div
          className="absolute inset-x-0 flex justify-between text-[10px] text-muted-foreground font-medium tabular-nums px-2"
          style={{ top: `${cy + thickness / 2 + 2}px` }}
        >
          <span>$0</span>
          <span className="opacity-70">of ${Math.round(capacity).toLocaleString()} budget</span>
          <span>${Math.round(capacity).toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}

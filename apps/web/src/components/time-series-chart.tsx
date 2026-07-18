"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type ChartType = "bar" | "line";
export type ChartTone = "primary" | "warning" | "critical";

export interface ChartPoint {
  timestamp: number;
  value: number;
}

const TONE_STROKE: Record<ChartTone, string> = {
  primary: "var(--success-dot)",
  warning: "var(--warning-dot)",
  critical: "var(--critical-dot)",
};

const TONE_TEXT: Record<ChartTone, string> = {
  primary: "text-success-fg",
  warning: "text-warning-fg",
  critical: "text-critical-fg",
};

const WIDTH = 600;
const HEIGHT = 140;
const PADDING_X = 4;
const PADDING_TOP = 10;
const PADDING_BOTTOM = 4;

export function TimeSeriesChart({
  title,
  currentValue,
  points,
  type,
  tone = "primary",
  emptyLabel = "No data yet",
  valueFormatter = (v) => String(v),
}: {
  title: string;
  currentValue: string;
  points: ChartPoint[];
  type: ChartType;
  tone?: ChartTone;
  emptyLabel?: string;
  valueFormatter?: (v: number) => string;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const max = Math.max(1, ...points.map((p) => p.value));
  const plotWidth = WIDTH - PADDING_X * 2;
  const plotHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM;

  const xFor = (i: number) =>
    points.length <= 1
      ? WIDTH / 2
      : PADDING_X + (i / (points.length - 1)) * plotWidth;
  const yFor = (v: number) => PADDING_TOP + plotHeight - (v / max) * plotHeight;

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${xFor(i)},${yFor(p.value)}`)
    .join(" ");
  const areaPath =
    points.length > 0
      ? `${linePath} L${xFor(points.length - 1)},${HEIGHT - PADDING_BOTTOM} L${xFor(0)},${HEIGHT - PADDING_BOTTOM} Z`
      : "";

  const barWidth = points.length > 0 ? plotWidth / points.length : 0;

  const hovered = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div className="rounded-[10px] border border-border bg-card p-[18px]">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[13.5px] font-bold">{title}</h3>
        <span className={cn("font-mono text-[13px] font-semibold", TONE_TEXT[tone])}>
          {currentValue}
        </span>
      </div>

      <div className="relative mt-3">
        {points.length === 0 ? (
          <div className="flex h-[140px] items-center justify-center">
            <p className="text-[11px] text-muted-foreground">{emptyLabel}</p>
          </div>
        ) : (
          <>
            <svg
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              className="h-[140px] w-full"
              preserveAspectRatio="none"
              onMouseLeave={() => setHoverIndex(null)}
            >
              {type === "bar" &&
                points.map((p, i) => (
                  <rect
                    key={i}
                    x={PADDING_X + i * barWidth + barWidth * 0.15}
                    y={yFor(p.value)}
                    width={Math.max(1, barWidth * 0.7)}
                    height={Math.max(1, HEIGHT - PADDING_BOTTOM - yFor(p.value))}
                    fill={TONE_STROKE[tone]}
                    opacity={hoverIndex === null || hoverIndex === i ? 0.85 : 0.35}
                  />
                ))}

              {type === "line" && (
                <>
                  <path d={areaPath} fill={TONE_STROKE[tone]} opacity={0.12} stroke="none" />
                  <path
                    d={linePath}
                    fill="none"
                    stroke={TONE_STROKE[tone]}
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                  />
                  {hovered && (
                    <circle
                      cx={xFor(hoverIndex!)}
                      cy={yFor(hovered.value)}
                      r={3.5}
                      fill={TONE_STROKE[tone]}
                    />
                  )}
                </>
              )}

              {hoverIndex !== null && (
                <line
                  x1={xFor(hoverIndex)}
                  x2={xFor(hoverIndex)}
                  y1={PADDING_TOP}
                  y2={HEIGHT - PADDING_BOTTOM}
                  stroke="var(--border)"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
              )}

              {/* Invisible hover targets, one per sample */}
              {points.map((_, i) => (
                <rect
                  key={`hit-${i}`}
                  x={PADDING_X + i * barWidth}
                  y={0}
                  width={Math.max(1, barWidth)}
                  height={HEIGHT}
                  fill="transparent"
                  onMouseEnter={() => setHoverIndex(i)}
                />
              ))}
            </svg>

            {hovered && (
              <div
                className="pointer-events-none absolute top-0 rounded-md border border-border bg-popover px-2 py-1 text-[11px] shadow-md"
                style={{
                  left: `${(xFor(hoverIndex!) / WIDTH) * 100}%`,
                  transform:
                    hoverIndex! < points.length / 2
                      ? "translateX(4px)"
                      : "translateX(calc(-100% - 4px))",
                }}
              >
                <p className="font-mono font-semibold">{valueFormatter(hovered.value)}</p>
                <p className="text-muted-foreground">
                  {new Date(hovered.timestamp).toLocaleTimeString()}
                </p>
              </div>
            )}

            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span>{new Date(points[0].timestamp).toLocaleTimeString()}</span>
              <span>{new Date(points[points.length - 1].timestamp).toLocaleTimeString()}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import * as React from "react";

export interface ChartBarDatum {
  label: string;
  value: number;
  formattedValue: string;
  tone?: "brand" | "success" | "danger" | "info" | "neutral";
  hint?: string;
}

const TONE_GRADIENTS: Record<
  NonNullable<ChartBarDatum["tone"]>,
  { from: string; to: string; dot: string }
> = {
  brand: { from: "#FF8533", to: "#FF6A00", dot: "bg-[#FF6A00]" },
  success: { from: "#34D399", to: "#10B981", dot: "bg-[#10B981]" },
  danger: { from: "#F87171", to: "#DC2626", dot: "bg-[#DC2626]" },
  info: { from: "#60A5FA", to: "#2563EB", dot: "bg-[#2563EB]" },
  neutral: { from: "#9CA3AF", to: "#6B7280", dot: "bg-[#6B7280]" },
};

export function MetricBarChart({
  title,
  subtitle,
  data,
  height = 180,
}: {
  title: string;
  subtitle?: string;
  data: ChartBarDatum[];
  height?: number;
}) {
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);
  const maxVal = Math.max(1, ...data.map((d) => Math.max(0, d.value)));

  const activeDatum =
    hoveredIndex !== null ? data[hoveredIndex] : data[0] ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display text-sm sm:text-base font-extrabold tracking-tight text-[var(--foreground)]">
            {title}
          </h3>
          {subtitle && (
            <p className="text-[11px] text-[var(--foreground-secondary)] mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
        {activeDatum && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--warm)] px-3 py-1.5 text-right backdrop-blur-sm transition-all duration-200">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--foreground-secondary)]">
              {activeDatum.label}
            </p>
            <p className="font-mono text-xs sm:text-sm font-extrabold text-[var(--foreground)]">
              {activeDatum.formattedValue}
            </p>
          </div>
        )}
      </div>

      {/* Responsive SVG Bar Chart with minimal gridlines */}
      <div
        className="relative w-full select-none"
        style={{ height: `${height}px` }}
      >
        {/* Minimal horizontal gridlines */}
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between pb-7">
          {[0, 1, 2, 3].map((line) => (
            <div
              key={line}
              className="w-full border-b border-dashed border-[var(--border)]"
            />
          ))}
        </div>

        <div className="relative z-10 flex h-full items-end justify-between gap-2 sm:gap-4 pt-2 pb-7">
          {data.map((item, idx) => {
            const pct = Math.max(4, Math.min(100, (Math.max(0, item.value) / maxVal) * 100));
            const tone = item.tone ?? "brand";
            const palette = TONE_GRADIENTS[tone];
            const isHovered = hoveredIndex === idx;

            return (
              <div
                key={item.label}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => setHoveredIndex(idx)}
                className="group relative flex h-full flex-1 flex-col items-center justify-end cursor-pointer"
              >
                {/* Floating Tooltip */}
                <div
                  className={`pointer-events-none absolute -top-1 z-20 whitespace-nowrap rounded-lg border border-[var(--border-strong)] bg-[var(--surface-solid)] px-2 py-1 text-[10px] font-mono font-bold text-[var(--foreground)] shadow-md transition-all duration-150 ${
                    isHovered
                      ? "opacity-100 -translate-y-1"
                      : "opacity-0 translate-y-0"
                  }`}
                >
                  {item.formattedValue}
                </div>

                {/* Bar Track + Gradient Column */}
                <div className="relative flex h-full w-full max-w-[44px] items-end justify-center rounded-xl bg-[var(--warm)]/60 p-1">
                  <div
                    className="w-full rounded-lg transition-all duration-500 ease-out"
                    style={{
                      height: `${pct}%`,
                      background: `linear-gradient(180deg, ${palette.from} 0%, ${palette.to} 100%)`,
                      opacity: hoveredIndex !== null && !isHovered ? 0.55 : 1,
                      boxShadow: isHovered
                        ? `0 6px 18px -4px ${palette.to}66`
                        : "inset 0 1px 0 rgba(255,255,255,0.28)",
                    }}
                  />
                </div>

                {/* X-Axis Label */}
                <span className="absolute -bottom-6 w-full truncate text-center text-[10px] sm:text-[11px] font-semibold text-[var(--foreground-secondary)]">
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 border-t border-[var(--border)]">
        {data.map((item, idx) => {
          const palette = TONE_GRADIENTS[item.tone ?? "brand"];
          return (
            <button
              key={item.label}
              type="button"
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={() => setHoveredIndex(idx)}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--foreground-secondary)] hover:text-[var(--foreground)] transition cursor-pointer"
            >
              <span className={`h-2 w-2 rounded-full ${palette.dot}`} />
              <span>{item.label}:</span>
              <span className="font-mono font-bold text-[var(--foreground)]">
                {item.formattedValue}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function AllocationStackedBar({
  title,
  segments,
}: {
  title: string;
  segments: ChartBarDatum[];
}) {
  const [activeIdx, setActiveIdx] = React.useState<number | null>(null);
  const total = Math.max(
    1,
    segments.reduce((sum, s) => sum + Math.max(0, s.value), 0)
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold text-[var(--foreground-secondary)] uppercase tracking-wider">
          {title}
        </span>
        {activeIdx !== null && segments[activeIdx] && (
          <span className="font-mono text-xs font-bold text-[var(--foreground)]">
            {segments[activeIdx].label}: {segments[activeIdx].formattedValue} (
            {Math.round(
              (Math.max(0, segments[activeIdx].value) / total) * 100
            )}
            %)
          </span>
        )}
      </div>

      <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-[var(--warm)] p-0.5 border border-[var(--border)]">
        {segments.map((seg, idx) => {
          const widthPct = Math.max(
            seg.value > 0 ? 3 : 0,
            (Math.max(0, seg.value) / total) * 100
          );
          const palette = TONE_GRADIENTS[seg.tone ?? "brand"];
          if (widthPct === 0) return null;
          return (
            <div
              key={seg.label}
              onMouseEnter={() => setActiveIdx(idx)}
              onMouseLeave={() => setActiveIdx(null)}
              className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-300 cursor-pointer"
              style={{
                width: `${widthPct}%`,
                background: `linear-gradient(90deg, ${palette.from}, ${palette.to})`,
                opacity: activeIdx !== null && activeIdx !== idx ? 0.5 : 1,
              }}
              title={`${seg.label}: ${seg.formattedValue}`}
            />
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {segments.map((seg, idx) => {
          const palette = TONE_GRADIENTS[seg.tone ?? "brand"];
          const pct = Math.round((Math.max(0, seg.value) / total) * 100);
          return (
            <div
              key={seg.label}
              onMouseEnter={() => setActiveIdx(idx)}
              onMouseLeave={() => setActiveIdx(null)}
              className="flex items-center gap-1.5 text-[11px] cursor-default"
            >
              <span className={`h-2 w-2 rounded-full ${palette.dot}`} />
              <span className="text-[var(--foreground-secondary)]">
                {seg.label}
              </span>
              <span className="font-mono font-bold text-[var(--foreground)]">
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

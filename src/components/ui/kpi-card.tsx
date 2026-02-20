import type { KeyboardEvent } from "react";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";

export type KpiCardColor = "indigo" | "orange" | "amber" | "emerald";

const HEADER_BG_BY_COLOR: Record<KpiCardColor, string> = {
  indigo: "#4E56C0",
  orange: "#9B5DE0",
  amber: "#D78FEE",
  emerald: "#FDCFFA",
};

type KpiTrend = {
  value: number | null;
  label?: string;
  windowDays?: number;
};

export type KpiCardProps = {
  title: string;
  mainValue: string;
  color: KpiCardColor;
  subtitle?: string;
  trend?: KpiTrend;
  onClick?: () => void;
  className?: string;
};

export function KpiCard({
  title,
  mainValue,
  color,
  subtitle,
  trend,
  onClick,
  className,
}: KpiCardProps) {
  const headerBgHex = HEADER_BG_BY_COLOR[color];
  const clickable = typeof onClick === "function";

  const hasTrend = Boolean(trend);
  const trendValue = trend?.value ?? null;
  const trendIsPositive = (trendValue ?? 0) >= 0;
  const trendAbsPercent = trendValue !== null ? Math.abs(trendValue) : 0;
  const trendPercentLabel =
    trendValue === null
      ? "—"
      : `${trendIsPositive ? "+" : "-"} ${trendAbsPercent.toFixed(1).replace(".", ",")}%`;
  const trendLabel = trend?.label?.trim() || `vs ${trend?.windowDays ?? 30} derniers jours`;
  const trendPillClasses =
    trendValue === null
      ? "bg-slate-100 text-slate-500"
      : trendIsPositive
      ? "bg-emerald-100 text-emerald-700"
      : "bg-red-100 text-red-700";

  const TrendIcon = trendIsPositive ? ArrowUpRight : ArrowDownRight;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!clickable) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onClick?.();
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.16)]",
        clickable && "cursor-pointer",
        className
      )}
      {...(clickable
        ? {
            role: "button",
            tabIndex: 0,
            onClick,
            onKeyDown: handleKeyDown,
          }
        : {})}
    >
      <div
        className="flex h-12 w-full items-center rounded-t-3xl px-5"
        style={{ backgroundColor: headerBgHex }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
          {title}
        </p>
      </div>

      <div className="rounded-b-3xl bg-white px-5 pb-4 pt-3">
        <div className="flex items-end justify-between gap-2">
          <span className="text-3xl font-semibold leading-none text-slate-900">{mainValue}</span>

          {hasTrend ? (
            <div className="flex flex-col items-end gap-1">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-medium",
                  trendPillClasses
                )}
              >
                {trendValue !== null ? <TrendIcon className="h-3 w-3" aria-hidden="true" /> : null}
                <span>{trendPercentLabel}</span>
              </span>
              <span className="text-[10px] text-slate-400">{trendLabel}</span>
            </div>
          ) : subtitle ? (
            <span className="text-right text-[11px] text-slate-500">{subtitle}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

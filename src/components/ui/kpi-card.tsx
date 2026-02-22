import type { KeyboardEvent, ReactNode } from "react";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";

export type KpiCardColor = "indigo" | "azure" | "sky" | "emerald";

const HEADER_BG_BY_COLOR: Record<KpiCardColor, string> = {
  indigo: "#3B82F6",
  azure: "#0284C7",
  sky: "#38BDF8",
  emerald: "#22C55E",
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
  variant?: "default" | "neutral";
  icon?: ReactNode;
  iconGradientClassName?: string;
};

export function KpiCard({
  title,
  mainValue,
  color,
  subtitle,
  trend,
  onClick,
  className,
  variant = "default",
  icon,
  iconGradientClassName,
}: KpiCardProps) {
  const headerBgHex = HEADER_BG_BY_COLOR[color];
  const clickable = typeof onClick === "function";
  const isNeutral = variant === "neutral";
  const iconGradient = iconGradientClassName?.trim() || "from-sky-700 to-blue-500";

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
        "relative overflow-hidden rounded-[28px] border border-white/75 bg-white/94 shadow-[0_16px_32px_rgba(15,23,42,0.1)]",
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
      {!isNeutral ? (
        <div
          className="flex h-3 w-full items-center rounded-t-[28px]"
          style={{ backgroundColor: headerBgHex }}
        />
      ) : null}

      <div
        className={cn(
          "bg-white px-5 pb-5",
          isNeutral ? "rounded-[28px] pt-5" : "rounded-b-[28px] pt-4"
        )}
      >
        {isNeutral ? (
          <div className="mb-3 flex items-center gap-2.5">
            {icon ? (
              <span
                className={cn(
                  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-white shadow-[0_8px_18px_rgba(2,132,199,0.25)]",
                  iconGradient
                )}
              >
                {icon}
              </span>
            ) : null}
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              {title}
            </p>
          </div>
        ) : (
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            {title}
          </p>
        )}
        <div className="flex items-end justify-between gap-2">
          <span className="text-4xl font-light leading-none tracking-tight text-slate-900 md:text-5xl">
            {mainValue}
          </span>

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
              <span className="text-[10px] tracking-[0.04em] text-slate-400">{trendLabel}</span>
            </div>
          ) : subtitle ? (
            <span className="text-right text-[11px] text-slate-500">{subtitle}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

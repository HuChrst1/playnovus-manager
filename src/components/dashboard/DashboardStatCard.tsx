"use client";
"use client";

import * as React from "react";

import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type DashboardStatCardColor = "indigo" | "orange" | "amber" | "emerald";

export type DashboardStatCardProps = {
  title: string;
  mainValue: string;
  trendPercent: number | null;
  color: DashboardStatCardColor;
  windowDays?: number;

  // pour la suite : ouvrir la pop-up de période
  onClick?: () => void;
  windowLabel?: string; // ex: "vs 3 derniers mois"
};

export function DashboardStatCard({
  title,
  mainValue,
  trendPercent,
  color,
  windowDays = 30,
  onClick,
  windowLabel,
}: DashboardStatCardProps) {
  const headerBgHex =
    color === "indigo"
      ? "#4E56C0"
      : color === "orange"
      ? "#9B5DE0"
      : color === "amber"
      ? "#D78FEE"
      : "#FDCFFA";

  const hasTrend = trendPercent !== null;
  const isPositive = (trendPercent ?? 0) >= 0;
  const absPercent = trendPercent !== null ? Math.abs(trendPercent) : 0;

  const percentLabel =
    trendPercent === null
      ? "—"
      : `${isPositive ? "+" : "-"} ${absPercent
          .toFixed(1)
          .replace(".", ",")}%`;

  const TrendIcon = isPositive ? ArrowUpRight : ArrowDownRight;

  const pillClasses = hasTrend
    ? isPositive
      ? "bg-emerald-100 text-emerald-700"
      : "bg-red-100 text-red-700"
    : "bg-slate-100 text-slate-500";

  const clickable = typeof onClick === "function";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.16)]",
        clickable && "cursor-pointer"
      )}
      {...(clickable
        ? {
            role: "button",
            tabIndex: 0,
            onClick,
            onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            },
          }
        : {})}
    >
      {/* Bandeau coloré avec le titre */}
      <div
        className="h-12 w-full flex items-center px-5 rounded-t-3xl"
        style={{ backgroundColor: headerBgHex }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
          {title}
        </p>
      </div>

      {/* Contenu blanc de la carte */}
      <div className="px-5 pb-4 pt-3 bg-white rounded-b-3xl">
        <div className="flex items-end justify-between gap-2">
          <span className="text-3xl font-semibold text-slate-900 leading-none">
            {mainValue}
          </span>

          <div className="flex flex-col items-end gap-1">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-medium",
                pillClasses
              )}
            >
              {hasTrend && (
                <TrendIcon className="h-3 w-3" aria-hidden="true" />
              )}
              <span>{percentLabel}</span>
            </span>
            <span className="text-[10px] text-slate-400">
                vs {windowDays} derniers jours
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
"use client";

import { useEffect, useState, useTransition, FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type SalesStatCardWithDialogProps = {
  id: "net" | "margin" | "rate" | "sets" | "pieces";
  title: string;
  mainValue: string;
  trendPercent: number | null;
  color: "indigo" | "orange" | "amber" | "emerald";
  /** Fenêtre actuellement appliquée côté serveur (en jours) */
  windowDays: number;
};

const headerBgByColor: Record<SalesStatCardWithDialogProps["color"], string> = {
  indigo: "#4E56C0",
  orange: "#9B5DE0",
  amber: "#D78FEE",
  emerald: "#FDCFFA",
};

const windowParamKeyById: Record<SalesStatCardWithDialogProps["id"], string> = {
  net: "stats_window_net",
  margin: "stats_window_margin",
  rate: "stats_window_rate",
  sets: "stats_window_sets",
  pieces: "stats_window_pieces",
};

const WINDOW_OPTIONS = [
  { value: 7, label: "7 derniers jours" },
  { value: 30, label: "30 derniers jours" },
  { value: 90, label: "90 derniers jours" },
  { value: 365, label: "365 derniers jours" },
];

export function SalesStatCardWithDialog(props: SalesStatCardWithDialogProps) {
  const { id, title, mainValue, trendPercent, color, windowDays } = props;

  const [expanded, setExpanded] = useState(false);
  const [tempWindow, setTempWindow] = useState<number>(windowDays);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setTempWindow(windowDays);
  }, [windowDays]);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const headerBgHex = headerBgByColor[color];
  const paramKey = windowParamKeyById[id];

  const hasTrend = trendPercent !== null;
  const isPositive = (trendPercent ?? 0) >= 0;
  const absPercent = trendPercent !== null ? Math.abs(trendPercent) : 0;

  const percentLabel =
    trendPercent === null
      ? "—"
      : `${isPositive ? "+" : "-"}${absPercent
          .toFixed(1)
          .replace(".", ",")}%`;

  const shortWindowLabel = `${windowDays} j`;

  const TrendIcon = isPositive ? ArrowUpRight : ArrowDownRight;

  const pillClasses = hasTrend
    ? isPositive
      ? "bg-emerald-100 text-emerald-700"
      : "bg-red-100 text-red-700"
    : "bg-slate-100 text-slate-500";

  const handleApply = (nextWindow: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(paramKey, String(nextWindow));

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleApply(tempWindow);
    setExpanded(false);
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.16)] transform-gpu transition-all duration-500 ease-[cubic-bezier(0.22,0.61,0.36,1)] cursor-pointer",
        expanded && "scale-[1.02] shadow-[0_22px_60px_rgba(15,23,42,0.24)]"
      )}
      onClick={() => setExpanded((prev) => !prev)}
    >
      {/* Bandeau coloré + titre */}
      <div
        className="h-12 w-full flex items-center px-5 rounded-t-3xl"
        style={{ backgroundColor: headerBgHex }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
          {title}
        </p>
      </div>

      {/* Contenu principal */}
      <div className="px-5 pt-3 pb-4 bg-white rounded-b-3xl">
        <div className="flex items-center justify-between gap-3 min-w-0">
          <span className="text-3xl font-semibold text-slate-900 leading-none min-w-0 whitespace-nowrap">
            {mainValue}
          </span>

          {/* Pastille tendance + bouton fenêtre (même taille que les pastilles) */}
          <div className="flex flex-col items-end gap-1 shrink-0 max-w-[48%]">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-medium whitespace-nowrap max-w-full w-fit",
                pillClasses
              )}
            >
              {hasTrend && <TrendIcon className="h-3 w-3" aria-hidden="true" />}
              <span className="truncate max-w-[140px]">{percentLabel}</span>
            </span>

            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-medium whitespace-nowrap max-w-full",
                "bg-slate-50 text-slate-600 hover:bg-slate-100 shadow-sm transition-colors"
              )}
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((prev) => !prev);
              }}
            >
              <SlidersHorizontal className="h-3 w-3" />
              <span className="truncate max-w-[140px]">{shortWindowLabel}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Panneau options (plus lisible quand ouvert) */}
      <div
        className={cn(
          "overflow-hidden transition-[max-height,opacity,margin-top] duration-400 ease-[cubic-bezier(0.22,0.61,0.36,1)]",
          expanded ? "mt-2 max-h-[220px] opacity-100" : "max-h-0 opacity-0"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pb-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-[0_8px_18px_rgba(15,23,42,0.08)]">
            <form
              className="flex flex-col gap-3"
              onSubmit={onSubmit}
            >
              <div className="flex-1">
                <p className="mb-2 text-[11px] font-medium text-slate-600">
                  Période d&apos;analyse (valeur principale)
                </p>

                <label className="mb-1 block text-[11px] text-slate-500">
                  Taille de la fenêtre
                </label>

                <div className="relative">
                  <select
                    className="h-10 w-full appearance-none rounded-full border border-slate-200 bg-white px-3 pr-9 text-xs text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.08)] focus:outline-none focus:ring-2 focus:ring-slate-900/5"
                    value={tempWindow}
                    onChange={(e) => setTempWindow(Number(e.target.value))}
                  >
                    {WINDOW_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
                </div>

              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 h-10 rounded-full border border-slate-200 bg-white px-4 text-[11px] font-medium text-slate-700 shadow-[0_4px_12px_rgba(15,23,42,0.06)] hover:bg-slate-50 transition-colors"
                  onClick={() => {
                    setTempWindow(windowDays);
                    setExpanded(false);
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 h-10 rounded-full bg-slate-900 px-4 text-[11px] font-medium text-white shadow-[0_8px_22px_rgba(15,23,42,0.35)] hover:bg-slate-800 transition-colors disabled:opacity-60"
                >
                  {isPending ? "…" : "Appliquer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
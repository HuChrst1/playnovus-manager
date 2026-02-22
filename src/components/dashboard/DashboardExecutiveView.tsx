"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Filter } from "lucide-react";
import {
  DASHBOARD_EXECUTIVE_ISSUE_MESSAGES,
  type DashboardActionSignal,
  type DashboardExecutiveData,
  type DashboardExecutiveIssueCode,
  type DashboardFinancialKpi,
  type DashboardFinancialKpiKey,
  type DashboardPreset,
  type DashboardTimeBucket,
} from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import { DashboardModal } from "@/components/dashboard/DashboardModal";
import {
  KpiSparklineChart,
  ProcurementMonthlyChart,
  SalesStackedOrdersChart,
  SetPieceGroupedMetricChart,
  SetPieceRevenuePieChart,
  TrendDualChart,
  type SetPieceMetric,
} from "@/components/dashboard/DashboardHubCharts";
import { Button } from "@/components/ui/button";

const euro = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const euroPrecise = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percent = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const integer = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 0,
});

const decimal = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const FILTER_TIMELINE: Array<{ preset: Exclude<DashboardPreset, "custom">; label: string }> = [
  { preset: "total", label: "Total" },
  { preset: "12m", label: "12m" },
  { preset: "90", label: "90j" },
  { preset: "30", label: "30j" },
  { preset: "7", label: "7j" },
];

type Block3View = "grouped" | "table" | "pie";

type KpiSeriesMetric =
  | "netRevenue"
  | "netMargin"
  | "marginRate"
  | "stockValue"
  | "salesCount"
  | "procurementCost"
  | "avgPurchasePieceCost"
  | "confirmedLotsCount"
  | "averageBasket"
  | "stockRotation"
  | "immobilizationRate";

type DashboardDayTrendPoint = DashboardExecutiveData["trendSeries"]["byBucket"]["day"][number];

const VISIBLE_KPI_KEYS: DashboardFinancialKpiKey[] = [
  "netRevenue",
  "netMargin",
  "salesCount",
  "averageBasket",
];

const SQUARE_CARD_CLASS = "min-h-[236px] md:min-h-[248px] xl:aspect-square xl:min-h-0";
const KPI_COMPARISON_WINDOW_DAYS = 30;
const KPI_COMPARISON_MIN_POINTS = KPI_COMPARISON_WINDOW_DAYS * 2;

const PROCUREMENT_BLOCK_ISSUE_CODES = new Set<DashboardExecutiveIssueCode>([
  "FORECAST_UNAVAILABLE",
  "FORECAST_DATA_INSUFFICIENT",
  "CHANNEL_COHORTS_UNAVAILABLE",
  "CHANNEL_COHORTS_DATA_INSUFFICIENT",
  "SOURCING_LEAD_TIME_UNAVAILABLE",
  "SOURCING_LEAD_TIME_DATA_INSUFFICIENT",
  "THEME_ROTATION_UNAVAILABLE",
  "THEME_ROTATION_DATA_INSUFFICIENT",
]);

const INSUFFICIENT_ANALYSIS_MESSAGE = "manque de données pour formuler une analyse fiable";

function formatCurrencyOrDash(value: number | null): string {
  if (value === null) return "—";
  return euro.format(value);
}

function formatPercentOrDash(value: number | null): string {
  if (value === null) return "—";
  return `${percent.format(value)} %`;
}

function formatDecimalOrDash(value: number | null, suffix = ""): string {
  if (value === null) return "—";
  return `${decimal.format(value)}${suffix}`;
}

function signalLabel(signal: DashboardActionSignal): string {
  if (signal === "ACCELERER") return "ACCELERER";
  if (signal === "FREINER") return "FREINER";
  return "STABLE";
}

function signalClassName(signal: DashboardActionSignal): string {
  if (signal === "ACCELERER") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (signal === "FREINER") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  return "border-sky-200 bg-sky-50 text-sky-700";
}

function toPeriodParams(filters: DashboardExecutiveData["filters"]): URLSearchParams {
  const params = new URLSearchParams();
  params.set("from", filters.from);
  params.set("to", filters.to);
  return params;
}

function toSalesHref(filters: DashboardExecutiveData["filters"]): string {
  return `/ventes?${toPeriodParams(filters).toString()}`;
}

function toProcurementHref(filters: DashboardExecutiveData["filters"]): string {
  return `/approvisionnement?${toPeriodParams(filters).toString()}`;
}

function toStockHistoryHref(filters: DashboardExecutiveData["filters"]): string {
  return `/historique-stock?${toPeriodParams(filters).toString()}`;
}

function getKpiActionHref(
  key: DashboardFinancialKpiKey,
  filters: DashboardExecutiveData["filters"]
): string {
  if (key === "procurementCost" || key === "avgPurchasePieceCost" || key === "confirmedLotsCount") {
    return toProcurementHref(filters);
  }

  if (key === "stockCurrentValue" || key === "stockRotation" || key === "immobilizationRate") {
    return key === "stockRotation" ? toStockHistoryHref(filters) : "/stock";
  }

  return toSalesHref(filters);
}

function metricFromKpiKey(key: DashboardFinancialKpiKey): KpiSeriesMetric {
  if (key === "stockCurrentValue") return "stockValue";
  return key;
}

function seriesScaleFromKpiKey(key: DashboardFinancialKpiKey): number {
  if (key === "stockRotation" || key === "immobilizationRate") {
    return 100;
  }

  return 1;
}

function sumMetric(points: DashboardDayTrendPoint[], selector: (point: DashboardDayTrendPoint) => number): number {
  return points.reduce((total, point) => total + selector(point), 0);
}

function meanNullableMetric(
  points: DashboardDayTrendPoint[],
  selector: (point: DashboardDayTrendPoint) => number | null
): number | null {
  let sum = 0;
  let count = 0;

  for (const point of points) {
    const value = selector(point);
    if (value === null || !Number.isFinite(value)) continue;
    sum += value;
    count += 1;
  }

  return count > 0 ? sum / count : null;
}

function lastNullableMetric(
  points: DashboardDayTrendPoint[],
  selector: (point: DashboardDayTrendPoint) => number | null
): number | null {
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const value = selector(points[index]!);
    if (value !== null && Number.isFinite(value)) return value;
  }
  return null;
}

function computeKpiWindowValue(
  points: DashboardDayTrendPoint[],
  key: DashboardFinancialKpiKey
): number | null {
  if (points.length === 0) return null;

  switch (key) {
    case "netRevenue":
      return sumMetric(points, (point) => point.netRevenue);
    case "netMargin":
      return sumMetric(points, (point) => point.netMargin);
    case "salesCount":
      return sumMetric(points, (point) => point.salesCount);
    case "averageBasket": {
      const revenue = sumMetric(points, (point) => point.netRevenue);
      const sales = sumMetric(points, (point) => point.salesCount);
      return sales > 0 ? revenue / sales : null;
    }
    case "marginRate": {
      const revenue = sumMetric(points, (point) => point.netRevenue);
      const margin = sumMetric(points, (point) => point.netMargin);
      return revenue > 0 ? (margin / revenue) * 100 : null;
    }
    case "stockCurrentValue":
      return lastNullableMetric(points, (point) => point.stockValue);
    case "procurementCost":
      return sumMetric(points, (point) => point.procurementCost);
    case "avgPurchasePieceCost":
      return meanNullableMetric(points, (point) => point.avgPurchasePieceCost);
    case "confirmedLotsCount":
      return sumMetric(points, (point) => point.confirmedLotsCount);
    case "stockRotation":
      return meanNullableMetric(points, (point) => point.stockRotation);
    case "immobilizationRate":
      return meanNullableMetric(points, (point) => point.immobilizationRate);
    default: {
      const exhaustiveCheck: never = key;
      throw new Error(`KPI key non supportee: ${exhaustiveCheck}`);
    }
  }
}

function computeKpiDeltaPercent30Days(
  dayPoints: DashboardDayTrendPoint[],
  key: DashboardFinancialKpiKey
): number | null {
  if (dayPoints.length < KPI_COMPARISON_MIN_POINTS) return null;

  const currentWindow = dayPoints.slice(-KPI_COMPARISON_WINDOW_DAYS);
  const previousWindow = dayPoints.slice(
    -KPI_COMPARISON_MIN_POINTS,
    -KPI_COMPARISON_WINDOW_DAYS
  );

  if (
    currentWindow.length < KPI_COMPARISON_WINDOW_DAYS ||
    previousWindow.length < KPI_COMPARISON_WINDOW_DAYS
  ) {
    return null;
  }

  const currentValue = computeKpiWindowValue(currentWindow, key);
  const previousValue = computeKpiWindowValue(previousWindow, key);

  if (
    currentValue === null ||
    previousValue === null ||
    !Number.isFinite(currentValue) ||
    !Number.isFinite(previousValue) ||
    previousValue === 0
  ) {
    return null;
  }

  const rawDelta = ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
  if (!Number.isFinite(rawDelta)) return null;

  return Math.abs(rawDelta) < 0.05 ? 0 : rawDelta;
}

function formatKpiDeltaPercent(deltaPercent: number | null): string {
  if (deltaPercent === null) return "—";
  if (deltaPercent === 0) return "0,0%";
  const sign = deltaPercent > 0 ? "+" : "-";
  return `${sign}${percent.format(Math.abs(deltaPercent))}%`;
}

function kpiDeltaPillClasses(deltaPercent: number | null, options?: { active?: boolean }): string {
  const isActive = options?.active ?? false;

  if (deltaPercent === null || deltaPercent === 0) {
    return isActive ? "bg-slate-300/20 text-slate-100" : "bg-slate-100 text-slate-600";
  }

  if (deltaPercent > 0) {
    return isActive ? "bg-emerald-300/20 text-emerald-200" : "bg-emerald-100 text-emerald-700";
  }

  return isActive ? "bg-rose-300/20 text-rose-200" : "bg-rose-100 text-rose-700";
}

function qualityLabel(quality: DashboardFinancialKpi["quality"]): string {
  return quality === "ok" ? "ok" : "partial";
}

function issueText(issue: DashboardFinancialKpi["issue"]): string {
  if (!issue) return "Aucune anomalie de qualite detectee.";
  return DASHBOARD_EXECUTIVE_ISSUE_MESSAGES[issue] ?? "Donnee partielle detectee.";
}

function formatKpiValue(kpi: DashboardFinancialKpi): string {
  if (kpi.quality === "partial" || kpi.value === null) return "—";

  if (kpi.kind === "currency") {
    if (kpi.key === "avgPurchasePieceCost") {
      return euroPrecise.format(kpi.value);
    }
    return euro.format(kpi.value);
  }

  if (kpi.kind === "percent") {
    return `${percent.format(kpi.value)} %`;
  }

  return integer.format(kpi.value);
}

function buildDashboardHref(options: {
  preset: DashboardPreset;
  from: string;
  to: string;
}): string {
  const params = new URLSearchParams();

  if (options.preset === "custom") {
    params.set("preset", "custom");
    if (options.from) params.set("from", options.from);
    if (options.to) params.set("to", options.to);
  } else {
    params.set("preset", options.preset);
  }

  return `/?${params.toString()}`;
}

function MinimalCardButton({
  title,
  subtitle,
  children,
  className,
  contentClassName,
  onClick,
  tone = "default",
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  onClick?: () => void;
  tone?: "default" | "dark";
}) {
  const isDark = tone === "dark";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex h-full w-full flex-col rounded-[28px] p-4 text-left transition-transform hover:-translate-y-0.5",
        isDark
          ? "border border-slate-800 bg-slate-950 shadow-[0_20px_44px_rgba(2,6,23,0.45)]"
          : "app-card",
        className
      )}
    >
      <div className="mb-2">
        <p
          className={cn(
            "text-[11px] font-semibold uppercase tracking-[0.14em]",
            isDark ? "text-slate-400" : "text-slate-500"
          )}
        >
          {title}
        </p>
        <p className={cn("text-xs", isDark ? "text-slate-300" : "text-slate-500")}>{subtitle}</p>
      </div>
      <div className={cn("min-h-0", contentClassName)}>{children}</div>
    </button>
  );
}

function ActionSignalPill({ signal }: { signal: DashboardActionSignal }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]",
        signalClassName(signal)
      )}
    >
      {signalLabel(signal)}
    </span>
  );
}

function InsufficientAnalysisNotice({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <p className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
      {INSUFFICIENT_ANALYSIS_MESSAGE}
    </p>
  );
}

function FilterTimeline({
  selectedPreset,
  onSelect,
}: {
  selectedPreset: DashboardPreset;
  onSelect: (preset: Exclude<DashboardPreset, "custom">) => void;
}) {
  return (
    <div className="app-segmented shrink-0 whitespace-nowrap">
      {FILTER_TIMELINE.map((item) => {
        const isActive = selectedPreset === item.preset;
        return (
          <button
            key={item.preset}
            type="button"
            onClick={() => onSelect(item.preset)}
            className={cn(
              "app-segmented-item h-8 shrink-0 text-[11px] font-semibold",
              isActive
                ? "app-segmented-item--active"
                : "app-segmented-item--inactive"
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function KpiModalBody({
  dashboard,
  kpi,
  actionHref,
}: {
  dashboard: DashboardExecutiveData;
  kpi: DashboardFinancialKpi;
  actionHref: string;
}) {
  const [bucket, setBucket] = useState<DashboardTimeBucket>(dashboard.filters.activeBucket);
  const [windowMode, setWindowMode] = useState<"all" | "8" | "16">("all");
  const rawPoints = dashboard.trendSeries.byBucket[bucket];
  const scale = seriesScaleFromKpiKey(kpi.key);

  const points = useMemo(() => {
    if (windowMode === "all") return rawPoints;
    const size = Number.parseInt(windowMode, 10);
    if (!Number.isFinite(size) || size <= 0) return rawPoints;
    return rawPoints.slice(-size);
  }, [rawPoints, windowMode]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {kpi.label}
        </p>
        <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
          {formatKpiValue(kpi)}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1 rounded-2xl border border-slate-100 bg-white p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Definition
          </p>
          <p className="text-sm text-slate-800">{kpi.definition}</p>
        </div>
        <div className="space-y-1 rounded-2xl border border-slate-100 bg-white p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Periode
          </p>
          <p className="text-sm text-slate-800">{dashboard.filters.activePeriodLabel}</p>
          <p className="text-xs text-slate-500">Scope: {kpi.periodScope}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
        <span
          className={cn(
            "inline-flex rounded-full px-3 py-1 font-medium",
            kpi.quality === "ok"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border border-sky-200 bg-sky-50 text-sky-700"
          )}
        >
          Qualite: {qualityLabel(kpi.quality)}
        </span>
        <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1">
          {issueText(kpi.issue)}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <label className="space-y-1 text-xs font-medium text-slate-600">
          Granularite
          <select
            value={bucket}
            onChange={(event) => setBucket(event.target.value as DashboardTimeBucket)}
            className="h-9 w-full rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-700"
          >
            <option value="day">Jour</option>
            <option value="week">Semaine</option>
            <option value="month">Mois</option>
          </select>
        </label>

        <label className="space-y-1 text-xs font-medium text-slate-600">
          Fenetre mini-serie
          <select
            value={windowMode}
            onChange={(event) => setWindowMode(event.target.value as "all" | "8" | "16")}
            className="h-9 w-full rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-700"
          >
            <option value="all">Toute la periode</option>
            <option value="16">16 derniers points</option>
            <option value="8">8 derniers points</option>
          </select>
        </label>

        <Link
          href={actionHref}
          className="inline-flex h-9 items-center justify-center rounded-full border border-slate-200 px-4 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          Page operationnelle
        </Link>
      </div>

      <KpiSparklineChart points={points} metric={metricFromKpiKey(kpi.key)} scale={scale} />
    </div>
  );
}

function KpiHubModalBody({
  dashboard,
  initialKpiKey,
  kpiTrendByKey,
}: {
  dashboard: DashboardExecutiveData;
  initialKpiKey: DashboardFinancialKpiKey;
  kpiTrendByKey: Map<DashboardFinancialKpiKey, number | null>;
}) {
  const [selectedKpiKey, setSelectedKpiKey] = useState<DashboardFinancialKpiKey>(initialKpiKey);

  useEffect(() => {
    setSelectedKpiKey(initialKpiKey);
  }, [initialKpiKey]);

  const selectedKpi =
    dashboard.kpis.find((kpi) => kpi.key === selectedKpiKey) ?? dashboard.kpis[0] ?? null;

  if (!selectedKpi) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        Aucun KPI disponible.
      </p>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <div className="space-y-2">
        {dashboard.kpis.map((kpi) => {
          const isActive = kpi.key === selectedKpi.key;
          const trendPercent = kpiTrendByKey.get(kpi.key) ?? null;
          return (
            <button
              key={kpi.key}
              type="button"
              onClick={() => setSelectedKpiKey(kpi.key)}
              className={cn(
                "w-full rounded-2xl border px-3 py-3 text-left transition-colors",
                isActive
                  ? "border-slate-900 bg-slate-900 text-white shadow-[0_16px_34px_rgba(15,23,42,0.28)]"
                  : "border-slate-200 bg-white hover:bg-slate-50"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p
                  className={cn(
                    "text-[11px] font-semibold uppercase tracking-[0.14em]",
                    isActive ? "text-slate-200" : "text-slate-500"
                  )}
                >
                  {kpi.label}
                </p>
                <div className="flex flex-col items-end gap-1 text-right">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      kpiDeltaPillClasses(trendPercent, { active: isActive })
                    )}
                  >
                    {formatKpiDeltaPercent(trendPercent)}
                  </span>
                  <span className={cn("text-[9px]", isActive ? "text-slate-300" : "text-slate-400")}>
                    vs 30j precedents
                  </span>
                </div>
              </div>
              <p className={cn("mt-1 text-xl font-semibold tracking-tight", isActive ? "text-white" : "text-slate-900")}>
                {formatKpiValue(kpi)}
              </p>
            </button>
          );
        })}
      </div>

      <div className="min-w-0">
        <KpiModalBody
          dashboard={dashboard}
          kpi={selectedKpi}
          actionHref={getKpiActionHref(selectedKpi.key, dashboard.filters)}
        />
      </div>
    </div>
  );
}

function TrendModalBody({ dashboard }: { dashboard: DashboardExecutiveData }) {
  const [bucket, setBucket] = useState<DashboardTimeBucket>(dashboard.filters.activeBucket);
  const [showStockValue, setShowStockValue] = useState(false);
  const [showSalesCount, setShowSalesCount] = useState(false);
  const [showProcurementCost, setShowProcurementCost] = useState(false);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label className="space-y-1 text-xs font-medium text-slate-600">
          Granularite
          <select
            value={bucket}
            onChange={(event) => setBucket(event.target.value as DashboardTimeBucket)}
            className="h-9 w-full rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-700"
          >
            <option value="day">Jour</option>
            <option value="week">Semaine</option>
            <option value="month">Mois</option>
          </select>
        </label>

        <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={showStockValue}
            onChange={(event) => setShowStockValue(event.target.checked)}
            className="h-3.5 w-3.5"
          />
          Valeur stock
        </label>

        <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={showSalesCount}
            onChange={(event) => setShowSalesCount(event.target.checked)}
            className="h-3.5 w-3.5"
          />
          Nombre ventes
        </label>

        <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={showProcurementCost}
            onChange={(event) => setShowProcurementCost(event.target.checked)}
            className="h-3.5 w-3.5"
          />
          Cout appro
        </label>

        <div className="flex justify-end">
          <Link
            href={toSalesHref(dashboard.filters)}
            className="inline-flex h-9 items-center rounded-full border border-slate-200 px-4 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Ouvrir ventes
          </Link>
        </div>
      </div>

      <TrendDualChart
        points={dashboard.trendSeries.byBucket[bucket]}
        showStockValue={showStockValue}
        showSalesCount={showSalesCount}
        showProcurementCost={showProcurementCost}
        height={360}
      />
    </div>
  );
}

function StackedSalesModalBody({ dashboard }: { dashboard: DashboardExecutiveData }) {
  const [bucket, setBucket] = useState<"week" | "month">(dashboard.stackedSalesSeries.defaultBucket);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <label className="space-y-1 text-xs font-medium text-slate-600">
          Regroupement
          <select
            value={bucket}
            onChange={(event) => setBucket(event.target.value as "week" | "month")}
            className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-700"
          >
            <option value="week">Semaine</option>
            <option value="month">Mois</option>
          </select>
        </label>

        <Link
          href={toSalesHref(dashboard.filters)}
          className="inline-flex h-9 items-center rounded-full border border-slate-200 px-4 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          Ouvrir ventes
        </Link>
      </div>

      <SalesStackedOrdersChart points={dashboard.stackedSalesSeries.byBucket[bucket]} height={360} />
    </div>
  );
}

function SetPieceComparisonTable({ dashboard }: { dashboard: DashboardExecutiveData }) {
  const sets = dashboard.setPieceComparison.totals.sets;
  const pieces = dashboard.setPieceComparison.totals.pieces;

  const rows = [
    {
      label: "Nombre de commandes",
      setValue: integer.format(sets.ordersCount),
      pieceValue: integer.format(pieces.ordersCount),
    },
    {
      label: "CA net",
      setValue: euro.format(sets.netRevenue),
      pieceValue: euro.format(pieces.netRevenue),
    },
    {
      label: "Marge totale",
      setValue: euro.format(sets.netMargin),
      pieceValue: euro.format(pieces.netMargin),
    },
    {
      label: "Taux de marge moyen",
      setValue: sets.marginRate === null ? "—" : `${percent.format(sets.marginRate)} %`,
      pieceValue:
        pieces.marginRate === null ? "—" : `${percent.format(pieces.marginRate)} %`,
    },
    {
      label: "Panier moyen",
      setValue: sets.averageBasket === null ? "—" : euro.format(sets.averageBasket),
      pieceValue: pieces.averageBasket === null ? "—" : euro.format(pieces.averageBasket),
    },
  ];

  return (
    <div className="overflow-auto rounded-2xl border border-slate-100">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.14em] text-slate-500">
          <tr>
            <th className="px-3 py-2 text-left">Indicateur</th>
            <th className="px-3 py-2 text-right">Sets</th>
            <th className="px-3 py-2 text-right">Pieces</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-slate-100 bg-white">
              <td className="px-3 py-2 text-slate-700">{row.label}</td>
              <td className="px-3 py-2 text-right font-medium text-slate-900">{row.setValue}</td>
              <td className="px-3 py-2 text-right font-medium text-slate-900">{row.pieceValue}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SetPieceTablePreview({ dashboard }: { dashboard: DashboardExecutiveData }) {
  const sets = dashboard.setPieceComparison.totals.sets;
  const pieces = dashboard.setPieceComparison.totals.pieces;

  return (
    <div className="space-y-1.5 text-xs">
      <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
        <span className="text-slate-500">CA Sets</span>
        <span className="font-semibold text-slate-900">{euro.format(sets.netRevenue)}</span>
      </div>
      <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
        <span className="text-slate-500">CA Pieces</span>
        <span className="font-semibold text-slate-900">{euro.format(pieces.netRevenue)}</span>
      </div>
      <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
        <span className="text-slate-500">Marge Sets</span>
        <span className="font-semibold text-slate-900">{euro.format(sets.netMargin)}</span>
      </div>
      <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
        <span className="text-slate-500">Marge Pieces</span>
        <span className="font-semibold text-slate-900">{euro.format(pieces.netMargin)}</span>
      </div>
    </div>
  );
}

function SetPieceModalBody({
  dashboard,
  initialView,
}: {
  dashboard: DashboardExecutiveData;
  initialView: Block3View;
}) {
  const [activeView, setActiveView] = useState<Block3View>(initialView);
  const [metric, setMetric] = useState<SetPieceMetric>("revenue");
  const [bucket, setBucket] = useState<"week" | "month">(dashboard.setPieceComparison.defaultBucket);

  useEffect(() => {
    setActiveView(initialView);
  }, [initialView]);

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 -mx-5 border-b border-slate-100 bg-white px-5 pb-3 pt-1 md:-mx-6 md:px-6">
        <div className="app-segmented bg-white">
          {([
            ["grouped", "Graphique"],
            ["table", "Tableau"],
            ["pie", "Camembert"],
          ] as const).map(([view, label]) => (
            <button
              key={view}
              type="button"
              onClick={() => setActiveView(view)}
              className={cn(
                "app-segmented-item",
                activeView === view
                  ? "app-segmented-item--active"
                  : "app-segmented-item--inactive"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {activeView === "grouped" && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <label className="space-y-1 text-xs font-medium text-slate-600">
              Metrique
              <select
                value={metric}
                onChange={(event) => setMetric(event.target.value as SetPieceMetric)}
                className="app-control"
              >
                <option value="revenue">CA net</option>
                <option value="margin">Marge</option>
                <option value="marginRate">Taux de marge</option>
              </select>
            </label>

            <label className="space-y-1 text-xs font-medium text-slate-600">
              Regroupement
              <select
                value={bucket}
                onChange={(event) => setBucket(event.target.value as "week" | "month")}
                className="app-control"
              >
                <option value="week">Semaine</option>
                <option value="month">Mois</option>
              </select>
            </label>

            <Link
              href={toSalesHref(dashboard.filters)}
              className="inline-flex h-9 items-center justify-center rounded-full border border-border px-4 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Ouvrir ventes
            </Link>
          </div>

          <SetPieceGroupedMetricChart
            points={dashboard.setPieceComparison.groupedByBucket[bucket]}
            metric={metric}
            height={360}
          />
        </div>
      )}

      {activeView === "table" && <SetPieceComparisonTable dashboard={dashboard} />}

      {activeView === "pie" && (
        <SetPieceRevenuePieChart
          sets={dashboard.setPieceComparison.pieRevenueShare.sets}
          pieces={dashboard.setPieceComparison.pieRevenueShare.pieces}
          height={360}
        />
      )}
    </div>
  );
}

function ProcurementModalBody({ dashboard }: { dashboard: DashboardExecutiveData }) {
  const [showSales, setShowSales] = useState(true);
  const forecast = dashboard.forecast;
  const cohorts = dashboard.salesChannelCohorts;
  const leadTime = dashboard.sourcingChannelLeadTime;
  const themeRotation = dashboard.themeRotation;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-center">
        <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={showSales}
            onChange={(event) => setShowSales(event.target.checked)}
            className="h-3.5 w-3.5"
          />
          Afficher la correlation avec les ventes mensuelles
        </label>

        <div className="flex justify-start md:justify-center">
          <ActionSignalPill signal={forecast.signal} />
        </div>

        <div className="flex justify-start gap-2 md:justify-end">
          <Link
            href={toSalesHref(dashboard.filters)}
            className="inline-flex h-9 items-center rounded-full border border-slate-200 px-4 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Ouvrir ventes
          </Link>
          <Link
            href={toProcurementHref(dashboard.filters)}
            className="inline-flex h-9 items-center rounded-full border border-slate-200 px-4 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Ouvrir approvisionnements
          </Link>
        </div>
      </div>

      <ProcurementMonthlyChart
        points={dashboard.procurementStockSeries.points}
        showSalesCorrelation={showSales}
        height={320}
      />

      <section className="space-y-3 rounded-2xl border border-slate-100 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Projection cash / profit
            </p>
            <p className="text-sm text-slate-700">{forecast.signalReason}</p>
          </div>
          <ActionSignalPill signal={forecast.signal} />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs">
            <p className="text-slate-500">Proj. CA net 30j</p>
            <p className="font-semibold text-slate-900">
              {formatCurrencyOrDash(forecast.projections.d30.projectedNetRevenue)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs">
            <p className="text-slate-500">Proj. marge nette 30j</p>
            <p className="font-semibold text-slate-900">
              {formatCurrencyOrDash(forecast.projections.d30.projectedNetMargin)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs">
            <p className="text-slate-500">Couverture stock (jours)</p>
            <p className="font-semibold text-slate-900">
              {formatDecimalOrDash(forecast.stockCoverageDays, " j")}
            </p>
          </div>
        </div>

        <div className="overflow-auto rounded-2xl border border-slate-100">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Horizon</th>
                <th className="px-3 py-2 text-right">CA projete</th>
                <th className="px-3 py-2 text-right">Marge projetee</th>
                <th className="px-3 py-2 text-right">Ventes observees</th>
                <th className="px-3 py-2 text-right">Jours actifs</th>
              </tr>
            </thead>
            <tbody>
              {[forecast.projections.d30, forecast.projections.d90].map((row) => (
                <tr key={row.horizonDays} className="border-t border-slate-100 bg-white">
                  <td className="px-3 py-2 font-medium text-slate-900">{row.horizonDays} jours</td>
                  <td className="px-3 py-2 text-right text-slate-700">
                    {formatCurrencyOrDash(row.projectedNetRevenue)}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700">
                    {formatCurrencyOrDash(row.projectedNetMargin)}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700">
                    {integer.format(row.observedSalesCount)}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700">
                    {integer.format(row.daysWithSales)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <InsufficientAnalysisNotice show={forecast.quality === "partial"} />
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-100 bg-white p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Cohortes canaux ventes
        </p>
        {cohorts.rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
            Aucune cohorte exploitable sur la periode.
          </p>
        ) : (
          <div className="overflow-auto rounded-2xl border border-slate-100">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Canal</th>
                  <th className="px-3 py-2 text-right">Commandes</th>
                  <th className="px-3 py-2 text-right">CA net</th>
                  <th className="px-3 py-2 text-right">Marge</th>
                  <th className="px-3 py-2 text-right">Tx marge</th>
                  <th className="px-3 py-2 text-right">Panier</th>
                  <th className="px-3 py-2 text-right">Part CA</th>
                  <th className="px-3 py-2 text-right">Part marge</th>
                  <th className="px-3 py-2 text-right">Mix sets/pieces</th>
                </tr>
              </thead>
              <tbody>
                {cohorts.rows.map((row) => (
                  <tr key={row.key} className="border-t border-slate-100 bg-white">
                    <td className="px-3 py-2 font-medium text-slate-900">{row.channel}</td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {integer.format(row.ordersCount)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">{euro.format(row.netRevenue)}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{euro.format(row.netMargin)}</td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {formatPercentOrDash(row.marginRate)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {formatCurrencyOrDash(row.averageBasket)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {formatPercentOrDash(row.revenueShare)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {formatPercentOrDash(row.marginShare)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {formatPercentOrDash(row.setMixRate)} / {formatPercentOrDash(row.pieceMixRate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <InsufficientAnalysisNotice show={cohorts.quality === "partial"} />
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-100 bg-white p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Lead-time canaux d'approvisionnement
        </p>
        {leadTime.rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
            Aucun lot exploitable sur la periode.
          </p>
        ) : (
          <div className="overflow-auto rounded-2xl border border-slate-100">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Canal d'appro</th>
                  <th className="px-3 py-2 text-right">Lots observes</th>
                  <th className="px-3 py-2 text-right">Lots vendus</th>
                  <th className="px-3 py-2 text-right">Lots non vendus</th>
                  <th className="px-3 py-2 text-right">Mediane</th>
                  <th className="px-3 py-2 text-right">P75</th>
                </tr>
              </thead>
              <tbody>
                {leadTime.rows.map((row) => (
                  <tr key={row.key} className="border-t border-slate-100 bg-white">
                    <td className="px-3 py-2 font-medium text-slate-900">{row.channel}</td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {integer.format(row.observedLots)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">{integer.format(row.soldLots)}</td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {integer.format(row.unsoldLots)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {formatDecimalOrDash(row.medianLeadTimeDays, " j")}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {formatDecimalOrDash(row.p75LeadTimeDays, " j")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <InsufficientAnalysisNotice show={leadTime.quality === "partial"} />
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-100 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Rotation par theme
          </p>
          <Link
            href="/catalogue"
            className="inline-flex h-8 items-center rounded-full border border-slate-200 px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Ouvrir catalogue
          </Link>
        </div>
        {themeRotation.rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
            Aucune rotation exploitable sur la periode.
          </p>
        ) : (
          <div className="overflow-auto rounded-2xl border border-slate-100">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Theme</th>
                  <th className="px-3 py-2 text-right">Cmd sets</th>
                  <th className="px-3 py-2 text-right">Unites</th>
                  <th className="px-3 py-2 text-right">CA net</th>
                  <th className="px-3 py-2 text-right">Marge</th>
                  <th className="px-3 py-2 text-right">Vitesse hebdo</th>
                  <th className="px-3 py-2 text-right">Couverture sets</th>
                  <th className="px-3 py-2 text-right">Couverture sem.</th>
                  <th className="px-3 py-2 text-right">Signal</th>
                </tr>
              </thead>
              <tbody>
                {themeRotation.rows.map((row) => (
                  <tr key={row.key} className="border-t border-slate-100 bg-white">
                    <td className="px-3 py-2 font-medium text-slate-900">{row.theme}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{integer.format(row.setOrders)}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{integer.format(row.soldUnits)}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{euro.format(row.netRevenue)}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{euro.format(row.netMargin)}</td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {formatDecimalOrDash(row.weeklyVelocity)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {integer.format(row.stockCoverageSets)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {formatDecimalOrDash(row.coverageWeeks)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <ActionSignalPill signal={row.signal} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <InsufficientAnalysisNotice show={themeRotation.quality === "partial"} />
      </section>
    </div>
  );
}

function ProcurementPreview({
  dashboard,
  isProcurementBlockPartial,
}: {
  dashboard: DashboardExecutiveData;
  isProcurementBlockPartial: boolean;
}) {
  const forecast = dashboard.forecast;

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-1.5">
        <span className="text-slate-500">Signal achat</span>
        <ActionSignalPill signal={forecast.signal} />
      </div>
      <p className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-600">
        {forecast.signalReason}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
          <p className="text-[11px] text-slate-500">CA 30j</p>
          <p className="text-sm font-semibold text-slate-900">
            {formatCurrencyOrDash(forecast.projections.d30.projectedNetRevenue)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
          <p className="text-[11px] text-slate-500">Marge 30j</p>
          <p className="text-sm font-semibold text-slate-900">
            {formatCurrencyOrDash(forecast.projections.d30.projectedNetMargin)}
          </p>
        </div>
        <div className="col-span-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
          <p className="text-[11px] text-slate-500">Couverture</p>
          <p className="text-sm font-semibold text-slate-900">
            {formatDecimalOrDash(forecast.stockCoverageDays, " j")}
          </p>
        </div>
      </div>
      {isProcurementBlockPartial ? (
        <p className="text-[10px] text-slate-500">Donnees partielles (bloc achats/stock)</p>
      ) : null}
    </div>
  );
}

function OpportunitiesDarkPreview({ dashboard }: { dashboard: DashboardExecutiveData }) {
  const topRows = dashboard.opportunities.slice(0, 10);

  if (topRows.length === 0) {
    return (
      <div className="rounded-[22px] border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-300">
        Aucune opportunite detectee.
      </div>
    );
  }

  return (
    <div className="space-y-1.5 rounded-[22px] border border-slate-800 bg-slate-900/70 p-3">
      {topRows.map((row) => (
        <div
          key={row.key}
          className="flex items-center justify-between gap-3 rounded-full border border-slate-700/80 bg-slate-900/85 px-3 py-1.5 text-xs"
        >
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-100">{row.displayRef}</p>
            <p className="truncate text-[11px] text-slate-400">{row.name}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-semibold text-sky-300">{percent.format(row.completionPercent)}%</p>
            <p className="text-[11px] text-slate-400">max {integer.format(row.maxCompleteSets)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function OpportunitiesModalBody({ dashboard }: { dashboard: DashboardExecutiveData }) {
  const [limit, setLimit] = useState<"8" | "12" | "20">("12");
  const rows = dashboard.opportunities.slice(0, Number.parseInt(limit, 10));

  return (
    <div className="space-y-4 text-slate-200">
      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
        <label className="space-y-1 text-xs font-medium text-slate-300">
          Volume affiche
          <select
            value={limit}
            onChange={(event) => setLimit(event.target.value as "8" | "12" | "20")}
            className="h-9 w-full rounded-full border border-slate-700 bg-slate-900 px-3 text-xs text-slate-100"
          >
            <option value="8">Top 8</option>
            <option value="12">Top 12</option>
            <option value="20">Top 20</option>
          </select>
        </label>

        <Link
          href="/catalogue?sort=completion&dir=desc"
          className="inline-flex h-9 items-center justify-center rounded-full border border-slate-700 bg-slate-900/70 px-4 text-xs font-medium text-slate-100 transition-colors hover:bg-slate-800"
        >
          Ouvrir catalogue
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/70 p-4 text-sm text-slate-300">
          Aucune opportunite detectee.
        </p>
      ) : (
        <div className="overflow-auto rounded-2xl border border-slate-700 bg-slate-950/60">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-900/80 text-[11px] uppercase tracking-[0.14em] text-slate-400">
              <tr>
                <th className="px-3 py-2 text-left">Set</th>
                <th className="px-3 py-2 text-right">Completion</th>
                <th className="px-3 py-2 text-right">Max sets</th>
                <th className="px-3 py-2 text-right">Pieces possedees</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={row.key}
                  className={cn(
                    "border-t border-slate-800",
                    index % 2 === 0 ? "bg-slate-950/85" : "bg-slate-900/65"
                  )}
                >
                  <td className="px-3 py-2">
                    <p className="font-medium text-slate-100">{row.displayRef}</p>
                    <p className="text-xs text-slate-400">{row.name}</p>
                  </td>
                  <td className="px-3 py-2 text-right text-slate-200">
                    {percent.format(row.completionPercent)} %
                  </td>
                  <td className="px-3 py-2 text-right text-slate-200">
                    {integer.format(row.maxCompleteSets)}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-200">
                    {integer.format(row.totalPartsOwned)} / {integer.format(row.totalPartsNeeded)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function DashboardExecutiveView({ dashboard }: { dashboard: DashboardExecutiveData }) {
  const router = useRouter();

  const [isDesktopFilterOpen, setIsDesktopFilterOpen] = useState(false);
  const [draftPreset, setDraftPreset] = useState<DashboardPreset>(dashboard.filters.preset);
  const [draftFrom, setDraftFrom] = useState(dashboard.filters.from);
  const [draftTo, setDraftTo] = useState(dashboard.filters.to);

  const [block3ModalOpen, setBlock3ModalOpen] = useState(false);
  const [block3InitialView, setBlock3InitialView] = useState<Block3View>("grouped");
  const [kpiHubModalOpen, setKpiHubModalOpen] = useState(false);
  const [kpiHubInitialKey, setKpiHubInitialKey] =
    useState<DashboardFinancialKpiKey>("netRevenue");

  const dayTrendPoints = dashboard.trendSeries.byBucket.day;
  const activeTrendPoints = dashboard.trendSeries.byBucket[dashboard.filters.activeBucket];
  const stackedPoints = dashboard.stackedSalesSeries.byBucket[dashboard.stackedSalesSeries.defaultBucket];
  const groupedPoints =
    dashboard.setPieceComparison.groupedByBucket[dashboard.setPieceComparison.defaultBucket];
  const kpiByKey = useMemo(
    () => new Map(dashboard.kpis.map((kpi) => [kpi.key, kpi])),
    [dashboard.kpis]
  );
  const visibleKpis = VISIBLE_KPI_KEYS.map((key) => kpiByKey.get(key)).filter(
    (kpi): kpi is DashboardFinancialKpi => Boolean(kpi)
  );
  const kpiTrendByKey = useMemo(() => {
    const trendMap = new Map<DashboardFinancialKpiKey, number | null>();
    for (const kpi of dashboard.kpis) {
      trendMap.set(kpi.key, computeKpiDeltaPercent30Days(dayTrendPoints, kpi.key));
    }
    return trendMap;
  }, [dashboard.kpis, dayTrendPoints]);
  const kpiHubDefaultKey = (visibleKpis[0]?.key ?? dashboard.kpis[0]?.key ?? "netRevenue") as DashboardFinancialKpiKey;
  const isProcurementBlockPartial =
    dashboard.forecast.quality === "partial" ||
    dashboard.salesChannelCohorts.quality === "partial" ||
    dashboard.sourcingChannelLeadTime.quality === "partial" ||
    dashboard.themeRotation.quality === "partial" ||
    dashboard.issues.some((issue) => PROCUREMENT_BLOCK_ISSUE_CODES.has(issue));

  const applyFilters = () => {
    router.push(
      buildDashboardHref({
        preset: "custom",
        from: draftFrom,
        to: draftTo,
      })
    );
    setIsDesktopFilterOpen(false);
  };

  const applyPresetInstant = (preset: Exclude<DashboardPreset, "custom">) => {
    setDraftPreset(preset);
    router.push(
      buildDashboardHref({
        preset,
        from: dashboard.filters.from,
        to: dashboard.filters.to,
      })
    );
    setIsDesktopFilterOpen(false);
  };

  const syncDraftFilters = () => {
    setDraftPreset(dashboard.filters.preset);
    setDraftFrom(dashboard.filters.from);
    setDraftTo(dashboard.filters.to);
  };

  const openDesktopFilterPanel = () => {
    syncDraftFilters();
    setIsDesktopFilterOpen((previous) => !previous);
  };

  const openBlock3Modal = (view: Block3View) => {
    setBlock3InitialView(view);
    setBlock3ModalOpen(true);
  };

  const openKpiHubModal = (initialKey: DashboardFinancialKpiKey) => {
    setKpiHubInitialKey(initialKey);
    setKpiHubModalOpen(true);
  };

  return (
    <main className="space-y-6">
      <header className="px-1 md:px-2">
        <div className="flex items-start justify-between gap-3">
          <h1 className="whitespace-nowrap text-3xl font-medium tracking-tight text-slate-900 md:text-[42px] md:leading-none">
            Dashboard
          </h1>

          <div className="flex flex-col items-end gap-2">
            <button type="button" onClick={openDesktopFilterPanel} className="app-filter-trigger h-10 text-sm">
              <Filter className="h-4 w-4" />
              Filtrer
            </button>

            {isDesktopFilterOpen ? (
              <div className="inline-flex max-w-[min(96vw,980px)] flex-nowrap items-center gap-2 overflow-x-auto whitespace-nowrap rounded-[24px] border border-white/75 bg-white/92 px-2.5 py-2 shadow-[0_16px_36px_rgba(15,23,42,0.1)] backdrop-blur-md">
                <FilterTimeline selectedPreset={draftPreset} onSelect={applyPresetInstant} />

                <button
                  type="button"
                  onClick={() => setDraftPreset("custom")}
                  className={cn(
                    "app-segmented-item h-8 shrink-0",
                    draftPreset === "custom"
                      ? "app-segmented-item--active"
                      : "app-segmented-item--inactive border border-border bg-white"
                  )}
                >
                  Personnalise
                </button>

                <label className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-slate-500">
                  <span>Du</span>
                  <input
                    type="date"
                    value={draftFrom}
                    onChange={(event) => setDraftFrom(event.target.value)}
                    disabled={draftPreset !== "custom"}
                    className="app-control h-8 w-[132px] px-3 text-[11px] disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>

                <label className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-slate-500">
                  <span>Au</span>
                  <input
                    type="date"
                    value={draftTo}
                    onChange={(event) => setDraftTo(event.target.value)}
                    disabled={draftPreset !== "custom"}
                    className="app-control h-8 w-[132px] px-3 text-[11px] disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>

                <Button
                  type="button"
                  size="sm"
                  onClick={applyFilters}
                  disabled={draftPreset !== "custom"}
                  className="shrink-0 text-[11px] font-semibold"
                >
                  Appliquer
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    router.push("/?preset=total");
                    setIsDesktopFilterOpen(false);
                  }}
                  className="shrink-0 text-[11px]"
                >
                  Reinitialiser
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 px-1 md:px-2 xl:w-full xl:grid-cols-[minmax(0,3fr)_minmax(0,1.05fr)] xl:items-stretch">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 xl:items-stretch">
          <DashboardModal
            open={kpiHubModalOpen}
            onOpenChange={setKpiHubModalOpen}
            trigger={
              <button
                type="button"
                onClick={() => openKpiHubModal(kpiHubDefaultKey)}
                className={cn(
                  "app-card flex w-full flex-col rounded-[28px] border border-white/85 bg-gradient-to-br from-white via-white to-sky-50/62 p-3.5 text-left shadow-[0_20px_40px_rgba(15,23,42,0.1)] transition-transform hover:-translate-y-0.5",
                  SQUARE_CARD_CLASS
                )}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    KPIs essentiels
                  </p>
                  <span className="rounded-full border border-slate-200 bg-white/85 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-600">
                    4 / 11
                  </span>
                </div>

                <div className="grid flex-1 auto-rows-fr gap-1.5 sm:grid-cols-2">
                  {visibleKpis.map((kpi) => {
                    const trendPercent = kpiTrendByKey.get(kpi.key) ?? null;
                    return (
                      <div
                        key={kpi.key}
                        className="flex h-full flex-col justify-between rounded-[18px] border border-white/80 bg-white/90 px-2.5 py-2 shadow-[0_8px_18px_rgba(15,23,42,0.06)]"
                      >
                        <div className="mb-1 flex items-start justify-between gap-1.5">
                          <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                            {kpi.label}
                          </p>
                          <div className="flex flex-col items-end gap-0.5 text-right">
                            <span
                              className={cn(
                                "inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
                                kpiDeltaPillClasses(trendPercent)
                              )}
                            >
                              {formatKpiDeltaPercent(trendPercent)}
                            </span>
                            <span className="text-[8px] text-slate-400">vs 30j precedents</span>
                          </div>
                        </div>
                        <p className="text-[24px] leading-none font-light tracking-tight text-slate-900">
                          {formatKpiValue(kpi)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </button>
            }
            title="KPIs financiers complets"
            description="Selectionne une KPI pour afficher son detail et son drilldown metier."
            contentClassName="w-[min(98vw,1260px)]"
          >
            <KpiHubModalBody
              dashboard={dashboard}
              initialKpiKey={kpiHubInitialKey}
              kpiTrendByKey={kpiTrendByKey}
            />
          </DashboardModal>

          <DashboardModal
            trigger={
              <MinimalCardButton
                title="Cycles ventes"
                subtitle="Histogramme empile Sets / Pieces"
                className={SQUARE_CARD_CLASS}
                contentClassName="h-full"
              >
                <SalesStackedOrdersChart
                  points={stackedPoints}
                  height={178}
                  compact
                  showLegend={false}
                />
              </MinimalCardButton>
            }
            title="Bloc 2 - Ventes Sets vs Pieces"
            description="Cycles hebdo/mensuels des commandes confirmees."
            contentClassName="w-[min(96vw,1080px)]"
          >
            <StackedSalesModalBody dashboard={dashboard} />
          </DashboardModal>

          <MinimalCardButton
            title="Comparaison Sets/Pieces"
            subtitle="Graphique groupe par metrique"
            className={SQUARE_CARD_CLASS}
            contentClassName="h-full"
            onClick={() => openBlock3Modal("grouped")}
          >
            <SetPieceGroupedMetricChart
              points={groupedPoints}
              metric="revenue"
              height={178}
              compact
              showLegend={false}
            />
          </MinimalCardButton>

          <DashboardModal
            trigger={
              <MinimalCardButton
                title="Tendances temporelles"
                subtitle="Courbes CA net et marge nette"
                className="min-h-[220px] md:col-span-2 xl:col-span-3 xl:min-h-[236px]"
                contentClassName="pt-1"
              >
                <TrendDualChart points={activeTrendPoints} height={172} compact showLegend={false} />
              </MinimalCardButton>
            }
            title="Bloc 2 - Tendances temporelles"
            description="Courbe principale avec variables additionnelles et lecture detaillee."
            contentClassName="w-[min(98vw,1220px)]"
          >
            <TrendModalBody dashboard={dashboard} />
          </DashboardModal>

          <MinimalCardButton
            title="Comparatif rapide"
            subtitle="Tableau Sets vs Pieces"
            className={SQUARE_CARD_CLASS}
            contentClassName="h-full"
            onClick={() => openBlock3Modal("table")}
          >
            <SetPieceTablePreview dashboard={dashboard} />
          </MinimalCardButton>

          <MinimalCardButton
            title="Part de CA"
            subtitle="Camembert Sets / Pieces"
            className={SQUARE_CARD_CLASS}
            contentClassName="h-full"
            onClick={() => openBlock3Modal("pie")}
          >
            <SetPieceRevenuePieChart
              sets={dashboard.setPieceComparison.pieRevenueShare.sets}
              pieces={dashboard.setPieceComparison.pieRevenueShare.pieces}
              height={178}
              compact
              showLegend={false}
            />
          </MinimalCardButton>

          <DashboardModal
            trigger={
              <MinimalCardButton
                title="Pilotage achats / stock"
                subtitle="Projection cash/profit et signal achat"
                className={SQUARE_CARD_CLASS}
                contentClassName="h-full"
              >
                <ProcurementPreview
                  dashboard={dashboard}
                  isProcurementBlockPartial={isProcurementBlockPartial}
                />
              </MinimalCardButton>
            }
            title="Bloc 4 - Pilotage achats et stock"
            description="Vue mensuelle achats + projections, cohortes, lead-time et rotation theme."
            contentClassName="w-[min(96vw,1100px)]"
          >
            <ProcurementModalBody dashboard={dashboard} />
          </DashboardModal>
        </div>

        <div className="min-w-0 xl:h-full">
          <DashboardModal
            trigger={
              <MinimalCardButton
                title="Opportunites catalogue"
                subtitle="Top sets par potentiel de completion"
                tone="dark"
                className="min-h-[430px] xl:h-full"
                contentClassName="flex h-full min-h-0 flex-col gap-2"
              >
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-2xl border border-slate-700/70 bg-slate-900/80 p-3">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Top sets</p>
                    <p className="mt-1 text-3xl leading-none font-light text-slate-100">
                      {integer.format(dashboard.opportunities.length)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-700/70 bg-slate-900/80 p-3">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Best completion</p>
                    <p className="mt-1 text-3xl leading-none font-light text-sky-300">
                      {dashboard.opportunities[0]
                        ? `${percent.format(dashboard.opportunities[0].completionPercent)}%`
                        : "0%"}
                    </p>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-auto pr-1">
                  <OpportunitiesDarkPreview dashboard={dashboard} />
                </div>
              </MinimalCardButton>
            }
            title="Bloc 5 - Opportunites catalogue"
            description="Tableau detaille des sets exploitables par completion."
            contentClassName="w-[min(96vw,1080px)]"
            tone="dark"
          >
            <OpportunitiesModalBody dashboard={dashboard} />
          </DashboardModal>
        </div>
      </section>

      <DashboardModal
        open={block3ModalOpen}
        onOpenChange={setBlock3ModalOpen}
        title="Bloc 3 - Comparaison Sets vs Pieces"
        description="Lecture graphique par graphique pour une meilleure visibilite."
        contentClassName="w-[min(98vw,1180px)]"
      >
        <SetPieceModalBody dashboard={dashboard} initialView={block3InitialView} />
      </DashboardModal>
    </main>
  );
}

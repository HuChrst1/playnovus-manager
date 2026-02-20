"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Filter, TriangleAlert } from "lucide-react";
import {
  DASHBOARD_EXECUTIVE_ISSUE_MESSAGES,
  type DashboardExecutiveData,
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
  onClick,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex h-full w-full flex-col rounded-[24px] border border-slate-200 bg-white/95 p-4 text-left shadow-[0_12px_28px_rgba(15,23,42,0.08)] transition-transform hover:-translate-y-0.5",
        className
      )}
    >
      <div className="mb-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</p>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </button>
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
    <div className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 p-1">
      {FILTER_TIMELINE.map((item) => {
        const isActive = selectedPreset === item.preset;
        return (
          <button
            key={item.preset}
            type="button"
            onClick={() => onSelect(item.preset)}
            className={cn(
              "inline-flex h-8 shrink-0 items-center rounded-full px-3 text-[11px] font-semibold transition-colors",
              isActive
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-white hover:text-slate-900"
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
              : "border border-amber-200 bg-amber-50 text-amber-700"
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
    <div className="space-y-2 text-xs">
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
        <div className="inline-flex rounded-full border border-slate-200 bg-white p-1">
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
                "rounded-full px-3 py-1 text-xs font-medium",
                activeView === view
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-50"
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
                className="h-9 w-full rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-700"
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
                className="h-9 w-full rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-700"
              >
                <option value="week">Semaine</option>
                <option value="month">Mois</option>
              </select>
            </label>

            <Link
              href={toSalesHref(dashboard.filters)}
              className="inline-flex h-9 items-center justify-center rounded-full border border-slate-200 px-4 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
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

  return (
    <div className="space-y-4">
      <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
        <input
          type="checkbox"
          checked={showSales}
          onChange={(event) => setShowSales(event.target.checked)}
          className="h-3.5 w-3.5"
        />
        Afficher la correlation avec les ventes mensuelles
      </label>

      <ProcurementMonthlyChart
        points={dashboard.procurementStockSeries.points}
        showSalesCorrelation={showSales}
        height={360}
      />

      <div className="flex justify-end">
        <Link
          href={toProcurementHref(dashboard.filters)}
          className="inline-flex h-9 items-center rounded-full border border-slate-200 px-4 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          Ouvrir approvisionnements
        </Link>
      </div>
    </div>
  );
}

function OpportunitiesPreviewTable({ dashboard }: { dashboard: DashboardExecutiveData }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100">
      <table className="min-w-full text-xs">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className="px-2 py-2 text-left">Set</th>
            <th className="px-2 py-2 text-right">Comp.</th>
            <th className="px-2 py-2 text-right">Max</th>
          </tr>
        </thead>
        <tbody>
          {dashboard.opportunities.slice(0, 3).map((row) => (
            <tr key={row.key} className="border-t border-slate-100 bg-white">
              <td className="px-2 py-1.5 text-slate-700">{row.displayRef}</td>
              <td className="px-2 py-1.5 text-right text-slate-700">
                {percent.format(row.completionPercent)}%
              </td>
              <td className="px-2 py-1.5 text-right text-slate-700">{integer.format(row.maxCompleteSets)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OpportunitiesModalBody({ dashboard }: { dashboard: DashboardExecutiveData }) {
  const [limit, setLimit] = useState<"8" | "12" | "20">("12");
  const rows = dashboard.opportunities.slice(0, Number.parseInt(limit, 10));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
        <label className="space-y-1 text-xs font-medium text-slate-600">
          Volume affiche
          <select
            value={limit}
            onChange={(event) => setLimit(event.target.value as "8" | "12" | "20")}
            className="h-9 w-full rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-700"
          >
            <option value="8">Top 8</option>
            <option value="12">Top 12</option>
            <option value="20">Top 20</option>
          </select>
        </label>

        <Link
          href="/catalogue?sort=completion&dir=desc"
          className="inline-flex h-9 items-center justify-center rounded-full border border-slate-200 px-4 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          Ouvrir catalogue
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          Aucune opportunite detectee.
        </p>
      ) : (
        <div className="overflow-auto rounded-2xl border border-slate-100">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Set</th>
                <th className="px-3 py-2 text-right">Completion</th>
                <th className="px-3 py-2 text-right">Max sets</th>
                <th className="px-3 py-2 text-right">Pieces possedees</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-t border-slate-100 bg-white">
                  <td className="px-3 py-2">
                    <p className="font-medium text-slate-900">{row.displayRef}</p>
                    <p className="text-xs text-slate-500">{row.name}</p>
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700">
                    {percent.format(row.completionPercent)} %
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700">
                    {integer.format(row.maxCompleteSets)}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700">
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

  const activeTrendPoints = dashboard.trendSeries.byBucket[dashboard.filters.activeBucket];
  const stackedPoints = dashboard.stackedSalesSeries.byBucket[dashboard.stackedSalesSeries.defaultBucket];
  const groupedPoints =
    dashboard.setPieceComparison.groupedByBucket[dashboard.setPieceComparison.defaultBucket];

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

  return (
    <main className="space-y-6">
      <header className="rounded-[30px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-sky-50 px-5 py-3 shadow-[0_20px_48px_rgba(15,23,42,0.1)] md:px-6">
        <div className="grid items-center gap-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <h1 className="whitespace-nowrap text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
              DASHBOARD
            </h1>
          </div>

          <div className="min-w-0">
            {isDesktopFilterOpen ? (
              <div className="flex h-10 w-full max-w-full min-w-0 flex-nowrap items-center gap-2 overflow-x-auto whitespace-nowrap rounded-2xl border border-slate-200 bg-white px-2.5 shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
                <FilterTimeline selectedPreset={draftPreset} onSelect={applyPresetInstant} />

                <button
                  type="button"
                  onClick={() => setDraftPreset("custom")}
                  className={cn(
                    "inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-[11px] font-medium",
                    draftPreset === "custom"
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700"
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
                    className="h-8 w-[132px] rounded-full border border-slate-200 bg-white px-3 text-[11px] text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>

                <label className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-slate-500">
                  <span>Au</span>
                  <input
                    type="date"
                    value={draftTo}
                    onChange={(event) => setDraftTo(event.target.value)}
                    disabled={draftPreset !== "custom"}
                    className="h-8 w-[132px] rounded-full border border-slate-200 bg-white px-3 text-[11px] text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>

                <button
                  type="button"
                  onClick={applyFilters}
                  disabled={draftPreset !== "custom"}
                  className="inline-flex h-8 shrink-0 items-center justify-center rounded-full bg-slate-900 px-4 text-[11px] font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  Appliquer
                </button>

                <button
                  type="button"
                  onClick={() => {
                    router.push("/?preset=total");
                    setIsDesktopFilterOpen(false);
                  }}
                  className="inline-flex h-8 shrink-0 items-center justify-center rounded-full border border-slate-200 px-3 text-[11px] font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Reinitialiser
                </button>
              </div>
            ) : null}
          </div>

          <div className="flex justify-end sm:justify-self-end">
            <button
              type="button"
              onClick={openDesktopFilterPanel}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition-colors hover:bg-slate-50"
            >
              <Filter className="h-4 w-4" />
              Filtrer
            </button>
          </div>
        </div>
      </header>

      {dashboard.partial && (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="inline-flex items-center gap-2 font-medium">
            <TriangleAlert className="h-4 w-4" />
            Donnees partielles detectees sur le dashboard.
          </p>
          <ul className="mt-2 space-y-1 text-xs">
            {dashboard.issues.map((issue) => (
              <li key={issue}>- {DASHBOARD_EXECUTIVE_ISSUE_MESSAGES[issue]}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-5">
        {dashboard.kpis.map((kpi) => {
          const actionHref = getKpiActionHref(kpi.key, dashboard.filters);
          return (
            <DashboardModal
              key={kpi.key}
              trigger={
                <button
                  type="button"
                  className="group flex min-h-[126px] h-full w-full flex-col rounded-[24px] border border-slate-200 bg-white/95 p-4 text-left shadow-[0_12px_28px_rgba(15,23,42,0.08)] transition-transform hover:-translate-y-0.5"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {kpi.label}
                    </p>
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                        kpi.quality === "ok"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      )}
                    >
                      {qualityLabel(kpi.quality)}
                    </span>
                  </div>
                  <p className="text-2xl font-semibold tracking-tight text-slate-900">
                    {formatKpiValue(kpi)}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                    {kpi.quality === "partial" ? issueText(kpi.issue) : kpi.periodScope}
                  </p>
                </button>
              }
              title={kpi.label}
              description="Detail KPI avec mini-serie temporelle et filtres cibles."
            >
              <KpiModalBody dashboard={dashboard} kpi={kpi} actionHref={actionHref} />
            </DashboardModal>
          );
        })}
      </section>

      <section className="grid grid-cols-1 auto-rows-[minmax(176px,auto)] gap-4 md:grid-cols-2 xl:grid-cols-12">
        <DashboardModal
          trigger={
            <MinimalCardButton
              title="Tendances temporelles"
              subtitle="Courbes CA net et marge nette"
              className="md:col-span-2 xl:col-span-8 xl:row-span-2"
            >
              <TrendDualChart points={activeTrendPoints} height={220} compact showLegend={false} />
            </MinimalCardButton>
          }
          title="Bloc 2 - Tendances temporelles"
          description="Courbe principale avec variables additionnelles et lecture detaillee."
          contentClassName="w-[min(98vw,1220px)]"
        >
          <TrendModalBody dashboard={dashboard} />
        </DashboardModal>

        <DashboardModal
          trigger={
            <MinimalCardButton
              title="Cycles ventes"
              subtitle="Histogramme empile Sets / Pieces"
              className="xl:col-span-4"
            >
              <SalesStackedOrdersChart points={stackedPoints} height={138} compact showLegend={false} />
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
          className="xl:col-span-4"
          onClick={() => openBlock3Modal("grouped")}
        >
          <SetPieceGroupedMetricChart
            points={groupedPoints}
            metric="revenue"
            height={138}
            compact
            showLegend={false}
          />
          <p className="mt-2 text-[11px] text-slate-500">Apercu CA net (detail complet dans la modale).</p>
        </MinimalCardButton>

        <MinimalCardButton
          title="Comparatif rapide"
          subtitle="Tableau Sets vs Pieces"
          className="xl:col-span-4"
          onClick={() => openBlock3Modal("table")}
        >
          <SetPieceTablePreview dashboard={dashboard} />
        </MinimalCardButton>

        <MinimalCardButton
          title="Part de CA"
          subtitle="Camembert Sets / Pieces"
          className="xl:col-span-4"
          onClick={() => openBlock3Modal("pie")}
        >
          <SetPieceRevenuePieChart
            sets={dashboard.setPieceComparison.pieRevenueShare.sets}
            pieces={dashboard.setPieceComparison.pieRevenueShare.pieces}
            height={138}
            compact
            showLegend={false}
          />
        </MinimalCardButton>

        <DashboardModal
          trigger={
            <MinimalCardButton
              title="Pilotage achats / stock"
              subtitle="Histogramme mensuel + tendance"
              className="md:col-span-2 xl:col-span-6"
            >
              <ProcurementMonthlyChart
                points={dashboard.procurementStockSeries.points}
                height={150}
                compact
                showLegend={false}
              />
            </MinimalCardButton>
          }
          title="Bloc 4 - Pilotage achats et stock"
          description="Vue mensuelle des achats avec correlation ventes optionnelle."
          contentClassName="w-[min(96vw,1100px)]"
        >
          <ProcurementModalBody dashboard={dashboard} />
        </DashboardModal>

        <DashboardModal
          trigger={
            <MinimalCardButton
              title="Opportunites catalogue"
              subtitle="Top sets par potentiel de completion"
              className="md:col-span-2 xl:col-span-6"
            >
              <OpportunitiesPreviewTable dashboard={dashboard} />
            </MinimalCardButton>
          }
          title="Bloc 5 - Opportunites catalogue"
          description="Tableau detaille des sets exploitables par completion."
          contentClassName="w-[min(96vw,1080px)]"
        >
          <OpportunitiesModalBody dashboard={dashboard} />
        </DashboardModal>
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

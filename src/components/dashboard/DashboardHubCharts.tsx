"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  DashboardProcurementStockPoint,
  DashboardSetPieceGroupedPoint,
  DashboardStackedSalesPoint,
  DashboardTrendPoint,
} from "@/lib/dashboard";

const euro = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const compactNumber = new Intl.NumberFormat("fr-FR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const integer = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 0,
});

const percent = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const CHART_COLORS = {
  grid: "#DBEAFE",
  axis: "#4B6AA3",
  primary: "#1E3A8A",
  secondary: "#1D4ED8",
  tertiary: "#2563EB",
  quaternary: "#0284C7",
  soft: "#0EA5E9",
  softer: "#38BDF8",
} as const;

function safeNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

type TrendSeriesKey =
  | "netRevenue"
  | "netMargin"
  | "stockValue"
  | "procurementCost"
  | "salesCount";

function extractTrendSeriesValue(
  point: DashboardTrendPoint,
  key: TrendSeriesKey
): number | null {
  switch (key) {
    case "netRevenue":
      return point.netRevenue;
    case "netMargin":
      return point.netMargin;
    case "stockValue":
      return point.stockValue;
    case "procurementCost":
      return point.procurementCost;
    case "salesCount":
      return point.salesCount;
  }
}

function getTrendUnifiedYAxisDomain(
  points: DashboardTrendPoint[],
  seriesKeys: TrendSeriesKey[]
): [number, number] {
  const values: number[] = [];

  for (const point of points) {
    for (const seriesKey of seriesKeys) {
      const value = extractTrendSeriesValue(point, seriesKey);
      if (typeof value === "number" && Number.isFinite(value)) {
        values.push(value);
      }
    }
  }

  if (values.length === 0) return [0, 1];

  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) {
    const pad = Math.max(Math.abs(min) * 0.08, 1);
    return [min - pad, max + pad];
  }

  const span = max - min;
  const pad = Math.max(span * 0.08, 1);
  return [min - pad, max + pad];
}

function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
      {message}
    </div>
  );
}

type TrendDualChartProps = {
  points: DashboardTrendPoint[];
  showNetRevenue?: boolean;
  showNetMargin?: boolean;
  showStockValue?: boolean;
  showSalesCount?: boolean;
  showProcurementCost?: boolean;
  showLegend?: boolean;
  compact?: boolean;
  height?: number;
};

export function TrendDualChart({
  points,
  showNetRevenue = true,
  showNetMargin = true,
  showStockValue = false,
  showSalesCount = false,
  showProcurementCost = false,
  showLegend = true,
  compact = false,
  height = 300,
}: TrendDualChartProps) {
  if (points.length === 0) {
    return <EmptyChartState message="Aucune donnee disponible sur la periode." />;
  }

  const visibleSeriesKeys: TrendSeriesKey[] = [];
  if (showNetRevenue) visibleSeriesKeys.push("netRevenue");
  if (showNetMargin) visibleSeriesKeys.push("netMargin");
  if (showStockValue) visibleSeriesKeys.push("stockValue");
  if (showProcurementCost) visibleSeriesKeys.push("procurementCost");
  if (showSalesCount) visibleSeriesKeys.push("salesCount");

  const effectiveSeriesKeys =
    visibleSeriesKeys.length > 0 ? visibleSeriesKeys : (["netRevenue", "netMargin"] as TrendSeriesKey[]);
  const yDomain = getTrendUnifiedYAxisDomain(points, effectiveSeriesKeys);
  const yTickFormatter =
    effectiveSeriesKeys.length === 1 && effectiveSeriesKeys[0] === "salesCount"
      ? (value: unknown) => integer.format(safeNumber(value))
      : (value: unknown) => compactNumber.format(safeNumber(value));

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="4 4" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: compact ? 10 : 11, fill: CHART_COLORS.axis }}
            interval={compact ? "preserveStartEnd" : 0}
            minTickGap={compact ? 24 : 12}
          />
          <YAxis
            domain={yDomain}
            tick={{ fontSize: compact ? 10 : 11, fill: CHART_COLORS.axis }}
            tickFormatter={yTickFormatter}
          />
          <Tooltip
            formatter={(
              value: number,
              name: string,
              item: { dataKey?: string | number } | undefined
            ) => {
              const dataKey =
                typeof item?.dataKey === "string"
                  ? item.dataKey
                  : typeof name === "string"
                    ? name
                    : "";
              const labels: Record<string, string> = {
                netRevenue: "CA net",
                netMargin: "Marge nette",
                stockValue: "Valeur stock",
                salesCount: "Nombre ventes",
                procurementCost: "Cout appro",
              };

              if (dataKey === "salesCount") {
                return [integer.format(safeNumber(value)), labels[dataKey] ?? name];
              }

              return [euro.format(safeNumber(value)), labels[dataKey] ?? name];
            }}
          />
          {showLegend ? <Legend /> : null}

          {showNetRevenue && (
            <Line
              type="monotone"
              dataKey="netRevenue"
              stroke={CHART_COLORS.primary}
              strokeWidth={2.5}
              dot={false}
              name="CA net"
            />
          )}
          {showNetMargin && (
            <Line
              type="monotone"
              dataKey="netMargin"
              stroke={CHART_COLORS.secondary}
              strokeWidth={2.5}
              dot={false}
              name="Marge nette"
            />
          )}

          {showStockValue && (
            <Line
              type="monotone"
              dataKey="stockValue"
              stroke={CHART_COLORS.tertiary}
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              name="Valeur stock"
            />
          )}

          {showProcurementCost && (
            <Line
              type="monotone"
              dataKey="procurementCost"
              stroke={CHART_COLORS.quaternary}
              strokeWidth={2}
              dot={false}
              name="Cout appro"
            />
          )}

          {showSalesCount && (
            <Line
              type="monotone"
              dataKey="salesCount"
              stroke={CHART_COLORS.soft}
              strokeWidth={2}
              dot={false}
              name="Nombre ventes"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function KpiSparklineChart({
  points,
  metric,
  scale = 1,
  height = 190,
}: {
  points: DashboardTrendPoint[];
  metric:
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
  scale?: number;
  height?: number;
}) {
  if (points.length === 0) {
    return <EmptyChartState message="Serie indisponible." />;
  }

  const data =
    scale === 1
      ? points
      : points.map((point) => {
          const value = point[metric];
          return {
            ...point,
            [metric]: typeof value === "number" ? value * scale : value,
          };
        });

  const isCount = metric === "salesCount" || metric === "confirmedLotsCount";
  const isPercent =
    metric === "marginRate" ||
    metric === "stockRotation" ||
    metric === "immobilizationRate";

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="4 4" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: CHART_COLORS.axis }} />
          <YAxis
            tick={{ fontSize: 10, fill: CHART_COLORS.axis }}
            tickFormatter={(value) => {
              const number = safeNumber(value);
              if (isCount) return integer.format(number);
              if (isPercent) return `${percent.format(number)}%`;
              return compactNumber.format(number);
            }}
          />
          <Tooltip
            formatter={(value: number) => {
              const number = safeNumber(value);
              if (isCount) return [integer.format(number), "Valeur"];
              if (isPercent) return [`${percent.format(number)} %`, "Valeur"];
              return [euro.format(number), "Valeur"];
            }}
          />
          <Line
            type="monotone"
            dataKey={metric}
            stroke={CHART_COLORS.secondary}
            strokeWidth={2.2}
            dot={false}
            name="Serie"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SalesStackedOrdersChart({
  points,
  showLegend = true,
  compact = false,
  height = 260,
}: {
  points: DashboardStackedSalesPoint[];
  showLegend?: boolean;
  compact?: boolean;
  height?: number;
}) {
  if (points.length === 0) {
    return <EmptyChartState message="Aucune vente confirmee sur la periode." />;
  }

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="4 4" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: compact ? 10 : 11, fill: CHART_COLORS.axis }}
            interval={compact ? "preserveStartEnd" : 0}
            minTickGap={compact ? 24 : 10}
          />
          <YAxis
            tick={{ fontSize: compact ? 10 : 11, fill: CHART_COLORS.axis }}
            tickFormatter={(value) => integer.format(safeNumber(value))}
          />
          <Tooltip
            formatter={(value: number, name: string) => {
              const label = name === "sets" ? "Sets" : "Pieces";
              return [integer.format(safeNumber(value)), label];
            }}
          />
          {showLegend ? <Legend /> : null}
          <Bar dataKey="sets" stackId="sales" fill={CHART_COLORS.primary} name="Sets" radius={[6, 6, 0, 0]} />
          <Bar dataKey="pieces" stackId="sales" fill={CHART_COLORS.soft} name="Pieces" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export type SetPieceMetric = "revenue" | "margin" | "marginRate";

export function SetPieceGroupedMetricChart({
  points,
  metric,
  showLegend = true,
  compact = false,
  height = 280,
}: {
  points: DashboardSetPieceGroupedPoint[];
  metric: SetPieceMetric;
  showLegend?: boolean;
  compact?: boolean;
  height?: number;
}) {
  if (points.length === 0) {
    return <EmptyChartState message="Comparaison Sets/Pieces indisponible." />;
  }

  const mapped = points.map((point) => {
    if (metric === "margin") {
      return {
        key: point.key,
        label: point.label,
        sets: point.setMargin,
        pieces: point.pieceMargin,
      };
    }

    if (metric === "marginRate") {
      return {
        key: point.key,
        label: point.label,
        sets: point.setMarginRate ?? 0,
        pieces: point.pieceMarginRate ?? 0,
      };
    }

    return {
      key: point.key,
      label: point.label,
      sets: point.setRevenue,
      pieces: point.pieceRevenue,
    };
  });

  const yFormatter = (value: number) => {
    const number = safeNumber(value);
    if (metric === "marginRate") return `${percent.format(number)}%`;
    return compactNumber.format(number);
  };

  const tooltipFormatter = (value: number, name: string) => {
    if (metric === "marginRate") {
      return [`${percent.format(safeNumber(value))} %`, name === "sets" ? "Sets" : "Pieces"];
    }

    return [euro.format(safeNumber(value)), name === "sets" ? "Sets" : "Pieces"];
  };

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={mapped} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="4 4" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: compact ? 10 : 11, fill: CHART_COLORS.axis }}
            interval={compact ? "preserveStartEnd" : 0}
            minTickGap={compact ? 24 : 10}
          />
          <YAxis
            tick={{ fontSize: compact ? 10 : 11, fill: CHART_COLORS.axis }}
            tickFormatter={yFormatter}
          />
          <Tooltip formatter={tooltipFormatter} />
          {showLegend ? <Legend /> : null}
          <Bar dataKey="sets" fill={CHART_COLORS.secondary} name="Sets" radius={[6, 6, 0, 0]} />
          <Bar dataKey="pieces" fill={CHART_COLORS.softer} name="Pieces" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SetPieceRevenuePieChart({
  sets,
  pieces,
  showLegend = true,
  compact = false,
  height = 250,
}: {
  sets: number;
  pieces: number;
  showLegend?: boolean;
  compact?: boolean;
  height?: number;
}) {
  const data = [
    { key: "sets", name: "Sets", value: safeNumber(sets) },
    { key: "pieces", name: "Pieces", value: safeNumber(pieces) },
  ].filter((row) => row.value > 0);

  if (data.length === 0) {
    return <EmptyChartState message="Aucun CA a segmenter." />;
  }

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={compact ? 42 : 58}
            outerRadius={compact ? 70 : 94}
            paddingAngle={2}
          >
            <Cell key="sets" fill={CHART_COLORS.primary} />
            <Cell key="pieces" fill={CHART_COLORS.soft} />
          </Pie>
          <Tooltip
            formatter={(value: number) => [euro.format(safeNumber(value)), "CA net"]}
          />
          {showLegend ? <Legend /> : null}
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ProcurementMonthlyChart({
  points,
  showSalesCorrelation = false,
  showLegend = true,
  compact = false,
  height = 300,
}: {
  points: DashboardProcurementStockPoint[];
  showSalesCorrelation?: boolean;
  showLegend?: boolean;
  compact?: boolean;
  height?: number;
}) {
  if (points.length === 0) {
    return <EmptyChartState message="Serie achats mensuels indisponible." />;
  }

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="4 4" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: compact ? 10 : 11, fill: CHART_COLORS.axis }}
            interval={compact ? "preserveStartEnd" : 0}
            minTickGap={compact ? 24 : 10}
          />
          <YAxis
            tick={{ fontSize: compact ? 10 : 11, fill: CHART_COLORS.axis }}
            tickFormatter={(value) => compactNumber.format(safeNumber(value))}
          />
          <Tooltip
            formatter={(value: number, name: string) => {
              const labels: Record<string, string> = {
                procurementCost: "Cout appro",
                procurementTrend: "Tendance achats",
                salesNetRevenue: "CA ventes",
              };

              return [euro.format(safeNumber(value)), labels[name] ?? name];
            }}
          />
          {showLegend ? <Legend /> : null}
          <Bar
            dataKey="procurementCost"
            fill={CHART_COLORS.tertiary}
            name="Cout appro"
            radius={[6, 6, 0, 0]}
          />
          <Line
            type="monotone"
            dataKey="procurementTrend"
            stroke={CHART_COLORS.secondary}
            strokeWidth={2.3}
            dot={false}
            name="Tendance achats"
          />
          {showSalesCorrelation && (
            <Line
              type="monotone"
              dataKey="salesNetRevenue"
              stroke={CHART_COLORS.softer}
              strokeWidth={2}
              dot={false}
              strokeDasharray="4 4"
              name="CA ventes"
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

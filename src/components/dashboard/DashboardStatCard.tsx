"use client";

import { KpiCard, type KpiCardColor } from "@/components/ui/kpi-card";

export type DashboardStatCardColor = KpiCardColor;

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
  return (
    <KpiCard
      title={title}
      mainValue={mainValue}
      color={color}
      onClick={onClick}
      trend={{
        value: trendPercent,
        windowDays,
        label: windowLabel,
      }}
    />
  );
}

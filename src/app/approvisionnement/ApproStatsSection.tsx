"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardStatCard } from "@/components/dashboard/DashboardStatCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type ApproStatsForClient = {
  totalLotsConfirmed: number;
  totalPiecesConfirmed: number;
  totalCostConfirmed: number;
  avgCostPerPiece: number;

  lotsTrendPercent: number | null;
  piecesTrendPercent: number | null;
  costTrendPercent: number | null;
  avgCppTrendPercent: number | null;
};

type ApproStatsSectionProps = {
  stats: ApproStatsForClient;
  statsWindowDays: number;
};

type MetricKey = "lots" | "pieces" | "cost" | "avgcpp";

const METRIC_LABEL: Record<MetricKey, string> = {
  lots: "Lots confirmés",
  pieces: "Nb pièces totales",
  cost: "Coût total",
  avgcpp: "Coût / pièce moyen",
};

export function ApproStatsSection({
  stats,
  statsWindowDays,
}: ApproStatsSectionProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<MetricKey | null>(null);
  const [localWindow, setLocalWindow] = useState<string>(
    String(statsWindowDays || 30)
  );

  const openFor = (metric: MetricKey) => {
    setSelectedMetric(metric);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
  };

  const applyWindow = () => {
    let days = Number(localWindow);
    if (!Number.isFinite(days) || days <= 0) {
      days = 30;
    }

    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("stats_window", String(days));

    router.push(`/approvisionnement?${params.toString()}`);
    setIsDialogOpen(false);
  };

  const lotsLabel = stats.totalLotsConfirmed.toLocaleString("fr-FR");
  const piecesLabel = stats.totalPiecesConfirmed.toLocaleString("fr-FR");
  const costLabel = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(stats.totalCostConfirmed);
  const avgCppLabel =
    stats.totalPiecesConfirmed > 0
      ? new Intl.NumberFormat("fr-FR", {
          style: "currency",
          currency: "EUR",
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(stats.avgCostPerPiece)
      : "—";

  return (
    <>
      {/* SECTION CARDS */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {/* Lots confirmés */}
        <button
          type="button"
          onClick={() => openFor("lots")}
          className="text-left"
        >
          <DashboardStatCard
            title="Lots confirmés"
            mainValue={lotsLabel}
            trendPercent={stats.lotsTrendPercent}
            color="indigo"
            windowDays={statsWindowDays}
          />
        </button>

        {/* Nb pièces totales */}
        <button
          type="button"
          onClick={() => openFor("pieces")}
          className="text-left"
        >
          <DashboardStatCard
            title="Nb Pièces totales"
            mainValue={piecesLabel}
            trendPercent={stats.piecesTrendPercent}
            color="orange"
            windowDays={statsWindowDays}
          />
        </button>

        {/* Coût total */}
        <button
          type="button"
          onClick={() => openFor("cost")}
          className="text-left"
        >
          <DashboardStatCard
            title="Coût total"
            mainValue={costLabel}
            trendPercent={stats.costTrendPercent}
            color="amber"
            windowDays={statsWindowDays}
          />
        </button>

        {/* Coût / pièce moyen */}
        <button
          type="button"
          onClick={() => openFor("avgcpp")}
          className="text-left"
        >
          <DashboardStatCard
            title="Coût / pièce moyen"
            mainValue={avgCppLabel}
            trendPercent={stats.avgCppTrendPercent}
            color="emerald"
            windowDays={statsWindowDays}
          />
        </button>
      </section>

      {/* POP-UP DE SÉLECTION DE PÉRIODE */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Période d&apos;analyse
              {selectedMetric && (
                <span className="block text-xs font-normal text-slate-500 mt-1">
                  Pour : {METRIC_LABEL[selectedMetric]}
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              Choisis la taille de la fenêtre temporelle utilisée pour
              comparer avec la période précédente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <label className="block text-xs font-medium text-slate-600">
              Taille de la fenêtre (en jours)
            </label>

            <select
              value={localWindow}
              onChange={(e) => setLocalWindow(e.target.value)}
              className="w-full rounded-full border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-primary"
            >
              <option value="7">7 derniers jours</option>
              <option value="30">30 derniers jours</option>
              <option value="90">90 derniers jours</option>
              <option value="365">365 derniers jours</option>
            </select>

            <p className="text-[11px] text-slate-500">
              Cette période s&apos;appliquera à toutes les cartes
              d&apos;approvisionnement. La pastille affichera :
              &nbsp;
              <span className="font-semibold">
                vs {Number(localWindow) || 30} derniers jours
              </span>
              .
            </p>
          </div>

          <DialogFooter className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full px-4"
              onClick={closeDialog}
            >
              Annuler
            </Button>
            <Button
              type="button"
              size="sm"
              className="rounded-full px-4"
              onClick={applyWindow}
            >
              Appliquer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
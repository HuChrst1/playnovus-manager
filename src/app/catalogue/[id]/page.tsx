import { supabase } from "@/lib/supabase";
import { getStockForPieces } from "@/lib/stock";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { SetPartsList } from "@/components/catalogue/set-parts-list";
import { SetImage } from "@/components/catalogue/set-image";
import { EditPhotoButton } from "@/components/catalogue/edit-photo-button";
import { EditSetDialog } from "@/components/catalogue/edit-set-dialog";
import { EditPieceDialog } from "@/components/catalogue/edit-piece-dialog";

export default async function SetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const setId = decodeURIComponent(id);

  // 1. Données
  const { data: set } = await supabase
    .from("sets_catalog")
    .select("*")
    .eq("id", setId)
    .single();

  if (!set) {
    return (
      <main className="p-6 text-red-500 font-bold">
        Set introuvable
      </main>
    );
  }

    // 2. BOM du set
    const { data: bomData } = await supabase
    .from("sets_bom")
    .select("*")
    .eq("set_id", setId)
    .order("piece_ref", { ascending: true });

  type BomRow = {
    id: number;
    set_id: string;
    piece_ref: string;
    quantity: number;
    piece_name: string | null;
  };

  const bom = (bomData ?? []) as BomRow[];

  const pieceRefs =
    bom.map((p) => p.piece_ref as string).filter(Boolean) || [];

  // On récupère le stock depuis la vue stock_per_piece via le helper
  const stockByPiece = await getStockForPieces(pieceRefs);

  // 3. Calculs complétion
  // On garde la même structure que précédemment :
  // chaque "part" a un champ inStock utilisé par SetPartsList.
  const partsWithStock = bom.map((part) => {
    const stockInfo = stockByPiece[part.piece_ref] ?? {
      totalQuantity: 0,
      avgUnitCost: null,
      totalValue: 0,
    };

    return {
      ...part,
      inStock: stockInfo.totalQuantity,
    };
  });

  const completionStats = partsWithStock.reduce(
    (acc, part) => {
      const totalPartsNeeded = acc.totalPartsNeeded + part.quantity;
      const totalPartsOwned = acc.totalPartsOwned + Math.min(part.inStock, part.quantity);

      const setsForThisPart =
        part.quantity > 0 ? Math.floor(part.inStock / part.quantity) : null;

      const maxCompleteSets =
        setsForThisPart === null
          ? acc.maxCompleteSets
          : acc.maxCompleteSets === null
            ? setsForThisPart
            : Math.min(acc.maxCompleteSets, setsForThisPart);

      return {
        totalPartsNeeded,
        totalPartsOwned,
        maxCompleteSets,
      };
    },
    {
      totalPartsNeeded: 0,
      totalPartsOwned: 0,
      maxCompleteSets: null as number | null,
    }
  );

  const totalPartsNeeded = completionStats.totalPartsNeeded;
  const totalPartsOwned = completionStats.totalPartsOwned;
  const maxCompleteSets = completionStats.maxCompleteSets ?? 0;

  const completionPercent =
    totalPartsNeeded > 0
      ? Math.round((totalPartsOwned / totalPartsNeeded) * 100)
      : 0;

  // Normalisation pour cohérence avec /catalogue
  const versionLabel =
    set.version && set.version !== "Version Unique" ? set.version : "Unique";

  const yearStartLabel = set.year_start ?? "N/A";
  const yearEndLabel = set.year_end ?? "N/A";

  // 3. RENDER
  return (
    <main className="space-y-6">
      {/* HEADER FICHE SET */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {set.display_ref} – {set.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Fiche détaillée du set.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            asChild
            className="rounded-full px-4"
          >
            <Link href="/catalogue">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour catalogue
            </Link>
          </Button>

          <EditPhotoButton setId={set.id} currentUrl={set.image_url} />
          <EditSetDialog set={set} />
        </div>
      </div>

      {/* LAYOUT PRINCIPAL */}
      <div className="grid gap-6 lg:grid-cols-[minmax(320px,360px)_1fr]">
        {/* COLONNE GAUCHE : image + fiche technique */}
        <div className="space-y-4">
          {/* Aperçu / image */}
          <Card className="border border-slate-200 shadow-sm rounded-3xl overflow-hidden">
            <div className="px-5 pt-4 pb-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Aperçu du set
              </p>
            </div>
            <CardContent className="pt-0 px-5 pb-5">
              <SetImage url={set.image_url} name={set.name} />
            </CardContent>
          </Card>

          {/* Fiche technique */}
          <Card className="border border-slate-200 shadow-sm rounded-3xl overflow-hidden">
            <CardHeader className="py-3 px-5 border-b border-slate-100 bg-slate-50/80">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-[0.22em]">
                Fiche technique
              </CardTitle>
            </CardHeader>

            <CardContent className="p-0 bg-white text-sm divide-y divide-slate-100">
              <div className="flex items-center justify-between px-5 py-4">
                <span className="text-slate-500 font-medium">Référence</span>
                <Badge variant="outline" className="rounded-full px-3">
                  {set.display_ref}
                </Badge>
              </div>

              <div className="flex items-center justify-between px-5 py-4">
                <span className="text-slate-500 font-medium">Version</span>
                <span className="font-semibold">{versionLabel}</span>
              </div>

              <div className="flex items-center justify-between px-5 py-4">
                <span className="text-slate-500 font-medium">Dates</span>
                <span>
                  {yearStartLabel} – {yearEndLabel}
                </span>
              </div>

              <div className="flex items-center justify-between px-5 py-4">
                <span className="text-slate-500 font-medium">Thème</span>
                <span className="text-right truncate pl-4">
                  {set.theme || "-"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* COLONNE DROITE : inventaire + jauge violette */}
        <Card className="border border-slate-200 shadow-md rounded-3xl flex flex-col overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 bg-white">
            <div className="mb-4 flex items-end justify-between gap-6">
              <div>
                <h2 className="text-sm font-semibold tracking-[0.16em] uppercase text-slate-500">
                  Inventaire ({partsWithStock.length})
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  <span className="font-semibold text-slate-900">
                    {totalPartsOwned}
                  </span>{" "}
                  / {totalPartsNeeded} pièces physiques
                </p>
              </div>

              <div className="flex items-center gap-4">
                <EditPieceDialog setId={set.id} />
                <div className="flex flex-col items-end">
                  <span className="mb-1 text-xs font-medium text-slate-500">
                    Complétion
                  </span>

                  <div className="flex items-center gap-2">
                    <span className="text-4xl font-semibold leading-none text-[#5b4bff]">
                      {completionPercent}%
                    </span>

                    {typeof maxCompleteSets === "number" &&
                      maxCompleteSets > 0 && (
                        <span className="inline-flex items-center rounded-full bg-slate-900/5 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                          x{maxCompleteSets}
                        </span>
                      )}
                  </div>
                </div>
              </div>
            </div>

            {/* Jauge violette */}
            <div className="h-3.5 w-full rounded-full border border-slate-200 bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#5b4bff] transition-all duration-700 ease-out"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
          </div>

          <div className="flex-1 bg-white overflow-y-auto max-h-[720px]">
            <SetPartsList parts={partsWithStock} />
          </div>
        </Card>
      </div>
    </main>
  );
}

import { supabase } from "@/lib/supabase";
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

  const { data: bom } = await supabase
    .from("sets_bom")
    .select("*")
    .eq("set_id", setId)
    .order("piece_ref", { ascending: true });

  const pieceRefs = bom?.map((p) => p.piece_ref) || [];

  const { data: inventory } = await supabase
    .from("inventory")
    .select("piece_ref, quantity")
    .in("piece_ref", pieceRefs);

  // 2. Calculs
  let totalPartsNeeded = 0;
  let totalPartsOwned = 0;

  const partsWithStock =
    bom?.map((part) => {
      const stockLines = inventory?.filter(
        (i) => i.piece_ref === part.piece_ref
      );
      const qtyInStock =
        stockLines?.reduce((acc, curr) => acc + curr.quantity, 0) || 0;

      totalPartsNeeded += part.quantity;
      totalPartsOwned += Math.min(qtyInStock, part.quantity);

      return { ...part, inStock: qtyInStock };
    }) || [];

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
    <main className="space-y-6 min-w-[1024px]">
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
                  <span className="text-4xl font-semibold leading-none text-[#5b4bff]">
                    {completionPercent}%
                  </span>
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

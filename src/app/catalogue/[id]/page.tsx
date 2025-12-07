import { supabase } from "@/lib/supabase";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Pencil } from "lucide-react";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { SetPartsList } from "@/components/catalogue/set-parts-list";
import { SetImage } from "@/components/catalogue/set-image";
import { EditPhotoButton } from "@/components/catalogue/edit-photo-button";
import { EditSetDialog } from "@/components/catalogue/edit-set-dialog";
import { EditPieceDialog } from "@/components/catalogue/edit-piece-dialog"; // Import

export default async function SetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const setId = decodeURIComponent(id);

  // 1. Données
  const { data: set } = await supabase.from("sets_catalog").select("*").eq("id", setId).single();
  if (!set) return <div className="p-10 text-red-500 font-bold">Set introuvable</div>;

  const { data: bom } = await supabase.from("sets_bom").select("*").eq("set_id", setId).order("piece_ref", { ascending: true });
  const pieceRefs = bom?.map((p) => p.piece_ref) || [];
  const { data: inventory } = await supabase.from("inventory").select("piece_ref, quantity").in("piece_ref", pieceRefs);

  // 2. Calculs
  let totalPartsNeeded = 0;
  let totalPartsOwned = 0;
  const partsWithStock = bom?.map((part) => {
    const stockLines = inventory?.filter((i) => i.piece_ref === part.piece_ref);
    const qtyInStock = stockLines?.reduce((acc, curr) => acc + curr.quantity, 0) || 0;
    totalPartsNeeded += part.quantity;
    totalPartsOwned += Math.min(qtyInStock, part.quantity);
    return { ...part, inStock: qtyInStock };
  }) || [];
  const completionPercent = totalPartsNeeded > 0 ? Math.round((totalPartsOwned / totalPartsNeeded) * 100) : 0;
  
  // Normalisation pour que la fiche soit cohérente avec /catalogue
  const versionLabel =
    set.version && set.version !== "Version Unique" ? set.version : "Unique";

  const yearStartLabel = set.year_start ?? "N/A";
  const yearEndLabel = set.year_end ?? "N/A";

  return (
    <div className="min-h-screen bg-zinc-50 p-6 min-w-[1024px]">
      <div className="max-w-[1900px] mx-auto space-y-6">
        
        {/* Navigation */}
        <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-zinc-200 shadow-sm">
          <Link href="/catalogue">
            <Button variant="ghost" className="text-zinc-600 hover:bg-zinc-100">
              <ArrowLeft className="h-4 w-4 mr-2" /> Retour Catalogue
            </Button>
          </Link>
          <div className="flex gap-2">
            <EditPhotoButton setId={set.id} currentUrl={set.image_url} />
            <EditSetDialog set={set} />
          </div>
        </div>

        {/* Layout */}
        <div className="flex flex-row gap-8 items-start">
          
          {/* Gauche */}
          <div className="w-[35%] min-w-[380px] flex flex-col gap-6 sticky top-6">
            <div>
              <h1 className="text-2xl font-black text-zinc-900 mb-4 leading-tight px-1">
                {set.name}
              </h1>
              <SetImage url={set.image_url} name={set.name} />
            </div>
            <Card className="border-zinc-300 shadow-sm rounded-xl">
              <CardHeader className="py-3 px-5 bg-zinc-100 border-zinc-200">
                <CardTitle className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                  Fiche Technique
                </CardTitle>
              </CardHeader>
              <div className="text-sm divide-y divide-zinc-100 bg-white">
                {/* Référence – inchangé */}
                <div className="flex justify-between items-center p-4">
                  <span className="text-zinc-500 font-medium">Référence</span>
                  <Badge variant="outline">{set.display_ref}</Badge>
                </div>

                {/* Version – utilise versionLabel */}
                <div className="flex justify-between items-center p-4">
                  <span className="text-zinc-500 font-medium">Version</span>
                  <span className="font-bold">{versionLabel}</span>
                </div>

                {/* Dates – utilise yearStartLabel / yearEndLabel */}
                <div className="flex justify-between items-center p-4">
                  <span className="text-zinc-500 font-medium">Dates</span>
                  <span>
                    {yearStartLabel} - {yearEndLabel}
                  </span>
                </div>

                {/* Thème – inchangé */}
                <div className="flex justify-between items-center p-4">
                  <span className="text-zinc-500 font-medium">Thème</span>
                  <span className="text-right truncate pl-4">
                    {set.theme || "-"}
                  </span>
                </div>
              </div>
            </Card>
          </div>

          {/* Droite */}
          <div className="flex-1 flex flex-col h-full min-h-[600px]">
            <Card className="flex flex-col h-full border-zinc-300 shadow-md rounded-xl overflow-hidden">
                <div className="p-6 border-b border-zinc-200 bg-white sticky top-0 z-10 shadow-sm">
                    <div className="flex justify-between items-end mb-3">
                        <div>
                            <h2 className="text-lg font-bold text-zinc-800 uppercase tracking-wide">Inventaire ({partsWithStock.length})</h2>
                            <p className="text-sm font-medium text-zinc-500 mt-1">
                                <span className="font-bold text-zinc-900">{totalPartsOwned}</span> / {totalPartsNeeded} pièces physiques
                            </p>
                        </div>
                        <div className="flex items-center gap-6">
                            {/* BOUTON AJOUTER ICI */}
                            <EditPieceDialog setId={set.id} />
                            <span className={`text-5xl font-black tracking-tighter ${completionPercent === 100 ? 'text-emerald-500' : 'text-blue-600'}`}>
                                {completionPercent}%
                            </span>
                        </div>
                    </div>
                    <div className="h-4 w-full bg-zinc-100 rounded-full overflow-hidden border border-zinc-200 relative">
                        <div 
                            className={`h-full transition-all duration-1000 ease-out ${completionPercent === 100 ? 'bg-emerald-500' : 'bg-blue-600'}`}
                            style={{ width: `${completionPercent}%` }}
                        />
                    </div>
                </div>
                <div className="flex-1 bg-white overflow-y-auto max-h-[800px]">
                    <SetPartsList parts={partsWithStock} />
                </div>
            </Card>
          </div>

        </div>
      </div>
    </div>
  );
}
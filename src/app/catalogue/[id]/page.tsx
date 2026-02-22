import { supabase } from "@/lib/supabase";
import { getStockForPieces } from "@/lib/stock";
import { Badge } from "@/components/ui/badge";
import { SetPartsList } from "@/components/catalogue/set-parts-list";
import { SetImage } from "@/components/catalogue/set-image";
import { EditSetDialog } from "@/components/catalogue/edit-set-dialog";

export default async function SetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const setId = decodeURIComponent(id);

  const { data: set } = await supabase
    .from("sets_catalog")
    .select("*")
    .eq("id", setId)
    .single();

  if (!set) {
    return (
      <main className="space-y-4 px-1 py-4 md:px-2">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Catalogue
        </h1>
        <p className="text-sm font-medium text-rose-600">Set introuvable.</p>
      </main>
    );
  }

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
  const pieceRefs = bom.map((part) => part.piece_ref).filter(Boolean);
  const stockByPiece = await getStockForPieces(pieceRefs);

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
      const totalPartsOwned =
        acc.totalPartsOwned + Math.min(part.inStock, part.quantity);

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

  const versionLabel =
    set.version && set.version !== "Version Unique" ? set.version : "Unique";

  const yearStartLabel = set.year_start ?? "N/A";
  const yearEndLabel = set.year_end ?? "N/A";

  return (
    <main className="space-y-6 catalogue-detail-shell">
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-medium tracking-tight text-slate-900 md:text-[42px] md:leading-none">
            {set.display_ref} - {set.name}
          </h1>
          <p className="mt-1 text-sm text-slate-500">Fiche détaillée du set.</p>
        </div>
      </header>

      <div className="catalogue-detail-grid">
        <aside className="space-y-4">
          <section className="catalogue-detail-meta-card">
            <p className="app-section-label mb-3">Aperçu du set</p>
            <SetImage url={set.image_url} name={set.name} />
          </section>

          <section className="catalogue-detail-meta-card">
            <div className="catalogue-detail-meta-head">
              <p className="app-section-label">Fiche technique</p>
              <EditSetDialog set={set} variant="card" />
            </div>

            <dl className="catalogue-detail-meta-list">
              <div className="catalogue-detail-meta-row">
                <dt className="catalogue-detail-meta-label">Référence</dt>
                <dd>
                  <Badge variant="outline" className="rounded-full px-3 text-xs font-medium">
                    {set.display_ref}
                  </Badge>
                </dd>
              </div>

              <div className="catalogue-detail-meta-row">
                <dt className="catalogue-detail-meta-label">Version</dt>
                <dd className="catalogue-detail-meta-value">{versionLabel}</dd>
              </div>

              <div className="catalogue-detail-meta-row">
                <dt className="catalogue-detail-meta-label">Dates</dt>
                <dd className="catalogue-detail-meta-value">
                  {yearStartLabel} - {yearEndLabel}
                </dd>
              </div>

              <div className="catalogue-detail-meta-row">
                <dt className="catalogue-detail-meta-label">Thème</dt>
                <dd className="catalogue-detail-meta-value text-right">
                  {set.theme || "-"}
                </dd>
              </div>
            </dl>
          </section>
        </aside>

        <section className="space-y-4">
          <div className="catalogue-detail-summary">
            <div className="catalogue-detail-summary-top">
              <div>
                <p className="app-section-label mb-1.5">
                  Inventaire ({partsWithStock.length})
                </p>
                <p className="text-sm text-slate-500">
                  <span className="font-semibold text-slate-900">{totalPartsOwned}</span> / {" "}
                  {totalPartsNeeded} pièces physiques
                </p>
              </div>

              <div className="flex items-end gap-2">
                <span className="text-4xl font-semibold leading-none text-cyan-600">
                  {completionPercent}%
                </span>
                {maxCompleteSets > 0 ? (
                  <span className="inline-flex items-center rounded-full bg-slate-900/5 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                    x{maxCompleteSets}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="catalogue-detail-gauge">
              <div
                className="catalogue-detail-gauge-fill"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
          </div>

          <SetPartsList setId={set.id} parts={partsWithStock} />
        </section>
      </div>
    </main>
  );
}

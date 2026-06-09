"use client";

import { Fragment, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EditPieceDialog } from "@/components/catalogue/edit-piece-dialog";
import { DeletePieceButton } from "@/components/catalogue/delete-piece-button";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, CircleAlert } from "lucide-react";

interface PartWithStock {
  id: number;
  set_id: string;
  piece_ref: string;
  piece_name: string | null;
  quantity: number;
  line_comment: string | null;
  inStock: number;
}

export function SetPartsList({
  setId,
  parts,
}: {
  setId: string;
  parts: PartWithStock[];
}) {
  const [showGauges, setShowGauges] = useState(true);
  const [qteView, setQteView] = useState<"compact" | "detailed">("compact");

  const isDetailedQteView = qteView === "detailed";
  const gaugeColSpan = isDetailedQteView ? 5 : 4;
  const toggleQteView = () =>
    setQteView((current) => (current === "compact" ? "detailed" : "compact"));

  return (
    <section className="space-y-3">
      <div className="catalogue-detail-table-toolbar catalogue-detail-table-toolbar--external">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-9 px-4 text-xs font-medium"
            onClick={() => setShowGauges((current) => !current)}
            aria-pressed={showGauges}
          >
            {showGauges
              ? "Masquer les jauges de complétion"
              : "Afficher les jauges de complétion"}
          </Button>
        </div>

        <EditPieceDialog
          setId={setId}
          triggerClassName="h-9 gap-2 px-4 text-xs font-medium"
        />
      </div>

      {parts.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-slate-200 bg-white/88 px-4 py-14 text-center text-sm italic text-slate-400">
          Aucune pièce associée à ce set.
        </div>
      ) : (
        <div className="appro-table-scroll max-w-full overflow-x-hidden">
          <table className="appro-table w-full table-fixed text-sm">
            <colgroup>
              {isDetailedQteView ? (
                <>
                  <col className="w-[104px] sm:w-[132px]" />
                  <col className="w-[104px] sm:w-[132px]" />
                </>
              ) : (
                <col className="w-[88px] sm:w-[112px]" />
              )}
              <col className="w-[116px] sm:w-[152px] lg:w-[172px]" />
              <col />
              <col className="w-[88px] sm:w-[104px]" />
            </colgroup>
            <thead className="appro-table-header">
              <tr>
                {isDetailedQteView ? (
                  <>
                    <th className="px-3 py-3 text-right font-medium sm:px-4">
                      <div className="inline-flex max-w-full items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={toggleQteView}
                          className="app-btn-soft-icon h-5 w-5 text-slate-500 hover:text-slate-800"
                          aria-label="Basculer l'affichage des colonnes QTE"
                          title="Masquer QTE stock/attendus"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                        <span className="min-w-0 truncate">QTE en stock</span>
                      </div>
                    </th>
                    <th className="px-3 py-3 text-right font-medium sm:px-4">
                      QTE attendus
                    </th>
                  </>
                ) : (
                  <th className="px-3 py-3 text-right font-medium sm:px-4">
                    <div className="inline-flex max-w-full items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={toggleQteView}
                        className="app-btn-soft-icon h-5 w-5 text-slate-500 hover:text-slate-800"
                        aria-label="Basculer l'affichage des colonnes QTE"
                        title="Démasquer QTE stock/attendus"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                      <span className="min-w-0 truncate">Qté</span>
                    </div>
                  </th>
                )}
                <th className="px-3 py-3 text-left font-medium sm:px-4">Réf.</th>
                <th className="px-3 py-3 text-left font-medium sm:px-4">
                  Description
                </th>
                <th className="px-2 py-3 text-right font-medium sm:px-4">Actions</th>
              </tr>
            </thead>

            <tbody>
              {parts.map((part) => {
                const ratio = part.quantity > 0 ? part.inStock / part.quantity : 0;
                const clampedRatio = Math.min(1, Math.max(0, ratio));
                const percentage = Math.round(clampedRatio * 100);
                const lineComment = part.line_comment?.trim();

                return (
                  <Fragment key={part.id}>
                    <tr className="appro-table-row">
                      {isDetailedQteView ? (
                        <>
                          <td className="px-3 py-3 text-right tabular-nums font-semibold text-slate-800 sm:px-4">
                            {part.inStock}
                          </td>

                          <td className="px-3 py-3 text-right tabular-nums text-slate-700 sm:px-4">
                            {part.quantity}
                          </td>
                        </>
                      ) : (
                        <td className="px-3 py-3 text-right tabular-nums font-semibold text-slate-800 sm:px-4">
                          {part.inStock}/{part.quantity}
                        </td>
                      )}

                      <td className="min-w-0 px-3 py-3 font-mono text-xs text-slate-700 sm:px-4">
                        {lineComment ? (
                          <span className="inline-flex max-w-full min-w-0 items-center gap-1.5">
                            <span className="min-w-0 select-all break-words">
                              {part.piece_ref}
                            </span>
                            <Popover>
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-amber-600 transition-colors hover:bg-amber-50 hover:text-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/35"
                                  aria-label={`Commentaire pour ${part.piece_ref}`}
                                  title="Voir le commentaire"
                                >
                                  <CircleAlert className="h-3.5 w-3.5" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="z-50 w-72 border-amber-100 bg-white/98 p-3 text-sm shadow-xl">
                                <p className="text-xs font-semibold text-amber-700">
                                  Commentaire
                                </p>
                                <p className="mt-2 whitespace-pre-wrap break-words text-slate-700">
                                  {lineComment}
                                </p>
                              </PopoverContent>
                            </Popover>
                          </span>
                        ) : (
                          <span className="select-all break-words">
                            {part.piece_ref}
                          </span>
                        )}
                      </td>

                      <td className="min-w-0 px-3 py-3 sm:px-4">
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="block w-full min-w-0 max-w-full text-left text-slate-700 transition-colors hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/45">
                              <span className="line-clamp-2 whitespace-normal break-words font-medium leading-snug">
                                {part.piece_name || "Nom inconnu"}
                              </span>
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="z-50 w-80 border-slate-200 bg-white/98 p-4 text-sm shadow-xl">
                            <div className="mb-1 flex items-center justify-between text-slate-900">
                              <span className="font-semibold">Détail pièce</span>
                              <span className="font-mono text-xs text-slate-400">
                                {part.piece_ref}
                              </span>
                            </div>
                            <p className="mt-2 border-t border-slate-100 pt-2 text-slate-600">
                              {part.piece_name || "Pas de description."}
                            </p>
                          </PopoverContent>
                        </Popover>
                      </td>

                      <td className="px-2 py-3 text-right sm:px-4">
                        <div className="flex shrink-0 items-center justify-end gap-2 whitespace-nowrap">
                          <EditPieceDialog setId={part.set_id} piece={part} />
                          <DeletePieceButton
                            id={part.id}
                            setId={part.set_id}
                            refName={part.piece_ref}
                          />
                        </div>
                      </td>
                    </tr>

                    {showGauges ? (
                      <tr className="catalogue-detail-gauge-row">
                        <td colSpan={gaugeColSpan} className="px-4 pb-2 pt-0">
                          <div className="catalogue-detail-line-gauge">
                            <div
                              className="catalogue-detail-line-gauge-fill"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

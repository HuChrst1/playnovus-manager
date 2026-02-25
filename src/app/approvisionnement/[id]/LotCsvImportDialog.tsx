"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  importLotPiecesFromCsv,
  type ImportLotPiecesFromCsvResult,
} from "../action";

type CsvInputMode = "file" | "paste";

type LotCsvImportDialogProps = {
  lotId: number;
  isDraft: boolean;
};

const DEFAULT_IMPORT_ERROR =
  "Impossible d'importer ce CSV pour le moment. Merci de réessayer.";
const APPLIED_ROWS_AUTO_COLLAPSE_THRESHOLD = 20;

export function LotCsvImportDialog({ lotId, isDraft }: LotCsvImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<CsvInputMode>("file");
  const [pastedCsv, setPastedCsv] = useState("");
  const [fileCsv, setFileCsv] = useState("");
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ImportLotPiecesFromCsvResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isInputSectionOpen, setIsInputSectionOpen] = useState(true);
  const [isSummarySectionOpen, setIsSummarySectionOpen] = useState(true);
  const [isAppliedSectionOpen, setIsAppliedSectionOpen] = useState(true);
  const [isRejectedSectionOpen, setIsRejectedSectionOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (!isDraft) {
    return null;
  }

  const resetDialogState = () => {
    setMode("file");
    setPastedCsv("");
    setFileCsv("");
    setSelectedFileName(null);
    setResult(null);
    setError(null);
    setNotice(null);
    setIsInputSectionOpen(true);
    setIsSummarySectionOpen(true);
    setIsAppliedSectionOpen(true);
    setIsRejectedSectionOpen(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetDialogState();
    }
  };

  const runImport = (csvContent: string) => {
    setError(null);
    setNotice(null);
    setResult(null);

    startTransition(async () => {
      const importResult = await importLotPiecesFromCsv(lotId, { csvContent });
      setResult(importResult);
      setIsSummarySectionOpen(true);

      const appliedRowsCount = importResult.success
        ? importResult.appliedRows.length
        : 0;
      setIsAppliedSectionOpen(
        appliedRowsCount <= APPLIED_ROWS_AUTO_COLLAPSE_THRESHOLD
      );

      const rejectedRowsCount = importResult.rejectedRows?.length ?? 0;
      setIsRejectedSectionOpen(rejectedRowsCount > 0);

      if (!importResult.success) {
        setError(importResult.error || DEFAULT_IMPORT_ERROR);
        return;
      }

      setIsInputSectionOpen(false);
      if (importResult.warning) {
        setNotice(importResult.warning);
      } else {
        setNotice("Import terminé.");
      }

      router.refresh();
    });
  };

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.currentTarget.files?.[0];
    if (!file) {
      setFileCsv("");
      setSelectedFileName(null);
      return;
    }

    const fileContent = await file.text();
    setFileCsv(fileContent);
    setSelectedFileName(file.name);
    setMode("file");
    setError(null);
    setNotice(null);
  };

  const handleFileImport = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!fileCsv.trim()) {
      setError("Sélectionne un fichier CSV avant de lancer l'import.");
      return;
    }

    runImport(fileCsv);
  };

  const handlePasteImport = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!pastedCsv.trim()) {
      setError("Colle du contenu CSV avant de lancer l'import.");
      return;
    }

    runImport(pastedCsv);
  };

  const summary = result?.summary;
  const rejectedRows = result?.rejectedRows ?? [];
  const appliedRows = result?.success ? result.appliedRows : [];
  const hasImportResult = result !== null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9 rounded-full px-4 text-xs"
        >
          Importer CSV
        </Button>
      </DialogTrigger>

      <DialogContent className="app-modal-wide app-modal-scroll overflow-x-hidden overscroll-contain">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            Import CSV des pièces du lot
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Colonnes attendues: A = <strong>Numero de piece</strong>, B ={" "}
            <strong>Quantite de piece</strong>.
          </DialogDescription>
        </DialogHeader>

        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
        {notice && <p className="mt-2 text-sm text-sky-700">{notice}</p>}

        {hasImportResult ? (
          <section className="mt-4 space-y-3">
            {summary && (
              <details
                className="csv-import-section"
                open={isSummarySectionOpen}
                onToggle={(event) =>
                  setIsSummarySectionOpen(event.currentTarget.open)
                }
              >
                <summary className="csv-import-section-summary">
                  Rapport d&apos;import
                </summary>
                <div className="csv-import-section-body rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="grid gap-2 text-xs text-slate-700 sm:grid-cols-2 lg:grid-cols-4">
                    <p>Lignes CSV: {summary.totalRows}</p>
                    <p>Lignes valides: {summary.validRows}</p>
                    <p>Lignes rejetées: {summary.rejectedRows}</p>
                    <p>Références agrégées: {summary.aggregatedRows}</p>
                    <p>Références ajoutées: {summary.importedRows}</p>
                    <p>Références fusionnées: {summary.mergedRows}</p>
                    <p>Références appliquées: {summary.appliedRows}</p>
                    <p>Quantité totale importée: {summary.totalImportedQuantity}</p>
                  </div>
                </div>
              </details>
            )}

            {appliedRows.length > 0 && (
              <details
                className="csv-import-section"
                open={isAppliedSectionOpen}
                onToggle={(event) =>
                  setIsAppliedSectionOpen(event.currentTarget.open)
                }
              >
                <summary className="csv-import-section-summary">
                  Lignes appliquées ({appliedRows.length})
                </summary>
                <div className="csv-import-section-body">
                  <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200">
                    <table className="w-full table-fixed text-xs">
                      <thead className="bg-slate-100 text-slate-600">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Référence</th>
                          <th className="px-3 py-2 text-left font-medium">Quantité</th>
                          <th className="px-3 py-2 text-left font-medium">Action</th>
                          <th className="px-3 py-2 text-left font-medium">Lignes CSV</th>
                        </tr>
                      </thead>
                      <tbody>
                        {appliedRows.map((row) => (
                          <tr key={row.pieceRef} className="border-t border-slate-100">
                            <td className="csv-import-cell-long px-3 py-2 font-mono">
                              {row.pieceRef}
                            </td>
                            <td className="px-3 py-2 tabular-nums">{row.quantity}</td>
                            <td className="px-3 py-2">
                              {row.action === "merged" ? "Fusionnée" : "Ajoutée"}
                            </td>
                            <td className="csv-import-cell-long px-3 py-2">
                              {row.lineNumbers.map((line) => `#${line}`).join(", ")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </details>
            )}

            {rejectedRows.length > 0 && (
              <details
                className="csv-import-section"
                open={isRejectedSectionOpen}
                onToggle={(event) =>
                  setIsRejectedSectionOpen(event.currentTarget.open)
                }
              >
                <summary className="csv-import-section-summary">
                  Lignes rejetées ({rejectedRows.length})
                </summary>
                <div className="csv-import-section-body">
                  <div className="max-h-52 overflow-y-auto rounded-xl border border-red-200">
                    <table className="w-full table-fixed text-xs">
                      <thead className="bg-red-50 text-red-700">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Ligne</th>
                          <th className="px-3 py-2 text-left font-medium">Référence</th>
                          <th className="px-3 py-2 text-left font-medium">Quantité</th>
                          <th className="px-3 py-2 text-left font-medium">Motif</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rejectedRows.map((row, index) => (
                          <tr
                            key={`${row.lineNumber}-${row.pieceRef}-${index}`}
                            className="border-t border-red-100"
                          >
                            <td className="px-3 py-2">#{row.lineNumber}</td>
                            <td className="csv-import-cell-long px-3 py-2 font-mono">
                              {row.pieceRef || "—"}
                            </td>
                            <td className="px-3 py-2">{row.quantity || "—"}</td>
                            <td className="csv-import-cell-long px-3 py-2">{row.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </details>
            )}
          </section>
        ) : null}

        <section className={hasImportResult ? "mt-5" : "mt-2"}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Saisie CSV
            </p>
            {hasImportResult ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 rounded-full px-3 text-xs"
                onClick={() => setIsInputSectionOpen((previous) => !previous)}
              >
                {isInputSectionOpen ? "Masquer la saisie" : "Modifier la saisie"}
              </Button>
            ) : null}
          </div>

          {isInputSectionOpen ? (
            <>
              <div className="app-segmented mb-5">
                <button
                  type="button"
                  onClick={() => setMode("file")}
                  className={
                    mode === "file"
                      ? "app-segmented-item app-segmented-item--active h-8 px-4 text-xs font-medium"
                      : "app-segmented-item app-segmented-item--inactive h-8 px-4 text-xs font-medium"
                  }
                >
                  Fichier CSV
                </button>
                <button
                  type="button"
                  onClick={() => setMode("paste")}
                  className={
                    mode === "paste"
                      ? "app-segmented-item app-segmented-item--active h-8 px-4 text-xs font-medium"
                      : "app-segmented-item app-segmented-item--inactive h-8 px-4 text-xs font-medium"
                  }
                >
                  Coller CSV
                </button>
              </div>

              {mode === "file" ? (
                <form onSubmit={handleFileImport} className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="lot-csv-file">Fichier .csv</Label>
                    <Input
                      id="lot-csv-file"
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleFileSelect}
                      disabled={isPending}
                    />
                  </div>

                  {selectedFileName && (
                    <p className="text-xs text-slate-500">
                      Fichier sélectionné: {selectedFileName}
                    </p>
                  )}

                  <DialogFooter className="justify-end">
                    <Button
                      type="submit"
                      disabled={isPending}
                      className="h-9 rounded-full px-5 text-xs"
                    >
                      {isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Import en cours...
                        </>
                      ) : (
                        "Importer le fichier"
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              ) : (
                <form onSubmit={handlePasteImport} className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="lot-csv-paste">Contenu CSV</Label>
                    <Textarea
                      id="lot-csv-paste"
                      value={pastedCsv}
                      onChange={(event) => setPastedCsv(event.target.value)}
                      rows={8}
                      placeholder={
                        "Numero de piece;Quantite de piece\n300001;2\n300002;4"
                      }
                      disabled={isPending}
                    />
                  </div>

                  <DialogFooter className="justify-end">
                    <Button
                      type="submit"
                      disabled={isPending}
                      className="h-9 rounded-full px-5 text-xs"
                    >
                      {isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Import en cours...
                        </>
                      ) : (
                        "Importer le collage"
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              )}
            </>
          ) : (
            <p className="text-xs text-slate-500">
              La saisie est masquée pour privilégier la lecture du rapport.
            </p>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}

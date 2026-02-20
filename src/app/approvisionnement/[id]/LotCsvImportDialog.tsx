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

export function LotCsvImportDialog({ lotId, isDraft }: LotCsvImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<CsvInputMode>("file");
  const [pastedCsv, setPastedCsv] = useState("");
  const [fileCsv, setFileCsv] = useState("");
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ImportLotPiecesFromCsvResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (!isDraft) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled
          className="h-9 rounded-full px-4 text-xs"
        >
          Importer CSV
        </Button>
        <p className="text-[11px] text-slate-400">
          Lot confirmé - import CSV verrouillé.
        </p>
      </div>
    );
  }

  const resetDialogState = () => {
    setMode("file");
    setPastedCsv("");
    setFileCsv("");
    setSelectedFileName(null);
    setResult(null);
    setError(null);
    setNotice(null);
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

      if (!importResult.success) {
        setError(importResult.error || DEFAULT_IMPORT_ERROR);
        return;
      }

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

      <DialogContent className="max-w-4xl rounded-[28px] bg-white p-8 shadow-[0_28px_80px_rgba(15,23,42,0.45)]">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            Import CSV des pièces du lot
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Colonnes attendues: A = <strong>Numero de piece</strong>, B ={" "}
            <strong>Quantite de piece</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="mb-5 inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => setMode("file")}
            className={
              mode === "file"
                ? "h-8 rounded-full bg-white px-4 text-xs font-medium text-slate-900 shadow-sm"
                : "h-8 rounded-full px-4 text-xs font-medium text-slate-500"
            }
          >
            Fichier CSV
          </button>
          <button
            type="button"
            onClick={() => setMode("paste")}
            className={
              mode === "paste"
                ? "h-8 rounded-full bg-white px-4 text-xs font-medium text-slate-900 shadow-sm"
                : "h-8 rounded-full px-4 text-xs font-medium text-slate-500"
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

        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
        {notice && <p className="mt-2 text-sm text-amber-700">{notice}</p>}

        {summary && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Rapport d'import
            </h3>
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
        )}

        {appliedRows.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Lignes appliquées
            </h3>
            <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-xs">
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
                      <td className="px-3 py-2 font-mono">{row.pieceRef}</td>
                      <td className="px-3 py-2 tabular-nums">{row.quantity}</td>
                      <td className="px-3 py-2">
                        {row.action === "merged" ? "Fusionnée" : "Ajoutée"}
                      </td>
                      <td className="px-3 py-2">
                        {row.lineNumbers.map((line) => `#${line}`).join(", ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {rejectedRows.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Lignes rejetées
            </h3>
            <div className="max-h-44 overflow-y-auto rounded-xl border border-red-200">
              <table className="min-w-full text-xs">
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
                      <td className="px-3 py-2 font-mono">
                        {row.pieceRef || "—"}
                      </td>
                      <td className="px-3 py-2">{row.quantity || "—"}</td>
                      <td className="px-3 py-2">{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

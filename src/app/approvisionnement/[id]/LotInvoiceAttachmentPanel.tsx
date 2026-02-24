"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ExternalLink,
  Loader2,
  Paperclip,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deleteLotInvoiceAttachment,
  uploadLotInvoiceAttachment,
  type LotInvoiceAttachment,
} from "../action";

type LotInvoiceAttachmentPanelProps = {
  lotId: number;
  lotStatus: "draft" | "confirmed";
  initialAttachment: LotInvoiceAttachment | null;
  initialWarning?: string | null;
  initialError?: string | null;
};

const euroBytesFormatter = new Intl.NumberFormat("fr-FR");
const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "heic",
  "heif",
  "gif",
  "bmp",
]);

const formatDateTime = (value: string | null) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

const formatFileSize = (value: number | null) => {
  if (value === null || !Number.isFinite(value) || value <= 0) {
    return "—";
  }

  if (value < 1024) {
    return `${euroBytesFormatter.format(value)} o`;
  }
  if (value < 1024 * 1024) {
    return `${euroBytesFormatter.format(value / 1024)} Ko`;
  }
  return `${euroBytesFormatter.format(value / (1024 * 1024))} Mo`;
};

const formatMimeType = (value: string | null) => {
  if (!value) return "Inconnu";
  return value.toUpperCase();
};

const getFileExtension = (fileName: string | null) => {
  if (!fileName) return "";
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex === -1) return "";
  return fileName.slice(dotIndex + 1).toLowerCase();
};

const isPdfAttachment = (attachment: LotInvoiceAttachment) => {
  const mimeType = (attachment.mimeType ?? "").toLowerCase();
  const extension = getFileExtension(attachment.fileName);
  return mimeType.includes("pdf") || extension === "pdf";
};

const isImageAttachment = (attachment: LotInvoiceAttachment) => {
  const mimeType = (attachment.mimeType ?? "").toLowerCase();
  const extension = getFileExtension(attachment.fileName);
  return mimeType.startsWith("image/") || IMAGE_EXTENSIONS.has(extension);
};

const isAttachmentPreviewable = (attachment: LotInvoiceAttachment) =>
  isPdfAttachment(attachment) || isImageAttachment(attachment);

const getPreviewMimeType = (attachment: LotInvoiceAttachment) => {
  if (isPdfAttachment(attachment)) return "application/pdf";
  if (attachment.mimeType) return attachment.mimeType;
  return "image/jpeg";
};

export function LotInvoiceAttachmentPanel({
  lotId,
  lotStatus,
  initialAttachment,
  initialWarning,
  initialError,
}: LotInvoiceAttachmentPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"upload" | "preview">("upload");
  const [attachment, setAttachment] = useState<LotInvoiceAttachment | null>(
    initialAttachment
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [notice, setNotice] = useState<string | null>(initialWarning ?? null);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setAttachment(initialAttachment);
  }, [initialAttachment]);

  useEffect(() => {
    if (initialWarning) {
      setNotice(initialWarning);
    }
  }, [initialWarning]);

  useEffect(() => {
    if (initialError) {
      setError(initialError);
    }
  }, [initialError]);

  const clearFileSelection = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const openUploadModal = () => {
    setModalMode("upload");
    setOpen(true);
    setError(null);
    setNotice(null);
  };

  const openPreviewModal = () => {
    setModalMode("preview");
    setOpen(true);
    setError(null);
    setNotice(null);
  };

  const openAttachmentInNewTab = () => {
    if (!attachment) return;
    window.open(attachment.signedUrl, "_blank", "noopener,noreferrer");
  };

  const handleUpload = () => {
    if (!selectedFile || selectedFile.size <= 0) {
      setError(
        "Ajoute un fichier facture (photo/PDF) avant de lancer l'upload."
      );
      setNotice(null);
      return;
    }

    const wasReplacingExistingAttachment = attachment !== null;
    setError(null);
    setNotice(null);

    startTransition(async () => {
      const formData = new FormData();
      formData.set("attachment", selectedFile);

      const result = await uploadLotInvoiceAttachment(lotId, formData);
      if (!result.success) {
        setError(result.error);
        setNotice(null);
        return;
      }

      setAttachment(result.attachment);
      setNotice(
        result.warning ??
          (wasReplacingExistingAttachment
            ? "Pièce jointe facture remplacée."
            : "Pièce jointe facture ajoutée.")
      );
      setError(null);
      setModalMode("preview");
      clearFileSelection();
      router.refresh();
    });
  };

  const openDeleteDialog = () => {
    if (!attachment) {
      setError("Aucune pièce jointe facture à supprimer.");
      setNotice(null);
      return;
    }
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!attachment) {
      setError("Aucune pièce jointe facture à supprimer.");
      setNotice(null);
      setDeleteDialogOpen(false);
      return;
    }
    setError(null);
    setNotice(null);

    startTransition(async () => {
      const result = await deleteLotInvoiceAttachment(lotId);
      if (!result.success && result.reason !== "ATTACHMENT_NOT_FOUND") {
        setError(result.error);
        setNotice(null);
        setDeleteDialogOpen(false);
        return;
      }

      setAttachment(null);
      setError(null);
      setNotice("Pièce jointe facture supprimée.");
      clearFileSelection();
      setModalMode("upload");
      setDeleteDialogOpen(false);
      router.refresh();
    });
  };

  const statusLabel = lotStatus === "confirmed" ? "confirmé" : "brouillon";

  return (
    <>
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <span className="text-slate-500 font-medium">Pièce jointe facture</span>

        <div className="inline-flex items-center gap-2">
          {attachment ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full"
              aria-label="Voir la pièce jointe facture"
              onClick={openPreviewModal}
            >
              <Paperclip className="h-3.5 w-3.5" />
            </Button>
          ) : null}

          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 rounded-full px-3 text-xs"
            onClick={openUploadModal}
          >
            <Upload className="mr-1 h-3.5 w-3.5" />
            Uploader pièce jointe
          </Button>
        </div>
      </div>

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            clearFileSelection();
            setError(null);
            setNotice(null);
            setDeleteDialogOpen(false);
          }
        }}
      >
        <DialogContent className="max-w-3xl p-8">
          <DialogHeader className="mb-1">
            <DialogTitle className="text-xl font-semibold tracking-tight">
              {modalMode === "preview"
                ? "Pièce jointe facture"
                : "Uploader une pièce jointe facture"}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              Formats autorisés: PDF, JPG/JPEG, PNG, WEBP, HEIC. Taille max: 15 Mo.
              Statut du lot: <strong>{statusLabel}</strong>.
            </DialogDescription>
          </DialogHeader>

          {attachment ? (
            <div className="space-y-4">
              <div className="rounded-[20px] border border-slate-200 bg-slate-50/80 p-3">
                <div
                  role="button"
                  tabIndex={0}
                  onDoubleClick={openAttachmentInNewTab}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      openAttachmentInNewTab();
                    }
                  }}
                  className="group cursor-zoom-in"
                >
                  {isAttachmentPreviewable(attachment) ? (
                    <object
                      data={attachment.signedUrl}
                      type={getPreviewMimeType(attachment)}
                      className="h-[340px] w-full rounded-[16px] border border-slate-200 bg-white"
                    >
                      <div className="flex min-h-[160px] items-center justify-center rounded-[16px] border border-dashed border-slate-200 bg-white px-4 text-center text-xs text-slate-500">
                        Aperçu indisponible. Double-cliquez pour ouvrir la pièce jointe.
                      </div>
                    </object>
                  ) : (
                    <div className="flex min-h-[200px] items-center justify-center rounded-[16px] border border-dashed border-slate-200 bg-white px-4 text-center text-xs text-slate-500">
                      Prévisualisation indisponible pour ce type de fichier.
                      Double-cliquez pour ouvrir la pièce jointe.
                    </div>
                  )}

                  <p className="mt-2 text-[11px] text-slate-500">
                    Double-cliquez sur la visualisation pour ouvrir la pièce jointe.
                  </p>
                </div>
              </div>

              <div className="rounded-[18px] border border-slate-200 bg-white/90 p-4 text-xs text-slate-600">
                <p className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
                  <Paperclip className="h-3.5 w-3.5" />
                  {attachment.fileName}
                </p>
                <p className="mt-1">Type: {formatMimeType(attachment.mimeType)}</p>
                <p>Taille: {formatFileSize(attachment.sizeBytes)}</p>
                <p>
                  Déposé le: {formatDateTime(attachment.updatedAt ?? attachment.createdAt)}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50/70 px-4 py-5 text-xs text-slate-500">
              Aucune pièce jointe facture pour ce lot.
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor={`lot-invoice-file-${lotId}`} className="text-xs">
              {attachment ? "Remplacer la pièce jointe" : "Fichier facture"}
            </Label>
            <Input
              id={`lot-invoice-file-${lotId}`}
              ref={fileInputRef}
              type="file"
              name="attachment"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif"
              disabled={isPending}
              className="h-9 text-xs"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0] ?? null;
                setSelectedFile(file);
                if (file) {
                  setError(null);
                }
              }}
            />

            {selectedFile ? (
              <p className="text-[11px] text-slate-500">
                Fichier sélectionné: {selectedFile.name}
              </p>
            ) : null}
          </div>

          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          {notice ? <p className="text-xs text-emerald-700">{notice}</p> : null}

          <DialogFooter className="mt-2 flex flex-wrap items-center justify-end gap-2">
            {attachment ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9 rounded-full px-4 text-xs"
                asChild
              >
                <a href={attachment.signedUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1 h-3.5 w-3.5" />
                  Ouvrir
                </a>
              </Button>
            ) : null}

            {attachment ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={openDeleteDialog}
                className="h-9 rounded-full border-slate-200 px-4 text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-900"
              >
                {isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Supprimer
                  </>
                )}
              </Button>
            ) : null}

            <Button
              type="button"
              size="sm"
              disabled={isPending}
              onClick={handleUpload}
              className="h-9 rounded-full px-4 text-xs"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  Envoi...
                </>
              ) : (
                <>
                  <Upload className="mr-1 h-3.5 w-3.5" />
                  {attachment ? "Remplacer" : "Envoyer"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(nextOpen) => {
          setDeleteDialogOpen(nextOpen);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Supprimer la pièce jointe facture ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault();
                if (!isPending) {
                  handleConfirmDelete();
                }
              }}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Suppression...
                </>
              ) : (
                "Supprimer"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

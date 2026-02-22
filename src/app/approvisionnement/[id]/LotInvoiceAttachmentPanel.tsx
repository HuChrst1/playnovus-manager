"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

export function LotInvoiceAttachmentPanel({
  lotId,
  lotStatus,
  initialAttachment,
  initialWarning,
  initialError,
}: LotInvoiceAttachmentPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [attachment, setAttachment] = useState<LotInvoiceAttachment | null>(
    initialAttachment
  );
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

  const handleUploadSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const fileValue = formData.get("attachment");
    if (!(fileValue instanceof File) || fileValue.size <= 0) {
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

      form.reset();
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      router.refresh();
    });
  };

  const handleDelete = () => {
    if (!attachment) {
      setError("Aucune pièce jointe facture à supprimer.");
      setNotice(null);
      return;
    }

    const confirmed = window.confirm(
      "Supprimer définitivement la pièce jointe facture de ce lot ?"
    );
    if (!confirmed) {
      return;
    }

    setError(null);
    setNotice(null);

    startTransition(async () => {
      const result = await deleteLotInvoiceAttachment(lotId);
      if (!result.success && result.reason !== "ATTACHMENT_NOT_FOUND") {
        setError(result.error);
        setNotice(null);
        return;
      }

      setAttachment(null);
      setError(null);
      setNotice("Pièce jointe facture supprimée.");
      router.refresh();
    });
  };

  return (
    <Card className="border-0 shadow-[0_18px_50px_rgba(15,23,42,0.16)] rounded-[28px] overflow-hidden bg-white/95">
      <CardHeader className="py-3 px-5 border-b border-slate-100 bg-white/90">
        <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-[0.22em]">
          Pièce jointe facture
        </CardTitle>
      </CardHeader>

      <CardContent className="p-5 space-y-4">
        <p className="text-xs text-slate-500">
          Formats autorisés: PDF, JPG/JPEG, PNG, WEBP, HEIC. Taille max: 15 Mo.
          Upload et suppression disponibles en lot brouillon et confirmé
          (statut actuel: <strong>{lotStatus === "confirmed" ? "confirmé" : "brouillon"}</strong>).
        </p>

        <form onSubmit={handleUploadSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor={`lot-invoice-file-${lotId}`} className="text-xs">
              Fichier facture
            </Label>
            <Input
              id={`lot-invoice-file-${lotId}`}
              ref={fileInputRef}
              type="file"
              name="attachment"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif"
              disabled={isPending}
              className="h-9 text-xs"
            />
          </div>

          <div className="flex items-center justify-end">
            <Button
              type="submit"
              size="sm"
              disabled={isPending}
              className="h-9 rounded-full px-4 text-xs"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Upload...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Envoyer facture
                </>
              )}
            </Button>
          </div>
        </form>

        {attachment ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-700 inline-flex items-center gap-2">
                  <Paperclip className="h-3.5 w-3.5" />
                  {attachment.fileName}
                </p>
                <p className="text-xs text-slate-500">
                  Type: {formatMimeType(attachment.mimeType)}
                </p>
                <p className="text-xs text-slate-500">
                  Taille: {formatFileSize(attachment.sizeBytes)}
                </p>
                <p className="text-xs text-slate-500">
                  Déposé le: {formatDateTime(attachment.updatedAt ?? attachment.createdAt)}
                </p>
              </div>

              <div className="inline-flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-full px-3 text-xs"
                  asChild
                >
                  <a
                    href={attachment.signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Ouvrir
                  </a>
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={handleDelete}
                  className="h-8 rounded-full border-slate-200 px-3 text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-900"
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
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500 rounded-xl border border-dashed border-slate-200 px-3 py-2">
            Aucune pièce jointe facture pour ce lot.
          </p>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}
        {notice && <p className="text-xs text-emerald-700">{notice}</p>}
      </CardContent>
    </Card>
  );
}

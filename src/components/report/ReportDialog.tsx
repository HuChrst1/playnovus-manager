"use client";

import * as React from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  createReportTicketAction,
  deleteReportTicketAction,
  listReportTicketsAction,
  updateReportTicketAction,
} from "@/app/actions/report";
import {
  REPORT_CATEGORIES,
  REPORT_CATEGORY_LABELS,
  REPORT_STATUSES,
  REPORT_STATUS_LABELS,
  REPORT_TARGET_SCOPES,
  REPORT_TARGET_SCOPE_LABELS,
  isReportCategory,
  isReportStatus,
  isReportTargetScope,
  type ReportCategory,
  type ReportStatus,
  type ReportTargetScope,
} from "@/lib/report-types";
import type { Tables } from "@/types/supabase";

type ReportTab = "report" | "tickets";
type ReportTicketRow = Tables<"report_tickets">;

const DEFAULT_TARGET_SCOPE: ReportTargetScope = "GLOBAL";
const DEFAULT_CATEGORY: ReportCategory = "BUG";
const DEFAULT_CLOSED_STATUS: ReportStatus = "RESOLVED";
const DESCRIPTION_MAX_LENGTH = 2000;
const TICKET_ATTRIBUTION_FALLBACK = "Non renseigne";

function getTargetScopeLabel(value: string): string {
  return isReportTargetScope(value) ? REPORT_TARGET_SCOPE_LABELS[value] : value;
}

function getCategoryLabel(value: string): string {
  return isReportCategory(value) ? REPORT_CATEGORY_LABELS[value] : value;
}

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("fr-FR");
}

function isTicketClosed(ticket: ReportTicketRow): boolean {
  return ticket.status !== "OPEN" || ticket.closed_at !== null;
}

function getTicketActorLabel(...candidates: Array<string | null | undefined>): string {
  for (const candidate of candidates) {
    if (typeof candidate !== "string") {
      continue;
    }

    const normalized = candidate.trim();
    if (normalized.length > 0) {
      return normalized;
    }
  }

  return TICKET_ATTRIBUTION_FALLBACK;
}

function getCreatedByLabel(ticket: ReportTicketRow): string {
  return getTicketActorLabel(
    ticket.created_by_display_name,
    ticket.created_by_email,
    ticket.created_by_user_id
  );
}

function getClosedByLabel(ticket: ReportTicketRow): string {
  return getTicketActorLabel(
    ticket.closed_by_display_name,
    ticket.closed_by_email,
    ticket.closed_by_user_id
  );
}

type ReportDialogProps = {
  triggerClassName?: string;
};

export function ReportDialog({ triggerClassName }: ReportDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<ReportTab>("report");

  const [targetScope, setTargetScope] =
    React.useState<ReportTargetScope>(DEFAULT_TARGET_SCOPE);
  const [category, setCategory] = React.useState<ReportCategory>(DEFAULT_CATEGORY);
  const [description, setDescription] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);
  const [formMessage, setFormMessage] = React.useState<string | null>(null);

  const [tickets, setTickets] = React.useState<ReportTicketRow[]>([]);
  const [ticketsLoading, setTicketsLoading] = React.useState(false);
  const [ticketsError, setTicketsError] = React.useState<string | null>(null);
  const [pendingTicketId, setPendingTicketId] = React.useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [ticketIdToDelete, setTicketIdToDelete] = React.useState<number | null>(
    null
  );
  const [statusDraftByTicketId, setStatusDraftByTicketId] = React.useState<
    Record<number, ReportStatus>
  >({});

  const [isCreating, startCreateTransition] = React.useTransition();

  const loadTickets = React.useCallback(async () => {
    setTicketsLoading(true);
    setTicketsError(null);

    const result = await listReportTicketsAction();
    if (!result.success) {
      setTicketsError(result.error ?? "Impossible de charger les tickets.");
      setTicketsLoading(false);
      return;
    }

    const nextTickets = result.tickets ?? [];
    setTickets(nextTickets);
    setStatusDraftByTicketId((previousDrafts) => {
      const nextDrafts: Record<number, ReportStatus> = {};

      for (const ticket of nextTickets) {
        const existingDraft = previousDrafts[ticket.id];
        if (isReportStatus(existingDraft)) {
          nextDrafts[ticket.id] = existingDraft;
          continue;
        }

        nextDrafts[ticket.id] = isReportStatus(ticket.status)
          ? ticket.status
          : "OPEN";
      }

      return nextDrafts;
    });
    setTicketsLoading(false);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    void loadTickets();
  }, [open, loadTickets]);

  const handleCreateTicket = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setFormMessage(null);

    const trimmedDescription = description.trim();
    if (!trimmedDescription) {
      setFormError("La description est obligatoire.");
      return;
    }

    startCreateTransition(async () => {
      const result = await createReportTicketAction({
        target_scope: targetScope,
        category,
        description: trimmedDescription,
      });

      if (!result.success) {
        setFormError(result.error ?? "Impossible de creer le ticket.");
        return;
      }

      setDescription("");
      setFormMessage(`Ticket #${result.ticket?.id ?? "?"} cree.`);
      setActiveTab("tickets");
      await loadTickets();
    });
  };

  const updateTicket = React.useCallback(
    async (ticketId: number, status: ReportStatus, closed: boolean) => {
      setPendingTicketId(ticketId);
      setTicketsError(null);

      const result = await updateReportTicketAction({
        id: ticketId,
        status,
        closed,
      });

      if (!result.success) {
        setTicketsError(result.error ?? "Impossible de mettre a jour le ticket.");
        setPendingTicketId(null);
        return;
      }

      await loadTickets();
      setPendingTicketId(null);
    },
    [loadTickets]
  );

  const handleStatusChange = (ticket: ReportTicketRow, nextValue: string) => {
    if (!isReportStatus(nextValue)) return;

    setStatusDraftByTicketId((previousDrafts) => ({
      ...previousDrafts,
      [ticket.id]: nextValue,
    }));

    if (!isTicketClosed(ticket)) return;
    if (nextValue === "OPEN") return;
    void updateTicket(ticket.id, nextValue, true);
  };

  const handleClosedToggle = (ticket: ReportTicketRow, closed: boolean) => {
    if (!closed) {
      setStatusDraftByTicketId((previousDrafts) => ({
        ...previousDrafts,
        [ticket.id]: "OPEN",
      }));
      void updateTicket(ticket.id, "OPEN", false);
      return;
    }

    const draftStatus = statusDraftByTicketId[ticket.id];
    const nextStatus = draftStatus === "IGNORED" ? "IGNORED" : DEFAULT_CLOSED_STATUS;
    setStatusDraftByTicketId((previousDrafts) => ({
      ...previousDrafts,
      [ticket.id]: nextStatus,
    }));
    void updateTicket(ticket.id, nextStatus, true);
  };

  const openDeleteDialog = (ticketId: number) => {
    setTicketsError(null);
    setTicketIdToDelete(ticketId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (ticketIdToDelete === null) return;

    setPendingTicketId(ticketIdToDelete);
    setTicketsError(null);

    const result = await deleteReportTicketAction(ticketIdToDelete);
    if (!result.success) {
      setTicketsError(result.error ?? "Impossible de supprimer le ticket.");
      setPendingTicketId(null);
      return;
    }

    await loadTickets();
    setPendingTicketId(null);
    setDeleteDialogOpen(false);
    setTicketIdToDelete(null);
  };

  const isDeletePending = pendingTicketId !== null;

  const triggerClass = triggerClassName
    ? cn(triggerClassName, "text-[10px] font-semibold")
    : "app-filter-trigger text-xs font-semibold";

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setActiveTab("report");
          setFormError(null);
          setFormMessage(null);
          setTicketsError(null);
          setDeleteDialogOpen(false);
          setTicketIdToDelete(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className={triggerClass} aria-label="Report">
          Report
        </Button>
      </DialogTrigger>

      <DialogContent className="app-modal-report app-modal-scroll overflow-x-hidden overscroll-contain">
        <DialogHeader className="app-modal-header">
          <DialogTitle className="app-modal-title">
            Report
          </DialogTitle>
          <DialogDescription className="app-modal-description">
            Cree des tickets internes pour bugs, evolutions et ameliorations.
          </DialogDescription>
        </DialogHeader>

        <div className="app-report-tabs" role="tablist" aria-label="Vue report">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "report"}
            className="app-report-tab"
            data-state={activeTab === "report" ? "active" : "inactive"}
            onClick={() => setActiveTab("report")}
          >
            Report
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "tickets"}
            className="app-report-tab"
            data-state={activeTab === "tickets" ? "active" : "inactive"}
            onClick={() => setActiveTab("tickets")}
          >
            Tickets
          </button>
        </div>

        {activeTab === "report" ? (
          <form className="space-y-4" onSubmit={handleCreateTicket}>
            <section className="app-surface-muted space-y-4 p-4 sm:p-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="app-control-label">
                    Cible
                  </span>
                  <select
                    value={targetScope}
                    onChange={(event) =>
                      setTargetScope(event.target.value as ReportTargetScope)
                    }
                    className="app-control app-control--md"
                  >
                    {REPORT_TARGET_SCOPES.map((scope) => (
                      <option key={scope} value={scope}>
                        {REPORT_TARGET_SCOPE_LABELS[scope]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1.5">
                  <span className="app-control-label">
                    Categorie
                  </span>
                  <select
                    value={category}
                    onChange={(event) =>
                      setCategory(event.target.value as ReportCategory)
                    }
                    className="app-control app-control--md"
                  >
                    {REPORT_CATEGORIES.map((itemCategory) => (
                      <option key={itemCategory} value={itemCategory}>
                        {REPORT_CATEGORY_LABELS[itemCategory]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block space-y-1.5">
                <span className="app-control-label">
                  Description
                </span>
                <Textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={DESCRIPTION_MAX_LENGTH}
                  placeholder="Explique le probleme, la fonctionnalite ou l'amelioration attendue."
                  className="app-control app-control--textarea min-h-36"
                />
                <span className="block text-right text-xs text-muted-foreground">
                  {description.length}/{DESCRIPTION_MAX_LENGTH}
                </span>
              </label>
            </section>

            {formError && (
              <p className="rounded-2xl border border-rose-200/80 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {formError}
              </p>
            )}
            {formMessage && (
              <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {formMessage}
              </p>
            )}

            <section className="app-surface-muted flex justify-end px-4 py-3 sm:px-5">
              <Button
                type="submit"
                disabled={isCreating}
                className="h-9 px-5 text-xs font-semibold"
              >
                {isCreating ? "Creation..." : "Creer le ticket"}
              </Button>
            </section>
          </form>
        ) : (
          <div className="space-y-3">
            <div className="app-surface-muted flex items-center justify-between gap-2 px-4 py-3 sm:px-5">
              <p className="text-xs text-slate-500">
                Affichage: tickets ouverts d'abord, puis les plus recents.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadTickets()}
                disabled={ticketsLoading}
                className="h-9 gap-2 px-4 text-xs font-medium"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Rafraichir
              </Button>
            </div>

            {ticketsError && (
              <p className="rounded-2xl border border-rose-200/80 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {ticketsError}
              </p>
            )}
            {ticketsLoading ? (
              <div className="app-surface-muted rounded-[20px] px-4 py-5 text-sm text-muted-foreground">
                Chargement des tickets...
              </div>
            ) : tickets.length === 0 ? (
              <div className="app-surface-muted rounded-[20px] px-4 py-5 text-sm text-muted-foreground">
                Aucun ticket pour le moment.
              </div>
            ) : (
              <>
                <div className="hidden xl:block">
                  <div className="appro-table-shell p-2.5 sm:p-3">
                    <div className="max-h-[54vh] overflow-auto rounded-[24px] border border-white/80 bg-white/94 p-1 sm:p-2">
                      <table className="appro-table w-full min-w-[1100px] text-sm">
                        <thead className="appro-table-header">
                          <tr>
                            <th className="w-[72px] px-3 py-2 text-left">ID</th>
                            <th className="w-[188px] px-3 py-2 text-left">Ticket</th>
                            <th className="min-w-[280px] px-3 py-2 text-left">Description</th>
                            <th className="w-[236px] px-3 py-2 text-left">Statut</th>
                            <th className="w-[220px] px-3 py-2 text-left">Dates</th>
                            <th className="w-[230px] px-3 py-2 text-left">Attribution</th>
                            <th className="w-[84px] px-3 py-2 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tickets.map((ticket) => {
                            const rowPending = pendingTicketId === ticket.id;
                            const closed = isTicketClosed(ticket);
                            const statusValue =
                              statusDraftByTicketId[ticket.id] ??
                              (closed && isReportStatus(ticket.status)
                                ? ticket.status
                                : "OPEN");

                            return (
                              <tr key={ticket.id} className="appro-table-row">
                                <td className="px-3 py-2 font-mono text-xs font-semibold">#{ticket.id}</td>
                                <td className="px-3 py-2">
                                  <p className="text-xs font-semibold text-slate-900">
                                    {getTargetScopeLabel(ticket.target_scope)}
                                  </p>
                                  <p className="text-[11px] text-slate-500">
                                    {getCategoryLabel(ticket.category)}
                                  </p>
                                </td>
                                <td className="px-3 py-2">
                                  <p className="app-modal-cell-long whitespace-pre-wrap text-xs text-slate-700">
                                    {ticket.description}
                                  </p>
                                </td>
                                <td className="px-3 py-2">
                                  <div className="space-y-2">
                                    <select
                                      value={statusValue}
                                      className="app-control h-8 w-full rounded-full px-3 text-xs"
                                      disabled={rowPending}
                                      onChange={(event) =>
                                        handleStatusChange(ticket, event.target.value)
                                      }
                                    >
                                      {REPORT_STATUSES.filter(
                                        (status) => !closed || status !== "OPEN"
                                      ).map((status) => (
                                        <option key={status} value={status}>
                                          {REPORT_STATUS_LABELS[status]}
                                        </option>
                                      ))}
                                    </select>

                                    <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                                      <input
                                        type="checkbox"
                                        className="h-4 w-4 accent-slate-900"
                                        checked={closed}
                                        disabled={rowPending}
                                        onChange={(event) =>
                                          handleClosedToggle(ticket, event.target.checked)
                                        }
                                      />
                                      Cloture
                                    </label>
                                  </div>
                                </td>
                                <td className="px-3 py-2">
                                  <p className="text-[11px] text-slate-500">
                                    Depot:{" "}
                                    <span className="tabular-nums text-slate-700">
                                      {formatDateTime(ticket.created_at)}
                                    </span>
                                  </p>
                                  <p className="mt-1 text-[11px] text-slate-500">
                                    Cloture:{" "}
                                    <span className="tabular-nums text-slate-700">
                                      {formatDateTime(ticket.closed_at)}
                                    </span>
                                  </p>
                                </td>
                                <td className="px-3 py-2">
                                  <p className="text-[11px] text-slate-500">
                                    Cree par:{" "}
                                    <span className="app-modal-cell-long text-slate-700">
                                      {getCreatedByLabel(ticket)}
                                    </span>
                                  </p>
                                  <p className="mt-1 text-[11px] text-slate-500">
                                    Cloture/Ignore par:{" "}
                                    <span className="app-modal-cell-long text-slate-700">
                                      {getClosedByLabel(ticket)}
                                    </span>
                                  </p>
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="app-icon-action"
                                    aria-label={`Supprimer le ticket #${ticket.id}`}
                                    title={`Supprimer le ticket #${ticket.id}`}
                                    disabled={rowPending}
                                    onClick={() => openDeleteDialog(ticket.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 xl:hidden">
                  {tickets.map((ticket) => {
                    const rowPending = pendingTicketId === ticket.id;
                    const closed = isTicketClosed(ticket);
                    const statusValue =
                      statusDraftByTicketId[ticket.id] ??
                      (closed && isReportStatus(ticket.status)
                        ? ticket.status
                        : "OPEN");

                    return (
                      <article
                        key={ticket.id}
                        className="app-surface-muted space-y-3 rounded-[22px] border border-white/80 p-4"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-mono text-xs font-semibold text-slate-900">
                              #{ticket.id}
                            </p>
                            <p className="text-xs text-slate-700">
                              {getTargetScopeLabel(ticket.target_scope)}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {getCategoryLabel(ticket.category)}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="app-icon-action"
                            aria-label={`Supprimer le ticket #${ticket.id}`}
                            title={`Supprimer le ticket #${ticket.id}`}
                            disabled={rowPending}
                            onClick={() => openDeleteDialog(ticket.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <p className="whitespace-pre-wrap break-words text-xs text-slate-700">
                          {ticket.description}
                        </p>

                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <label className="space-y-1">
                            <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
                              Statut
                            </span>
                            <select
                              value={statusValue}
                              className="app-control h-8 w-full rounded-full px-3 text-xs"
                              disabled={rowPending}
                              onChange={(event) =>
                                handleStatusChange(ticket, event.target.value)
                              }
                            >
                              {REPORT_STATUSES.filter(
                                (status) => !closed || status !== "OPEN"
                              ).map((status) => (
                                <option key={status} value={status}>
                                  {REPORT_STATUS_LABELS[status]}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-2 text-xs font-medium text-slate-700">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-slate-900"
                              checked={closed}
                              disabled={rowPending}
                              onChange={(event) =>
                                handleClosedToggle(ticket, event.target.checked)
                              }
                            />
                            Cloture
                          </label>
                        </div>

                        <div className="space-y-1 text-[11px] text-slate-500">
                          <p>
                            Depot:{" "}
                            <span className="tabular-nums text-slate-700">
                              {formatDateTime(ticket.created_at)}
                            </span>
                          </p>
                          <p>
                            Cloture:{" "}
                            <span className="tabular-nums text-slate-700">
                              {formatDateTime(ticket.closed_at)}
                            </span>
                          </p>
                          <p>
                            Cree par:{" "}
                            <span className="text-slate-700">
                              {getCreatedByLabel(ticket)}
                            </span>
                          </p>
                          <p>
                            Cloture/Ignore par:{" "}
                            <span className="text-slate-700">
                              {getClosedByLabel(ticket)}
                            </span>
                          </p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(nextOpen) => {
          setDeleteDialogOpen(nextOpen);
          if (!nextOpen) {
            setTicketIdToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Supprimer le ticket
              {ticketIdToDelete !== null ? ` #${ticketIdToDelete}` : ""} ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletePending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeletePending || ticketIdToDelete === null}
              onClick={(event) => {
                event.preventDefault();
                if (!isDeletePending) {
                  void handleDeleteConfirm();
                }
              }}
            >
              {isDeletePending ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

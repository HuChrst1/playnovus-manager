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

  const handleDelete = async (ticketId: number) => {
    const confirmed = window.confirm(
      `Supprimer le ticket #${ticketId} ?\n\nCette action est irreversible.`
    );
    if (!confirmed) return;

    setPendingTicketId(ticketId);
    setTicketsError(null);

    const result = await deleteReportTicketAction(ticketId);
    if (!result.success) {
      setTicketsError(result.error ?? "Impossible de supprimer le ticket.");
      setPendingTicketId(null);
      return;
    }

    await loadTickets();
    setPendingTicketId(null);
  };

  const triggerClass = triggerClassName
    ? cn(triggerClassName, "text-[10px] font-semibold")
    : "inline-flex h-9 items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold";

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
        }
      }}
    >
      <DialogTrigger asChild>
        <button type="button" className={triggerClass} aria-label="Report">
          Report
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-6xl rounded-[28px] bg-white p-6 sm:p-8">
        <DialogHeader className="mb-2">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            Report
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Cree des tickets internes pour bugs, evolutions et ameliorations.
          </DialogDescription>
        </DialogHeader>

        <div className="mb-4 inline-flex rounded-full bg-slate-100 p-1">
          <button
            type="button"
            className={cn(
              "rounded-full px-4 py-1.5 text-xs font-medium transition-colors",
              activeTab === "report"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-200"
            )}
            onClick={() => setActiveTab("report")}
          >
            Report
          </button>
          <button
            type="button"
            className={cn(
              "rounded-full px-4 py-1.5 text-xs font-medium transition-colors",
              activeTab === "tickets"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-200"
            )}
            onClick={() => setActiveTab("tickets")}
          >
            Tickets
          </button>
        </div>

        {activeTab === "report" ? (
          <form className="space-y-4" onSubmit={handleCreateTicket}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Cible
                </span>
                <select
                  value={targetScope}
                  onChange={(event) =>
                    setTargetScope(event.target.value as ReportTargetScope)
                  }
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-offset-background focus:ring-1 focus:ring-ring"
                >
                  {REPORT_TARGET_SCOPES.map((scope) => (
                    <option key={scope} value={scope}>
                      {REPORT_TARGET_SCOPE_LABELS[scope]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Categorie
                </span>
                <select
                  value={category}
                  onChange={(event) =>
                    setCategory(event.target.value as ReportCategory)
                  }
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-offset-background focus:ring-1 focus:ring-ring"
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
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Description
              </span>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={DESCRIPTION_MAX_LENGTH}
                placeholder="Explique le probleme, la fonctionnalite ou l'amelioration attendue."
                className="min-h-36 rounded-xl"
              />
              <span className="block text-right text-xs text-muted-foreground">
                {description.length}/{DESCRIPTION_MAX_LENGTH}
              </span>
            </label>

            {formError && (
              <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {formError}
              </p>
            )}
            {formMessage && (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {formMessage}
              </p>
            )}

            <div className="flex justify-end">
              <Button type="submit" disabled={isCreating} className="px-5">
                {isCreating ? "Creation..." : "Creer le ticket"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Affichage: tickets ouverts d'abord, puis les plus recents.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadTickets()}
                disabled={ticketsLoading}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Rafraichir
              </Button>
            </div>

            {ticketsError && (
              <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {ticketsError}
              </p>
            )}

            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-[1050px] text-sm">
                <thead className="app-table-head">
                  <tr>
                    <th className="px-3 py-2 text-left">ID</th>
                    <th className="px-3 py-2 text-left">Cible</th>
                    <th className="px-3 py-2 text-left">Categorie</th>
                    <th className="px-3 py-2 text-left">Description</th>
                    <th className="px-3 py-2 text-left">Date depot</th>
                    <th className="px-3 py-2 text-left">Statut</th>
                    <th className="px-3 py-2 text-center">Cloture ?</th>
                    <th className="px-3 py-2 text-left">Date cloture</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ticketsLoading ? (
                    <tr className="border-t border-border">
                      <td
                        colSpan={9}
                        className="px-3 py-5 text-center text-sm text-muted-foreground"
                      >
                        Chargement des tickets...
                      </td>
                    </tr>
                  ) : tickets.length === 0 ? (
                    <tr className="border-t border-border">
                      <td
                        colSpan={9}
                        className="px-3 py-5 text-center text-sm text-muted-foreground"
                      >
                        Aucun ticket pour le moment.
                      </td>
                    </tr>
                  ) : (
                    tickets.map((ticket) => {
                      const rowPending = pendingTicketId === ticket.id;
                      const closed = isTicketClosed(ticket);
                      const statusValue =
                        statusDraftByTicketId[ticket.id] ??
                        (closed && isReportStatus(ticket.status)
                          ? ticket.status
                          : "OPEN");

                      return (
                        <tr key={ticket.id} className="app-table-row">
                          <td className="px-3 py-2 font-mono text-xs font-semibold">
                            #{ticket.id}
                          </td>
                          <td className="px-3 py-2">{getTargetScopeLabel(ticket.target_scope)}</td>
                          <td className="px-3 py-2">{getCategoryLabel(ticket.category)}</td>
                          <td className="px-3 py-2">
                            <p className="max-w-[380px] whitespace-pre-wrap break-words">
                              {ticket.description}
                            </p>
                          </td>
                          <td className="px-3 py-2 tabular-nums">
                            {formatDateTime(ticket.created_at)}
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={statusValue}
                              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs"
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
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-slate-900"
                              checked={closed}
                              disabled={rowPending}
                              onChange={(event) =>
                                handleClosedToggle(ticket, event.target.checked)
                              }
                            />
                          </td>
                          <td className="px-3 py-2 tabular-nums">
                            {formatDateTime(ticket.closed_at)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-full"
                              aria-label={`Supprimer le ticket #${ticket.id}`}
                              disabled={rowPending}
                              onClick={() => void handleDelete(ticket.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

import type { ReactNode } from "react";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type TableCardProps = {
  children: ReactNode;
  className?: string;
};

export function TableCard({ children, className }: TableCardProps) {
  return <div className={cn("app-card overflow-hidden p-1 sm:p-2", className)}>{children}</div>;
}

type TableOverflowProps = {
  children: ReactNode;
  className?: string;
};

export function TableOverflow({ children, className }: TableOverflowProps) {
  return <div className={cn("overflow-x-auto", className)}>{children}</div>;
}

type SortableTableHeaderProps = {
  label: string;
  columnKey: string;
  activeSortKey: string;
  sortDir: "asc" | "desc";
  href: string;
  align?: "left" | "center" | "right";
  className?: string;
};

export function SortableTableHeader({
  label,
  columnKey,
  activeSortKey,
  sortDir,
  href,
  align = "left",
  className,
}: SortableTableHeaderProps) {
  const isActive = activeSortKey === columnKey;
  const isAsc = sortDir === "asc";
  const alignClass =
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";

  return (
    <th className={cn("px-4 py-3 font-medium", alignClass, className)}>
      <Link
        href={href}
        className={cn(
          "inline-flex items-center gap-1 hover:text-primary",
          isActive && "text-primary"
        )}
      >
        <span>{label}</span>
        <span className="text-[10px]">{isActive ? (isAsc ? "▲" : "▼") : "⇅"}</span>
      </Link>
    </th>
  );
}

type TableStatusBadgeProps = {
  label: string;
  tone?: "success" | "danger" | "warning" | "muted";
  className?: string;
};

export function TableStatusBadge({ label, tone = "muted", className }: TableStatusBadgeProps) {
  const toneClasses =
    tone === "success"
      ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200"
      : tone === "danger"
      ? "bg-red-100 text-red-700 ring-1 ring-red-200"
      : tone === "warning"
      ? "bg-sky-50 text-sky-700 ring-1 ring-sky-200"
      : "bg-slate-100 text-slate-600 ring-1 ring-slate-200";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        toneClasses,
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

export type TablePaginationProps = {
  currentPage: number;
  totalPages: number;
  pageNumbers: (number | "dots")[];
  summary: ReactNode;
  makePageHref: (page: number) => string;
  className?: string;
};

export function TablePagination({
  currentPage,
  totalPages,
  pageNumbers,
  summary,
  makePageHref,
  className,
}: TablePaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div
      className={cn(
        "mt-1 flex flex-col gap-3 border-t border-transparent bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="text-xs text-muted-foreground">{summary}</div>

      <div className="min-w-0 max-w-full overflow-x-auto">
        <div className="app-segmented max-w-full bg-white">
          <Button
            variant="ghost"
            size="icon"
            asChild
            disabled={currentPage === 1}
            className="h-9 w-9 rounded-full sm:h-7 sm:w-7"
          >
            <Link href={makePageHref(currentPage - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>

          {pageNumbers.map((item, index) =>
            item === "dots" ? (
              <span
                key={`dots-${index}`}
                className="flex h-9 items-center justify-center px-2 text-xs text-muted-foreground sm:h-7"
              >
                …
              </span>
            ) : (
              <Link
                key={item}
                href={makePageHref(item)}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full text-xs transition-colors sm:h-7 sm:w-7",
                  item === currentPage
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-muted-foreground hover:bg-muted/80"
                )}
              >
                {item}
              </Link>
            )
          )}

          <Button
            variant="ghost"
            size="icon"
            asChild
            disabled={currentPage === totalPages}
            className="h-9 w-9 rounded-full sm:h-7 sm:w-7"
          >
            <Link href={makePageHref(currentPage + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

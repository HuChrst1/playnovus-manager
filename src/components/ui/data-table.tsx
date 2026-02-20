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
  return <div className={cn("app-card overflow-hidden", className)}>{children}</div>;
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
      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
      : tone === "danger"
      ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
      : tone === "warning"
      ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
      : "bg-slate-100 text-slate-600 ring-1 ring-slate-200";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
        toneClasses,
        className
      )}
    >
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
        "flex flex-col gap-3 border-t border-border bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="text-xs text-muted-foreground">{summary}</div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 rounded-full bg-background px-2 py-1 shadow-sm">
          <Button
            variant="ghost"
            size="icon"
            asChild
            disabled={currentPage === 1}
            className="h-7 w-7 rounded-full"
          >
            <Link href={makePageHref(currentPage - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>

          {pageNumbers.map((item, index) =>
            item === "dots" ? (
              <span
                key={`dots-${index}`}
                className="flex h-7 items-center justify-center px-2 text-xs text-muted-foreground"
              >
                …
              </span>
            ) : (
              <Link
                key={item}
                href={makePageHref(item)}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs transition-colors",
                  item === currentPage
                    ? "bg-primary text-primary-foreground shadow-sm"
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
            className="h-7 w-7 rounded-full"
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

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type FilterBarProps = {
  children: ReactNode;
  className?: string;
};

export function FilterBar({ children, className }: FilterBarProps) {
  return <div className={cn("app-card rounded-3xl p-4 md:p-5", className)}>{children}</div>;
}

type FilterPopoverProps = {
  label?: ReactNode;
  children: ReactNode;
  className?: string;
  panelClassName?: string;
  summaryClassName?: string;
};

export function FilterPopover({
  label = "Filtrer",
  children,
  className,
  panelClassName,
  summaryClassName,
}: FilterPopoverProps) {
  return (
    <details className={cn("group relative", className)}>
      <summary
        className={cn(
          "list-none inline-flex h-9 cursor-pointer items-center rounded-full border border-slate-200 bg-white px-4 text-xs font-medium text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.08)] transition-colors hover:bg-slate-50 [&::-webkit-details-marker]:hidden",
          summaryClassName
        )}
      >
        {label}
      </summary>

      <div
        className={cn(
          "absolute right-0 z-20 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.18)]",
          panelClassName
        )}
      >
        {children}
      </div>
    </details>
  );
}

type FilterSidebarProps = {
  children: ReactNode;
  className?: string;
};

export function FilterSidebar({ children, className }: FilterSidebarProps) {
  return (
    <aside className={cn("hidden w-[280px] shrink-0 transition-all duration-200", className)}>
      {children}
    </aside>
  );
}

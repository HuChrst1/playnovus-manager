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
      <summary className={cn("app-filter-trigger", summaryClassName)}>
        {label}
      </summary>

      <div
        className={cn(
          "app-filter-panel absolute right-0 z-20 mt-2 w-80",
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

type FilterLabelProps = {
  children: ReactNode;
  className?: string;
  htmlFor?: string;
};

export function FilterLabel({ children, className, htmlFor }: FilterLabelProps) {
  return (
    <label htmlFor={htmlFor} className={cn("app-control-label", className)}>
      {children}
    </label>
  );
}

type FilterActionsProps = {
  children: ReactNode;
  className?: string;
};

export function FilterActions({ children, className }: FilterActionsProps) {
  return <div className={cn("app-filter-actions", className)}>{children}</div>;
}

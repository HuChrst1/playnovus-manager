import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
  leftClassName?: string;
  actionsClassName?: string;
};

export function PageHeader({
  title,
  description,
  meta,
  actions,
  className,
  leftClassName,
  actionsClassName,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 md:flex-row md:items-center md:justify-between",
        className
      )}
    >
      <div className={cn("min-w-0", leftClassName)}>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
        {meta ? <div className="mt-1">{meta}</div> : null}
      </div>

      {actions ? (
        <div className={cn("flex items-center gap-2", actionsClassName)}>{actions}</div>
      ) : null}
    </div>
  );
}

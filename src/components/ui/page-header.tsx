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
        "app-card flex flex-col gap-3 rounded-[30px] px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6",
        className
      )}
    >
      <div className={cn("min-w-0", leftClassName)}>
        <h1 className="text-3xl font-light tracking-tight text-slate-900 md:text-[40px] md:leading-[1.05]">
          {title}
        </h1>
        {description ? (
          <p className="text-xs text-muted-foreground md:text-sm">{description}</p>
        ) : null}
        {meta ? <div className="mt-1">{meta}</div> : null}
      </div>

      {actions ? (
        <div className={cn("flex items-center gap-2", actionsClassName)}>{actions}</div>
      ) : null}
    </div>
  );
}

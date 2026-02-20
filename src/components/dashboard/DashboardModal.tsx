"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type DashboardModalProps = {
  trigger?: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  contentClassName?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function DashboardModal({
  trigger,
  title,
  description,
  children,
  footer,
  contentClassName,
  open,
  onOpenChange,
}: DashboardModalProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger> : null}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-[90] bg-black/50",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
            "data-[state=open]:duration-150 data-[state=closed]:duration-150",
            "data-[state=open]:ease-out data-[state=closed]:ease-out"
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-[91] w-[min(96vw,1100px)]",
            "max-h-[88vh] -translate-x-1/2 -translate-y-1/2 overflow-hidden",
            "rounded-[28px] border border-slate-200 bg-white shadow-[0_26px_60px_rgba(15,23,42,0.28)]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
            "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
            "data-[state=open]:duration-150 data-[state=closed]:duration-150",
            "data-[state=open]:ease-out data-[state=closed]:ease-out",
            contentClassName
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 md:px-6">
            <div className="space-y-1">
              <DialogPrimitive.Title className="text-base font-semibold text-slate-900 md:text-lg">
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="text-xs text-slate-500 md:text-sm">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          <div className="max-h-[calc(88vh-120px)] overflow-auto px-5 py-4 md:px-6 md:py-5">
            {children}
          </div>

          {footer ? (
            <div className="border-t border-slate-100 px-5 py-3 md:px-6">{footer}</div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

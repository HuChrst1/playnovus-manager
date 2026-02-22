"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2",
    "whitespace-nowrap rounded-full",
    "font-medium tracking-tight",
    "border border-transparent",
    "transition-colors duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35",
    "disabled:pointer-events-none disabled:opacity-60",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          [
            "bg-slate-900 text-white",
            "shadow-[0_14px_28px_rgba(15,23,42,0.28)]",
            "hover:bg-slate-800 active:bg-slate-900",
          ].join(" "),

        outline:
          [
            "bg-white/88 text-slate-700",
            "border-white/70",
            "shadow-[0_10px_22px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]",
            "hover:bg-white active:bg-slate-100/80",
          ].join(" "),

        ghost:
          [
            "bg-transparent text-muted-foreground",
            "border-transparent",
            "hover:bg-white/85 hover:text-slate-900 active:bg-slate-200/70",
          ].join(" "),

        destructive:
          [
            "bg-red-600 text-white",
            "border-red-500/70",
            "shadow-[0_8px_20px_rgba(220,38,38,0.35)]",
            "hover:bg-red-600 active:bg-red-700",
          ].join(" "),

        secondary:
          [
            "bg-sky-100/90 text-sky-800",
            "border-sky-200/80",
            "shadow-[0_8px_20px_rgba(14,165,233,0.16)]",
            "hover:bg-sky-200/80 active:bg-sky-300/80",
          ].join(" "),

        link:
          "bg-transparent text-primary underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        default: "h-10 px-5 text-xs md:text-[13px]",

        sm: "h-8 px-3 text-[11px]",

        lg: "h-11 px-7 text-sm",

        icon: "h-10 w-10 p-0 text-sm rounded-full shadow-[0_10px_26px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.72)] bg-white/86 border-white/70",
      },
    },
    defaultVariants: {
      variant: "outline",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };

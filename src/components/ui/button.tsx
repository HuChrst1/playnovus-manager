"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2",
    "whitespace-nowrap rounded-full",
    "border border-transparent",
    "font-medium tracking-tight",
    "transition-[background-color,border-color,color,box-shadow] duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/55 focus-visible:ring-offset-2 focus-visible:ring-offset-white/95",
    "disabled:pointer-events-none disabled:opacity-55",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          [
            "border-slate-900/85 bg-slate-900 text-white",
            "shadow-[0_12px_26px_rgba(15,23,42,0.24),inset_0_1px_0_rgba(255,255,255,0.08)]",
            "hover:bg-slate-800 hover:border-slate-800",
            "active:bg-slate-950 active:border-slate-950",
          ].join(" "),

        outline:
          [
            "border-slate-200/80 bg-white/92 text-slate-700",
            "shadow-[0_10px_22px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.88)]",
            "hover:bg-white hover:text-slate-900 hover:border-slate-300/85",
            "active:bg-slate-50 active:border-slate-300/95",
          ].join(" "),

        ghost:
          [
            "bg-transparent text-slate-600",
            "border-transparent",
            "hover:bg-white/90 hover:text-slate-900",
            "active:bg-slate-100/85",
          ].join(" "),

        destructive:
          [
            "bg-red-600 text-white border-red-700/70",
            "shadow-[0_10px_22px_rgba(220,38,38,0.32)]",
            "hover:bg-red-700 hover:border-red-700",
            "active:bg-red-800 active:border-red-800",
          ].join(" "),

        secondary:
          [
            "bg-sky-100/95 text-sky-900 border-sky-200/90",
            "shadow-[0_10px_22px_rgba(2,132,199,0.16)]",
            "hover:bg-sky-200/85 hover:border-sky-300/90",
            "active:bg-sky-300/90 active:border-sky-300",
          ].join(" "),

        icon:
          [
            "h-10 w-10 p-0",
            "border-slate-200/80 bg-white/92 text-slate-700",
            "shadow-[0_10px_24px_rgba(15,23,42,0.1),inset_0_1px_0_rgba(255,255,255,0.88)]",
            "hover:bg-white hover:text-slate-900 hover:border-slate-300/85",
            "active:bg-slate-50 active:border-slate-300/95",
          ].join(" "),

        link:
          "bg-transparent text-primary underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        default: "h-10 px-5 text-xs md:text-[13px]",

        sm: "h-8 px-3 text-[11px]",

        lg: "h-11 px-7 text-sm",

        icon: "h-10 w-10 p-0 text-sm rounded-full",
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

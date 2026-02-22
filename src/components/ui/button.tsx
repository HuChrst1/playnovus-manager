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
    "transition-colors duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-60",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          [
            "bg-slate-900 text-white",
            "shadow-[0_10px_24px_rgba(15,23,42,0.32)]",
            "hover:bg-slate-800 active:bg-slate-900",
          ].join(" "),

        outline:
          [
            "bg-white text-slate-700",
            "border border-border",
            "shadow-[0_6px_16px_rgba(15,23,42,0.1)]",
            "hover:bg-slate-50 active:bg-slate-100",
          ].join(" "),

        ghost:
          [
            "bg-transparent text-muted-foreground",
            "hover:bg-slate-100 active:bg-slate-200",
          ].join(" "),

        destructive:
          [
            "bg-red-600 text-white",
            "shadow-[0_8px_20px_rgba(220,38,38,0.35)]",
            "hover:bg-red-600 active:bg-red-700",
          ].join(" "),

        secondary:
          [
            "bg-slate-100 text-slate-700",
            "border border-border",
            "hover:bg-slate-200 active:bg-slate-300",
          ].join(" "),

        link:
          "bg-transparent text-primary underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        default: "h-9 px-4 text-xs md:text-[13px]",

        sm: "h-8 px-3 text-[11px]",

        lg: "h-10 px-6 text-sm",

        icon: "h-8 w-8 p-0 text-sm",
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

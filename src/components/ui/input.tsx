"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

/**
 * Design system PlayNovus – Inputs
 *
 * - Pills arrondis (rounded-full)
 * - Fond blanc, bord léger, shadow douce
 * - Hauteur confortable comme le champ "Search" de la maquette
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex w-full",
          "h-10 px-4",
          "rounded-full",
          "border border-slate-200",
          "bg-white",
          "text-sm text-foreground",
          "shadow-[0_6px_18px_rgba(15,23,42,0.06)]",
          "placeholder:text-slate-400",
          "transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-60",
          // gère aussi les fichiers (file input shadcn)
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

export { Input };

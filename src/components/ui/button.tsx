"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Design system PlayNovus – Boutons
 *
 * Objectif : se rapprocher au maximum de la maquette :
 * - Pills bien arrondis (rounded-full)
 * - Version claire avec shadow douce (Sort, petits contrôles)
 * - Version sombre compacte (Add order)
 * - Boutons icône ronds / carrés très arrondis
 */
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
        /** CTA sombre – style "Add order" */
        default:
          [
            "bg-slate-900 text-white",
            "shadow-[0_10px_26px_rgba(15,23,42,0.45)]",
            "hover:bg-slate-800 active:bg-slate-900",
          ].join(" "),

        /** Pill blanc avec bord léger + shadow douce – style "Sort: default" */
        outline:
          [
            "bg-white text-foreground",
            "border border-slate-200",
            "shadow-[0_6px_18px_rgba(15,23,42,0.08)]",
            "hover:bg-slate-50 active:bg-slate-100",
          ].join(" "),

        /** Bouton neutre très léger (pagination, petites actions) */
        ghost:
          [
            "bg-transparent text-muted-foreground",
            "hover:bg-slate-100 active:bg-slate-200",
          ].join(" "),

        /** Danger (suppression) – rouge doux mais visible */
        destructive:
          [
            "bg-red-500 text-white",
            "shadow-[0_4px_12px_rgba(239,68,68,0.45)]",
            "hover:bg-red-600 active:bg-red-700",
          ].join(" "),

        /** Bouton secondaire "soft" (pour plus tard si besoin) */
        secondary:
          [
            "bg-slate-100 text-foreground",
            "border border-slate-200",
            "hover:bg-slate-200 active:bg-slate-300",
          ].join(" "),

        /** Lien texte simple (sans pill visible) */
        link:
          "bg-transparent text-primary underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        /** Taille par défaut – comme les boutons de la barre du haut */
        default: "h-9 px-4 text-xs md:text-[13px]",

        /** Petit bouton (Réinitialiser / Appliquer dans le panneau filtres) */
        sm: "h-8 px-3 text-[11px]",

        /** Grand bouton (si besoin pour plus tard) */
        lg: "h-10 px-6 text-sm",

        /** Bouton icône (rond, style sidebar / petits ronds noirs) */
        icon: "h-9 w-9 p-0 text-sm",
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

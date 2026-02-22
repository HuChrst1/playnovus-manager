import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2.5 py-1 text-[11px] font-semibold w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-slate-900 text-white [a&]:hover:bg-slate-800",
        secondary:
          "border-transparent bg-slate-100 text-slate-700 [a&]:hover:bg-slate-200",
        destructive:
          "border-transparent bg-red-100 text-red-700 [a&]:hover:bg-red-200",
        outline:
          "border-white/80 bg-white/90 text-slate-700 shadow-[0_8px_16px_rgba(15,23,42,0.06)] [a&]:hover:bg-white",
        success:
          "border-transparent bg-emerald-100 text-emerald-700 [a&]:hover:bg-emerald-200",
        warning:
          "border-transparent bg-sky-100 text-sky-700 [a&]:hover:bg-sky-200",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }

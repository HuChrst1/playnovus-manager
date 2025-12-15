"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

type SourceValue = "" | "SET" | "PIECE";

export function SourceFilterDropdown({
  name = "source",
  defaultValue = "",
  label = "Source",
  widthClassName = "w-[120px]",
}: {
  name?: string;
  defaultValue?: string;
  label?: string;
  widthClassName?: string;
}) {
  const initial = (defaultValue === "SET" || defaultValue === "PIECE" ? defaultValue : "") as SourceValue;
  const [value, setValue] = React.useState<SourceValue>(initial);

  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>

      <div className="relative inline-block">
        <select
          name={name}
          value={value}
          onChange={(e) => setValue(e.target.value as SourceValue)}
          className={cn(
            buttonVariants({ variant: "secondary", size: "sm" }),
            widthClassName,
            "appearance-none pr-8 text-left"
          )}
        >
          <option value="">Toutes</option>
          <option value="SET">SET</option>
          <option value="PIECE">PIECE</option>
        </select>

        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 opacity-60" />
      </div>
    </div>
  );
}
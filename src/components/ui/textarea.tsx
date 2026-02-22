// src/components/ui/textarea.tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "app-control app-control--textarea disabled:cursor-not-allowed disabled:opacity-55",
          className
        )}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea";

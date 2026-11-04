import * as React from "react";
import { cn } from "@/lib/utils";

interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

/** Pill toggle used for filters and pickup slots (Figma: Chip). */
export function Chip({ active = false, className, ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex h-9 shrink-0 items-center justify-center rounded-full px-4 text-sm font-medium transition-colors disabled:opacity-40",
        active ? "bg-ink text-canvas" : "border border-line bg-white text-ink hover:border-ink/25",
        className
      )}
      {...props}
    />
  );
}

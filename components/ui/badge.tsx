import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium", {
  variants: {
    tone: {
      neutral: "bg-line text-ink",
      ink: "bg-ink text-canvas",
      pink: "bg-pink text-ink",
      soft: "bg-pink-soft text-ink",
      success: "bg-pistachio-soft text-ink"
    }
  },
  defaultVariants: { tone: "neutral" }
});

const dotColor: Record<NonNullable<VariantProps<typeof badgeVariants>["tone"]>, string> = {
  neutral: "bg-ink",
  ink: "bg-canvas",
  pink: "bg-ink",
  soft: "bg-pink-strong",
  success: "bg-success"
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  dot?: boolean;
  pulse?: boolean;
}

/** Status pill (Figma: StatusBadge). */
export function Badge({ className, tone, dot = true, pulse = false, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dotColor[tone ?? "neutral"], pulse && "animate-pulse")} aria-hidden="true" />}
      {children}
    </span>
  );
}

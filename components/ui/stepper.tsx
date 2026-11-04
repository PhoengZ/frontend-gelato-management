import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepperProps {
  value: number;
  label: string;
  onDecrement: () => void;
  onIncrement: () => void;
  incrementDisabled?: boolean;
  className?: string;
}

/** − n + quantity control (Figma: Stepper). */
export function Stepper({ value, label, onDecrement, onIncrement, incrementDisabled, className }: StepperProps) {
  return (
    <div className={cn("flex h-10 w-28 items-center justify-between rounded-full border border-line bg-white p-1", className)} aria-label={`จำนวน ${label}`}>
      <button
        type="button"
        onClick={onDecrement}
        className="grid h-8 w-8 place-items-center rounded-full text-ink transition-colors hover:bg-ink/5"
        aria-label={`ลดจำนวน ${label}`}
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="min-w-6 text-center text-sm font-semibold tabular-nums">{value}</span>
      <button
        type="button"
        onClick={onIncrement}
        disabled={incrementDisabled}
        className="grid h-8 w-8 place-items-center rounded-full bg-ink text-canvas transition-opacity disabled:opacity-25"
        aria-label={`เพิ่มจำนวน ${label}`}
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

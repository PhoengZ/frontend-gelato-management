import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shared input surface (Figma: Input / Select). */
export const fieldClass =
  "h-[52px] w-full rounded-2xl border border-line bg-white px-4 text-[15px] text-ink outline-none transition-colors placeholder:text-subtle focus:border-ink focus:ring-1 focus:ring-ink aria-[invalid=true]:border-pink-strong aria-[invalid=true]:ring-0 disabled:opacity-50";

interface FieldProps {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/** Label + control + hint/error, stacked with 6px gaps. */
export function Field({ label, hint, error, className, children }: FieldProps) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="block text-xs font-medium text-subtle">{label}</span>
      {children}
      {error ? (
        <span role="alert" className="block text-xs font-medium text-pink-strong">{error}</span>
      ) : hint ? (
        <span className="block text-xs text-subtle">{hint}</span>
      ) : null}
    </label>
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(fieldClass, className)} {...props} />
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => <textarea ref={ref} className={cn(fieldClass, "h-auto min-h-24 py-3 leading-relaxed", className)} {...props} />
);
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <span className="relative block">
      <select ref={ref} className={cn(fieldClass, "appearance-none pr-11", className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-subtle" aria-hidden="true" />
    </span>
  )
);
Select.displayName = "Select";

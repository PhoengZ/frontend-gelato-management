"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

const sides = {
  // Mobile-first bottom sheet that becomes a centred panel on larger screens.
  bottom:
    "inset-x-0 bottom-0 max-h-[92svh] rounded-t-[28px] pb-safe sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[min(92vw,30rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[28px] sm:pb-6",
  // Desktop drawer (backoffice forms).
  right: "inset-y-0 right-0 h-full w-full max-w-[30rem] border-l border-line"
};

export interface SheetContentProps extends DialogPrimitive.DialogContentProps {
  side?: keyof typeof sides;
  hideClose?: boolean;
}

export function SheetContent({ className, children, side = "bottom", hideClose = false, ...props }: SheetContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/45" />
      <DialogPrimitive.Content
        className={cn("fixed z-50 overflow-y-auto bg-canvas p-4 pt-3 shadow-sheet focus:outline-none sm:p-6", sides[side], className)}
        {...props}
      >
        {side === "bottom" && <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line sm:hidden" aria-hidden="true" />}
        {children}
        {!hideClose && (
          <DialogPrimitive.Close className="absolute right-4 top-4 hidden rounded-full p-2 text-subtle hover:bg-ink/5 sm:block" aria-label="ปิด">
            <X className="h-5 w-5" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("mb-5 space-y-0.5 pr-10", className)} {...props} />
);
export const SheetTitle = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Title>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>>(
  ({ className, ...props }, ref) => <DialogPrimitive.Title ref={ref} className={cn("text-[22px] font-semibold", className)} {...props} />
);
SheetTitle.displayName = "SheetTitle";
export const SheetDescription = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Description>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>>(
  ({ className, ...props }, ref) => <DialogPrimitive.Description ref={ref} className={cn("text-xs text-subtle", className)} {...props} />
);
SheetDescription.displayName = "SheetDescription";

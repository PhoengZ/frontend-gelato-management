import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-none border border-black text-xs font-black uppercase tracking-[0.12em] transition-[transform,box-shadow,background-color,color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:pointer-events-none disabled:translate-x-0 disabled:translate-y-0 disabled:shadow-none disabled:opacity-40",
  {
    variants: {
      variant: {
        default: "bg-[#fffaf2] text-black shadow-[5px_5px_0_#111] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-white hover:shadow-[7px_7px_0_#111] active:translate-x-[3px] active:translate-y-[3px] active:shadow-[2px_2px_0_#111]",
        secondary: "bg-[#f79bad] text-black shadow-[5px_5px_0_#111] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-[#ffaabd] hover:shadow-[7px_7px_0_#111] active:translate-x-[3px] active:translate-y-[3px] active:shadow-[2px_2px_0_#111]",
        outline: "bg-white text-black shadow-[3px_3px_0_#111] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-[#fffaf2] hover:shadow-[5px_5px_0_#111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none",
        ghost: "border-transparent bg-transparent text-black shadow-none hover:border-black hover:bg-[#fffaf2] active:bg-[#f7eee2]",
        destructive: "bg-[#e94b55] text-white shadow-[5px_5px_0_#111] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-[#f05b65] hover:shadow-[7px_7px_0_#111] active:translate-x-[3px] active:translate-y-[3px] active:shadow-[2px_2px_0_#111]"
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-9 px-4",
        lg: "h-12 px-7 text-base",
        icon: "h-10 w-10 p-0"
      }
    },
    defaultVariants: { variant: "default", size: "default" }
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
    return <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };

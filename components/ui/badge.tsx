import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-emerald-700 text-emerald-100",
        secondary: "border-transparent bg-zinc-700 text-zinc-200",
        destructive: "border-transparent bg-red-700 text-red-100",
        outline: "border-zinc-600 text-zinc-300",
        warning: "border-transparent bg-amber-700/50 text-amber-200",
        processing: "border-transparent bg-blue-700/50 text-blue-200",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }

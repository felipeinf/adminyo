import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../../lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors focus:outline-none",
  {
    variants: {
      variant: {
        default: "bg-blue-50 text-blue-700",
        secondary: "bg-gray-100 text-gray-700",
        destructive: "bg-red-50 text-red-700",
        outline: "text-foreground border border-border",
        success: "bg-green-50 text-green-700",
        warning: "bg-yellow-50 text-yellow-700",
        error: "bg-red-50 text-red-700",
        primary: "bg-primary/10 text-primary",
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
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
export default Badge

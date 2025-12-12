import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { INTERACTIVE_PATTERNS } from "@/components/ui/effects"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          `border-transparent bg-primary text-primary-foreground ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`,
        secondary:
          `border-transparent bg-secondary text-secondary-foreground ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`,
        destructive:
          `border-transparent bg-destructive text-destructive-foreground ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER}`,
        outline: "text-foreground",
        success:
          `border-transparent bg-green-100 text-green-700 ${INTERACTIVE_PATTERNS.SUCCESS_HOVER}`,
        warning:
          `border-transparent bg-yellow-100 text-yellow-700 ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`,
        info:
          `border-transparent bg-blue-100 text-blue-700 ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`,
        error:
          `border-transparent bg-red-100 text-red-700 ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER}`,
        purple:
          `border-transparent bg-purple-100 text-purple-700 ${INTERACTIVE_PATTERNS.ACCENT_HOVER}`,
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

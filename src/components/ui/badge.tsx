import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { INTERACTIVE_PATTERNS } from "@/components/ui/effects"
import { useBorderTokens } from '@/hooks/useBorderTokens'

// 🏢 ENTERPRISE: Dynamic badge variants using centralized border tokens
const createBadgeVariants = (borderTokens: ReturnType<typeof useBorderTokens>) => cva(
  `inline-flex items-center ${borderTokens.radius.full} border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2`,
  {
    variants: {
      variant: {
        default:
          `${borderTokens.style.none} bg-primary text-primary-foreground ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`,
        secondary:
          `${borderTokens.style.none} bg-secondary text-secondary-foreground ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`,
        destructive:
          `${borderTokens.style.none} bg-destructive text-destructive-foreground ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER}`,
        outline: "text-foreground",
        success:
          `${borderTokens.style.none} bg-green-100 text-green-700 ${INTERACTIVE_PATTERNS.SUCCESS_HOVER}`,
        warning:
          `${borderTokens.style.none} bg-yellow-100 text-yellow-700 ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`,
        info:
          `${borderTokens.style.none} bg-blue-100 text-blue-700 ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`,
        error:
          `${borderTokens.style.none} bg-red-100 text-red-700 ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER}`,
        purple:
          `${borderTokens.style.none} bg-purple-100 text-purple-700 ${INTERACTIVE_PATTERNS.ACCENT_HOVER}`,
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

// 🏢 ENTERPRISE: Badge variant type definition
export type BadgeVariantProps = {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' | 'error' | 'purple';
}

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    BadgeVariantProps {}

function Badge({ className, variant, ...props }: BadgeProps) {
  // 🏢 ENTERPRISE: Use centralized border tokens
  const borderTokens = useBorderTokens();
  const badgeVariants = createBadgeVariants(borderTokens);

  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

// Export badgeVariants function για backward compatibility
const badgeVariants = (borderTokens: ReturnType<typeof useBorderTokens>) => createBadgeVariants(borderTokens);

export { Badge, badgeVariants, createBadgeVariants, type BadgeVariantProps }

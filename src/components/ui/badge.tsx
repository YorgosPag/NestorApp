import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { INTERACTIVE_PATTERNS } from "@/components/ui/effects"
import { useBorderTokens } from '@/hooks/useBorderTokens'
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors'

// 🏢 ENTERPRISE: Dynamic badge variants using centralized border tokens and semantic colors
const createBadgeVariants = (borderTokens: ReturnType<typeof useBorderTokens>, colors: ReturnType<typeof useSemanticColors>) => cva(
  `inline-flex items-center ${borderTokens.radius.full} border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2`,
  {
    variants: {
      variant: {
        default:
          `${borderTokens.style.none} ${colors.bg.primary} ${colors.text.inverse} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`,
        secondary:
          `${borderTokens.style.none} ${colors.bg.secondary} ${colors.text.primary} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`,
        destructive:
          `${borderTokens.style.none} ${colors.bg.error} ${colors.text.inverse} ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER}`,
        outline: "text-foreground",
        success:
          `${borderTokens.style.none} ${colors.bg.success}/50 ${colors.text.success} ${INTERACTIVE_PATTERNS.SUCCESS_HOVER}`,
        warning:
          `${borderTokens.style.none} ${colors.bg.warning}/50 ${colors.text.warning} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`,
        info:
          `${borderTokens.style.none} ${colors.bg.info}/50 ${colors.text.info} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`,
        error:
          `${borderTokens.style.none} ${colors.bg.error}/50 ${colors.text.danger} ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER}`,
        purple:
          `${borderTokens.style.none} ${colors.bg.info}/50 ${colors.text.accent} ${INTERACTIVE_PATTERNS.ACCENT_HOVER}`,
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
  // 🏢 ENTERPRISE: Use centralized tokens
  const borderTokens = useBorderTokens();
  const colors = useSemanticColors();
  const badgeVariants = createBadgeVariants(borderTokens, colors);

  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

// Export badgeVariants function για backward compatibility
const badgeVariants = (borderTokens: ReturnType<typeof useBorderTokens>, colors: ReturnType<typeof useSemanticColors>) => createBadgeVariants(borderTokens, colors);

export { Badge, badgeVariants, createBadgeVariants, type BadgeVariantProps }

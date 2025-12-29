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
          `${borderTokens.style.none} bg-blue-600 text-white ${INTERACTIVE_PATTERNS.PRIMARY_HOVER || 'hover:bg-blue-700'}`,
        secondary:
          `${borderTokens.style.none} bg-gray-100 text-gray-900 ${INTERACTIVE_PATTERNS.SUBTLE_HOVER || 'hover:bg-gray-200'}`,
        destructive:
          `${borderTokens.style.none} bg-red-600 text-white ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER || 'hover:bg-red-700'}`,
        outline: "text-foreground",
        success:
          `${borderTokens.style.none} bg-green-50 text-green-600 ${INTERACTIVE_PATTERNS.SUCCESS_HOVER || 'hover:bg-green-100'}`,
        warning:
          `${borderTokens.style.none} bg-yellow-50 text-yellow-600 ${INTERACTIVE_PATTERNS.SUBTLE_HOVER || 'hover:bg-yellow-100'}`,
        info:
          `${borderTokens.style.none} bg-blue-50 text-blue-600 ${INTERACTIVE_PATTERNS.PRIMARY_HOVER || 'hover:bg-blue-100'}`,
        error:
          `${borderTokens.style.none} bg-red-50 text-red-600 ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER || 'hover:bg-red-100'}`,
        purple:
          `${borderTokens.style.none} bg-purple-50 text-purple-600 ${INTERACTIVE_PATTERNS.ACCENT_HOVER || 'hover:bg-purple-100'}`,
        light:
          `${borderTokens.style.none} bg-gray-50 text-gray-600 ${INTERACTIVE_PATTERNS.SUBTLE_HOVER || 'hover:bg-gray-100'}`,
        muted:
          `${borderTokens.style.none} bg-gray-100 text-gray-500 ${INTERACTIVE_PATTERNS.SUBTLE_HOVER || 'hover:bg-gray-200'}`,
        subtle:
          `${borderTokens.style.none} bg-slate-50 text-slate-600 ${INTERACTIVE_PATTERNS.SUBTLE_HOVER || 'hover:bg-slate-100'}`,
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

// 🏢 ENTERPRISE: Badge variant type definition
export type BadgeVariantProps = {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' | 'error' | 'purple' | 'light' | 'muted' | 'subtle';
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

export { Badge, badgeVariants, createBadgeVariants }

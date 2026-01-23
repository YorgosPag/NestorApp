import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { INTERACTIVE_PATTERNS } from "@/components/ui/effects"
import { useBorderTokens } from '@/hooks/useBorderTokens'
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors'

// 🏢 ENTERPRISE: Dynamic badge variants using centralized border tokens and semantic colors
// ✅ CENTRALIZED: Single source of truth for ALL badges (Grid view + List view)
const createBadgeVariants = (borderTokens: ReturnType<typeof useBorderTokens>, colors: ReturnType<typeof useSemanticColors>) => cva(
  `inline-flex items-center ${borderTokens.radiusClass.full} border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2`,
  {
    variants: {
      variant: {
        default:
          `border-transparent ${colors.bg.primary} ${colors.text.primary} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER || 'hover:opacity-90'}`,
        secondary:
          `border-transparent ${colors.bg.secondary} ${colors.text.secondary} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER || 'hover:opacity-90'}`,
        destructive:
          `border-transparent ${colors.bg.error} text-white ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER || 'hover:opacity-90'}`,
        outline: "text-foreground",
        success:
          `border-transparent ${colors.bg.success} ${colors.text.success} ${INTERACTIVE_PATTERNS.SUCCESS_HOVER || 'hover:opacity-90'}`,
        warning:
          `border-transparent ${colors.bg.warning} ${colors.text.warning} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER || 'hover:opacity-90'}`,
        info:
          `border-transparent ${colors.bg.info} ${colors.text.info} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER || 'hover:opacity-90'}`,
        error:
          `border-transparent ${colors.bg.error} ${colors.text.error} ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER || 'hover:opacity-90'}`,
        purple:
          `border-transparent ${colors.bg.secondary} ${colors.text.primary} ${INTERACTIVE_PATTERNS.ACCENT_HOVER || 'hover:opacity-90'}`,
        light:
          `border-transparent ${colors.bg.muted} ${colors.text.muted} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER || 'hover:opacity-90'}`,
        muted:
          `border-transparent ${colors.bg.muted} ${colors.text.muted} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER || 'hover:opacity-90'}`,
        subtle:
          `border-transparent ${colors.bg.muted} ${colors.text.muted} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER || 'hover:opacity-90'}`,
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

// 🏢 ENTERPRISE: Static badge variants for use outside of React components
// Uses CSS variables for theme-aware styling (same as dynamic variants)
const staticBadgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-background text-foreground hover:opacity-90",
        secondary: "border-transparent bg-muted text-muted-foreground hover:opacity-90",
        destructive: "border-transparent bg-[hsl(var(--bg-error))] text-white hover:opacity-90",
        outline: "text-foreground",
        success: "border-transparent bg-[hsl(var(--bg-success))] text-[hsl(var(--text-success))] hover:opacity-90",
        warning: "border-transparent bg-[hsl(var(--bg-warning))] text-[hsl(var(--text-warning))] hover:opacity-90",
        info: "border-transparent bg-[hsl(var(--bg-info))] text-[hsl(var(--text-info))] hover:opacity-90",
        error: "border-transparent bg-[hsl(var(--bg-error))] text-[hsl(var(--text-error))] hover:opacity-90",
        purple: "border-transparent bg-muted text-foreground hover:opacity-90",
        light: "border-transparent bg-muted text-muted-foreground hover:opacity-90",
        muted: "border-transparent bg-muted text-muted-foreground hover:opacity-90",
        subtle: "border-transparent bg-muted text-muted-foreground hover:opacity-90",
      },
      size: {
        default: "px-2.5 py-0.5",
        sm: "px-2 py-0.5 text-xs",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

// ✅ ENTERPRISE: Exported static badgeVariants for backward compatibility
const badgeVariants = staticBadgeVariants;

export { Badge, badgeVariants, createBadgeVariants, staticBadgeVariants }

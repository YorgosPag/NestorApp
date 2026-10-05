import * as React from "react"
import { cva } from "class-variance-authority"
import { AlertCircle, Info } from "lucide-react"

import { cn } from "@/lib/utils"
import { useBorderTokens } from '@/hooks/useBorderTokens'
import { useIconSizes } from '@/hooks/useIconSizes'
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors'
import '@/lib/design-system';

// 🏢 ENTERPRISE: Dynamic alert variants using centralized border tokens
const createAlertVariants = (borderTokens: ReturnType<typeof useBorderTokens>, colors?: ReturnType<typeof useSemanticColors>) => cva(
  `relative w-full ${borderTokens.quick.card} p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground`,
  {
    variants: {
      variant: {
        default: `${colors?.bg.primary || 'bg-background'} text-foreground`,
        destructive: `${borderTokens.quick.error} text-destructive dark:border-destructive [&>svg]:text-destructive`,
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

// 🏢 ENTERPRISE: Alert variant type definition
export type AlertVariantProps = {
  variant?: 'default' | 'destructive';
  /**
   * Το εικονίδιο της παραλλαγής, από ΕΔΩ — όχι από κάθε καλούντα (ADR-771: η κατάσταση δεν λέγεται μόνο με χρώμα,
   * WCAG 1.4.1). Μετρημένο 2026-10-05: 17 από τα 31 `variant="destructive"` δεν είχαν εικονίδιο, γιατί έπρεπε να
   * το θυμηθεί ο καλών. Opt-in: 14 καλούντες περνούν ήδη δικό τους `<svg>` ως παιδί.
   */
  withIcon?: boolean;
}

/** Ένα εικονίδιο ανά παραλλαγή — το σχήμα διαφέρει, όχι μόνο το χρώμα. */
const VARIANT_ICON = {
  default: Info,
  destructive: AlertCircle,
} satisfies Record<NonNullable<AlertVariantProps['variant']>, React.ComponentType<{ className?: string }>>;

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & AlertVariantProps
>(({ className, variant, withIcon = false, children, ...props }, ref) => {
  // 🏢 ENTERPRISE: Use centralized border tokens and semantic colors
  const borderTokens = useBorderTokens();
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  const alertVariants = createAlertVariants(borderTokens, colors);
  const Icon = VARIANT_ICON[variant ?? 'default'];

  return (
    <div
      ref={ref}
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      {withIcon && <Icon aria-hidden="true" className={iconSizes.sm} />}
      {children}
    </div>
  );
})
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-medium leading-none tracking-tight", className)}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription, createAlertVariants }

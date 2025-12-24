import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { useBorderTokens } from '@/hooks/useBorderTokens'

// 🏢 ENTERPRISE: Dynamic alert variants using centralized border tokens
const createAlertVariants = (borderTokens: ReturnType<typeof useBorderTokens>) => cva(
  `relative w-full ${borderTokens.quick.card} p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground`,
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
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
}

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & AlertVariantProps
>(({ className, variant, ...props }, ref) => {
  // 🏢 ENTERPRISE: Use centralized border tokens
  const borderTokens = useBorderTokens();
  const alertVariants = createAlertVariants(borderTokens);

  return (
    <div
      ref={ref}
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
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

export { Alert, AlertTitle, AlertDescription, createAlertVariants, type AlertVariantProps }
